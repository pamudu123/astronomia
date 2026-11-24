"""Coupons and orders: which reports an account has paid for (docs/18, section 4).

Every unlocked report is an order: the account, the report (its kind and the hash of its
request, never the birth details), the list price and currency, the coupon and the amount paid.
An order is made in only two ways: a coupon that leaves nothing to pay (`redeem`), or a payment
its provider says was paid (`settle`). A payment is started with the amount worked out here, and
unlocks nothing until then.

One class for both databases, as in accounts.py: SQLite for local runs and tests, PostgreSQL
(Supabase) when ASTRONOMIA_DATABASE_URL is set. On PostgreSQL the tables are in the private
`sidera` schema and are made by supabase/migrations/, never by the app.
"""

import datetime as dt
import logging
import sqlite3
import threading
import uuid
from collections.abc import Callable, Iterator, Sequence
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Literal, cast

from app.store import postgres
from app.tiers.prices import REPORT_KINDS, Currency, Price, ReportKind, discounted

Clock = Callable[[], dt.datetime]
log = logging.getLogger(__name__)

TABLES = ("coupons", "orders", "coupon_misses", "payments")
MAX_CODE = 64
# How long a started payment holds its coupon use, so a code cannot be paid past its limits.
PAYMENT_HOLDS = dt.timedelta(hours=1)
# Why a coupon was not accepted. Only "unknown" counts as a wrong guess.
Refusal = Literal["unknown", "ended", "wrong_report", "used_up", "account_limit"]


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def normalise_code(text: str) -> str:
    """Codes are compared in lower case with every space taken out: people type on phones."""
    return "".join(text.split()).lower()


@dataclass(frozen=True)
class Coupon:
    id: str
    code: str
    percent_off: int
    kinds: tuple[ReportKind, ...]
    max_uses: int | None
    max_uses_per_account: int
    ends_at: dt.datetime | None
    active: bool
    note: str
    created_at: dt.datetime
    uses: int  # paid orders made with it


@dataclass(frozen=True)
class Order:
    id: str
    report_kind: ReportKind
    report_hash: str
    price: Price  # before the coupon
    coupon_code: str | None
    percent_off: int
    amount_paid: int
    method: Literal["coupon", "payment"]
    created_at: dt.datetime
    provider: str | None = None  # who took the payment; None for a coupon


PaymentStatus = Literal["pending", "paid", "failed", "cancelled"]
Outcome = Literal["paid", "failed", "cancelled"]


@dataclass(frozen=True)
class Payment:
    """One try at paying for a report. It unlocks nothing until it is paid."""

    id: str
    report_kind: ReportKind
    report_hash: str
    price: Price  # before the coupon
    percent_off: int
    amount: int  # what is to be paid
    provider: str
    status: PaymentStatus
    created_at: dt.datetime


class CouponRefused(Exception):
    def __init__(self, reason: Refusal) -> None:
        super().__init__(reason)
        self.reason: Refusal = reason


class AlreadyPaid(Exception):
    """This account has paid for the report: there is nothing to start a payment for."""


class NothingToPay(Exception):
    """The coupon makes the report free: it is unlocked with `redeem`, not paid for."""


class WrongPayment(Exception):
    """A provider's notice that does not match the payment we started. Nothing changes."""


class PaymentNeeded(Exception):
    """The coupon takes only part of the price off: the rest has to be paid."""

    def __init__(self, coupon: Coupon) -> None:
        super().__init__(coupon.code)
        self.coupon = coupon


@dataclass(frozen=True)
class _Dialect:
    placeholder: str
    schema: str | None
    lock: str  # how to hold a coupon row while its uses are counted

    def sql(self, statement: str) -> str:
        names = {n: f"{self.schema}.{n}" if self.schema else n for n in TABLES}
        return statement.format(**names).replace("?", self.placeholder)


_SQLITE = _Dialect(placeholder="?", schema=None, lock="")
_POSTGRES = _Dialect(placeholder="%s", schema=postgres.SCHEMA, lock=" FOR UPDATE")

# SQLite only. PostgreSQL gets its tables from supabase/migrations/.
_SQLITE_SCHEMA = [
    """CREATE TABLE IF NOT EXISTS coupons (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        percent_off INTEGER NOT NULL,
        kinds TEXT NOT NULL,
        max_uses INTEGER,
        max_uses_per_account INTEGER NOT NULL DEFAULT 1,
        ends_at TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        report_kind TEXT NOT NULL,
        report_hash TEXT NOT NULL,
        price INTEGER NOT NULL,
        currency TEXT NOT NULL,
        coupon_id TEXT,
        percent_off INTEGER NOT NULL DEFAULT 0,
        amount_paid INTEGER NOT NULL,
        method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'paid',
        created_at TEXT NOT NULL,
        provider TEXT,
        provider_ref TEXT
    )""",
    "CREATE UNIQUE INDEX IF NOT EXISTS orders_one_per_report "
    "ON orders (user_id, report_kind, report_hash) WHERE status = 'paid'",
    "CREATE INDEX IF NOT EXISTS orders_coupon ON orders (coupon_id)",
    """CREATE TABLE IF NOT EXISTS coupon_misses (
        user_id TEXT NOT NULL,
        at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS coupon_misses_user ON coupon_misses (user_id, at)",
    """CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        report_kind TEXT NOT NULL,
        report_hash TEXT NOT NULL,
        price INTEGER NOT NULL,
        currency TEXT NOT NULL,
        coupon_id TEXT,
        percent_off INTEGER NOT NULL DEFAULT 0,
        amount INTEGER NOT NULL,
        provider TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS payments_user ON payments (user_id, report_kind, report_hash)",
    "CREATE INDEX IF NOT EXISTS payments_coupon ON payments (coupon_id)",
]

_COUPON_COLUMNS = (
    "id, code, percent_off, kinds, max_uses, max_uses_per_account, ends_at, active, note, "
    "created_at"
)
_ORDER_COLUMNS = (
    "o.id, o.report_kind, o.report_hash, o.price, o.currency, c.code, o.percent_off, "
    "o.amount_paid, o.method, o.created_at, o.provider"
)
_PAYMENT_COLUMNS = (
    "id, report_kind, report_hash, price, currency, percent_off, amount, provider, status, "
    "created_at"
)


class OrderStore:
    """See `sqlite_orders` and `postgres_orders` for the two ways to make one."""

    def __init__(
        self,
        dialect: _Dialect,
        connect: Callable[[], AbstractContextManager[Any]],
        clock: Clock = _utc_now,
    ) -> None:
        self._d = dialect
        self._connect = connect
        self.clock = clock

    def _ts(self, value: dt.datetime | None) -> Any:
        if value is None:
            return None
        return value.isoformat() if self._d is _SQLITE else value

    @staticmethod
    def _read_ts(value: Any) -> dt.datetime:
        if isinstance(value, str):
            return dt.datetime.fromisoformat(value)
        stamp: dt.datetime = value
        return stamp.astimezone(dt.UTC)

    def _run(self, db: Any, statement: str, params: Sequence[Any] = ()) -> Any:
        return db.execute(self._d.sql(statement), tuple(params))

    # Coupons, for the owner's script (backend/scripts/coupons.py)

    def create_coupon(
        self,
        code: str,
        percent_off: int,
        kinds: Sequence[ReportKind] = REPORT_KINDS,
        max_uses: int | None = None,
        max_uses_per_account: int = 1,
        ends_at: dt.datetime | None = None,
        note: str = "",
    ) -> Coupon:
        """Adds a coupon. Raises ValueError for a code already taken or a value out of range."""
        normal = normalise_code(code)
        if not normal or len(normal) > MAX_CODE:
            raise ValueError(f"a code needs 1 to {MAX_CODE} letters or digits")
        if not 1 <= percent_off <= 100:
            raise ValueError("percent off must be between 1 and 100")
        chosen = tuple(kind for kind in REPORT_KINDS if kind in kinds)
        if not chosen or len(chosen) != len(set(kinds)):
            raise ValueError(f"reports must be some of {', '.join(REPORT_KINDS)}")
        if max_uses is not None and max_uses < 0:
            raise ValueError("the total limit cannot be below 0")
        if max_uses_per_account < 1:
            raise ValueError("each account needs at least 1 use")
        if ends_at is not None and ends_at.tzinfo is None:
            raise ValueError("the end date needs a time zone")
        coupon = Coupon(
            id=str(uuid.uuid4()),
            code=normal,
            percent_off=percent_off,
            kinds=chosen,
            max_uses=max_uses,
            max_uses_per_account=max_uses_per_account,
            ends_at=ends_at,
            active=True,
            note=note,
            created_at=self.clock(),
            uses=0,
        )
        with self._connect() as db:
            taken = self._run(db, "SELECT 1 FROM {coupons} WHERE code = ?", (normal,)).fetchone()
            if taken is not None:
                raise ValueError(f"the code {normal!r} is already taken")
            self._run(
                db,
                f"INSERT INTO {{coupons}} ({_COUPON_COLUMNS}) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    coupon.id,
                    coupon.code,
                    coupon.percent_off,
                    ",".join(coupon.kinds),
                    coupon.max_uses,
                    coupon.max_uses_per_account,
                    self._ts(coupon.ends_at),
                    True,
                    coupon.note,
                    self._ts(coupon.created_at),
                ),
            )
        return coupon

    def list_coupons(self) -> list[Coupon]:
        with self._connect() as db:
            rows = self._run(
                db, f"SELECT {_COUPON_COLUMNS} FROM {{coupons}} ORDER BY created_at, code"
            ).fetchall()
            return [self._coupon(db, row) for row in rows]

    def set_active(self, code: str, active: bool) -> bool:
        """Switches a coupon on or off. False when there is no such code."""
        with self._connect() as db:
            cursor = self._run(
                db,
                "UPDATE {coupons} SET active = ? WHERE code = ?",
                (active, normalise_code(code)),
            )
            return bool(cursor.rowcount)

    def _coupon(self, db: Any, row: Sequence[Any]) -> Coupon:
        (coupon_id, code, percent, kinds, max_uses, per_account, ends, active, note, created) = row
        (uses,) = self._run(
            db,
            "SELECT COUNT(*) FROM {orders} WHERE coupon_id = ? AND status = 'paid'",
            (str(coupon_id),),
        ).fetchone()
        return Coupon(
            id=str(coupon_id),
            code=code,
            percent_off=int(percent),
            kinds=tuple(cast(ReportKind, kind) for kind in kinds.split(",")),
            max_uses=max_uses,
            max_uses_per_account=int(per_account),
            ends_at=None if ends is None else self._read_ts(ends),
            active=bool(active),
            note=note,
            created_at=self._read_ts(created),
            uses=int(uses),
        )

    # Using a coupon

    def _checked(
        self,
        db: Any,
        user_id: str | None,
        code: str,
        kind: ReportKind,
        now: dt.datetime,
        lock: bool,
        report_hash: str = "",
    ) -> Coupon:
        """The coupon behind `code` if this account may use it on this kind of report. With no
        account yet (`user_id` None), only the limits that do not depend on one are checked."""
        normal = normalise_code(code)
        if not normal or len(normal) > MAX_CODE:
            raise CouponRefused("unknown")
        row = self._run(
            db,
            f"SELECT {_COUPON_COLUMNS} FROM {{coupons}} WHERE code = ?"
            + (self._d.lock if lock else ""),
            (normal,),
        ).fetchone()
        if row is None:
            raise CouponRefused("unknown")
        coupon = self._coupon(db, row)
        if not coupon.active or (coupon.ends_at is not None and coupon.ends_at <= now):
            raise CouponRefused("ended")
        if kind not in coupon.kinds:
            raise CouponRefused("wrong_report")
        # A payment on its way holds one use. This account's own payment for this same report
        # does not: starting again replaces it. With no report named (the price after Apply),
        # none of its own do.
        held = self._run(
            db,
            "SELECT user_id, report_kind, report_hash FROM {payments} "
            "WHERE coupon_id = ? AND status = 'pending' AND created_at > ?",
            (coupon.id, self._ts(now - PAYMENT_HOLDS)),
        ).fetchall()
        others = [
            str(who)
            for who, held_kind, held_hash in held
            if str(who) != user_id
            or (report_hash and (held_kind, held_hash) != (kind, report_hash))
        ]
        if coupon.max_uses is not None and coupon.uses + len(others) >= coupon.max_uses:
            raise CouponRefused("used_up")
        if user_id is None:
            return coupon
        (mine,) = self._run(
            db,
            "SELECT COUNT(*) FROM {orders} WHERE coupon_id = ? AND user_id = ? AND status = 'paid'",
            (coupon.id, user_id),
        ).fetchone()
        if int(mine) + others.count(user_id) >= coupon.max_uses_per_account:
            raise CouponRefused("account_limit")
        return coupon

    def check_coupon(self, user_id: str | None, code: str, kind: ReportKind) -> Coupon:
        """The coupon, if this account may use it on this kind of report. Raises
        CouponRefused. Uses nothing up: the price shown after Apply."""
        with self._connect() as db:
            return self._checked(db, user_id, code, kind, self.clock(), lock=False)

    def redeem(
        self, user_id: str, code: str, kind: ReportKind, report_hash: str, price: Price
    ) -> tuple[Order, bool]:
        """Unlocks one report with a free coupon: one use, one order, kept together.

        A report this account already paid for gives back its order and uses nothing (the
        second value is False). Raises CouponRefused, or PaymentNeeded for a coupon that
        leaves something to pay.
        """
        now = self.clock()
        with self._connect() as db:
            existing = self._paid(db, user_id, kind, report_hash)
            if existing is not None:
                return existing, False
            # Held until the order is in, so two unlocks at once cannot pass the limits.
            coupon = self._checked(db, user_id, code, kind, now, True, report_hash)
            # The amount, not the percentage, decides: anything left to pay unlocks nothing.
            if discounted(price, coupon.percent_off).amount > 0:
                raise PaymentNeeded(coupon)
            order = Order(
                id=str(uuid.uuid4()),
                report_kind=kind,
                report_hash=report_hash,
                price=price,
                coupon_code=coupon.code,
                percent_off=coupon.percent_off,
                amount_paid=discounted(price, coupon.percent_off).amount,
                method="coupon",
                created_at=now,
            )
            self._run(
                db,
                "INSERT INTO {orders} (id, user_id, report_kind, report_hash, price, currency, "
                "coupon_id, percent_off, amount_paid, method, status, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)",
                (
                    order.id,
                    user_id,
                    kind,
                    report_hash,
                    price.amount,
                    price.currency,
                    coupon.id,
                    order.percent_off,
                    order.amount_paid,
                    order.method,
                    self._ts(now),
                ),
            )
        return order, True

    # Payments

    def start_payment(
        self,
        user_id: str,
        code: str | None,
        kind: ReportKind,
        report_hash: str,
        price: Price,
        provider: str,
    ) -> Payment:
        """Starts paying for one report: the amount is worked out here, from the price list and
        the coupon. Unlocks nothing. A payment this account left open for the same report is
        cancelled. Raises AlreadyPaid, CouponRefused, or NothingToPay when the coupon makes the
        report free.
        """
        now = self.clock()
        with self._connect() as db:
            if self._paid(db, user_id, kind, report_hash) is not None:
                raise AlreadyPaid
            coupon = (
                self._checked(db, user_id, code, kind, now, True, report_hash) if code else None
            )
            percent = coupon.percent_off if coupon else 0
            amount = discounted(price, percent).amount
            if amount <= 0:
                raise NothingToPay
            payment = Payment(
                id=str(uuid.uuid4()),
                report_kind=kind,
                report_hash=report_hash,
                price=price,
                percent_off=percent,
                amount=amount,
                provider=provider,
                status="pending",
                created_at=now,
            )
            self._run(
                db,
                "UPDATE {payments} SET status = 'cancelled', updated_at = ? WHERE user_id = ? "
                "AND report_kind = ? AND report_hash = ? AND status = 'pending'",
                (self._ts(now), user_id, kind, report_hash),
            )
            self._run(
                db,
                "INSERT INTO {payments} (id, user_id, report_kind, report_hash, price, currency, "
                "coupon_id, percent_off, amount, provider, status, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
                (
                    payment.id,
                    user_id,
                    kind,
                    report_hash,
                    price.amount,
                    price.currency,
                    coupon.id if coupon else None,
                    percent,
                    amount,
                    provider,
                    self._ts(now),
                    self._ts(now),
                ),
            )
        return payment

    def payment(self, user_id: str, payment_id: str) -> Payment | None:
        """One of this account's payments. Anyone else's is not there."""
        with self._connect() as db:
            row = self._run(
                db,
                f"SELECT {_PAYMENT_COLUMNS} FROM {{payments}} WHERE id = ? AND user_id = ?",
                (payment_id, user_id),
            ).fetchone()
        return None if row is None else self._payment(row)

    def settle(
        self,
        provider: str,
        payment_id: str,
        outcome: Outcome,
        amount: int,
        currency: str,
        reference: str,
    ) -> Payment:
        """Records what the provider says became of a payment, and makes the order when it was
        paid. The one place a payment unlocks anything. Call it only with a notice whose
        signature was checked (app/payments).

        The provider, amount and currency must be the ones the payment was started with, or
        WrongPayment is raised and nothing changes. The same notice again changes nothing. Money
        that arrives after the payment was cancelled or failed here still counts: it was paid.
        """
        now = self.clock()
        with self._connect() as db:
            row = self._run(
                db,
                f"SELECT {_PAYMENT_COLUMNS}, user_id, coupon_id FROM {{payments}} WHERE id = ?"
                + self._d.lock,
                (payment_id,),
            ).fetchone()
            if row is None:
                raise WrongPayment("no such payment")
            payment = self._payment(row[:-2])
            user_id, coupon_id = str(row[-2]), row[-1]
            if payment.provider != provider:
                raise WrongPayment("from another provider")
            if (amount, currency) != (payment.amount, payment.price.currency):
                raise WrongPayment("not the amount that was asked")
            if payment.status == "paid" or (outcome != "paid" and payment.status != "pending"):
                return payment
            self._run(
                db,
                "UPDATE {payments} SET status = ?, updated_at = ? WHERE id = ?",
                (outcome, self._ts(now), payment_id),
            )
            # Already unlocked some other way (a free code meanwhile): the order stays one.
            paid_before = self._paid(db, user_id, payment.report_kind, payment.report_hash)
            if outcome == "paid" and paid_before is not None:
                log.warning("payment %s is for a report already paid for: refund it", payment_id)
            elif outcome == "paid":
                self._run(
                    db,
                    "INSERT INTO {orders} (id, user_id, report_kind, report_hash, price, "
                    "currency, coupon_id, percent_off, amount_paid, method, status, created_at, "
                    "provider, provider_ref) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'payment', 'paid', ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        user_id,
                        payment.report_kind,
                        payment.report_hash,
                        payment.price.amount,
                        payment.price.currency,
                        None if coupon_id is None else str(coupon_id),
                        payment.percent_off,
                        payment.amount,
                        self._ts(now),
                        provider,
                        reference,
                    ),
                )
        return replace(payment, status=outcome)

    def _payment(self, row: Sequence[Any]) -> Payment:
        (payment_id, kind, report_hash, price, currency, percent, amount, provider, state, at) = row
        return Payment(
            id=str(payment_id),
            report_kind=kind,
            report_hash=report_hash,
            price=Price(int(price), cast(Currency, currency)),
            percent_off=int(percent),
            amount=int(amount),
            provider=provider,
            status=state,
            created_at=self._read_ts(at),
        )

    # Accounts

    def move_user(self, from_user: str, to_user: str) -> int:
        """Gives a guest's orders to the Google account the guest joined, with the payments and
        the wrong guesses. A report the account has paid for itself keeps its own order. Returns
        how many orders moved. Moving again changes nothing."""
        if from_user == to_user:
            return 0
        with self._connect() as db:
            cursor = self._run(
                db,
                "UPDATE {orders} AS moved SET user_id = ? WHERE moved.user_id = ? "
                "AND moved.status = 'paid' AND NOT EXISTS (SELECT 1 FROM {orders} own "
                "WHERE own.user_id = ? AND own.status = 'paid' "
                "AND own.report_kind = moved.report_kind "
                "AND own.report_hash = moved.report_hash)",
                (to_user, from_user, to_user),
            )
            moved = int(cursor.rowcount)
            for table in ("{payments}", "{coupon_misses}"):
                self._run(
                    db, f"UPDATE {table} SET user_id = ? WHERE user_id = ?", (to_user, from_user)
                )
        return moved

    def forget_payments(self, user_id: str) -> None:
        """For a deleted account. Its orders stay (sales records), its payments do not.
        PostgreSQL also does this through the foreign key."""
        with self._connect() as db:
            self._run(db, "DELETE FROM {payments} WHERE user_id = ?", (user_id,))

    # Wrong guesses

    def record_miss(self, user_id: str) -> None:
        now = self.clock()
        with self._connect() as db:
            # Only the last hour counts; older misses go.
            self._run(
                db,
                "DELETE FROM {coupon_misses} WHERE user_id = ? AND at <= ?",
                (user_id, self._ts(now - dt.timedelta(hours=1))),
            )
            self._run(
                db,
                "INSERT INTO {coupon_misses} (user_id, at) VALUES (?, ?)",
                (user_id, self._ts(now)),
            )

    def misses_last_hour(self, user_id: str) -> int:
        since = self.clock() - dt.timedelta(hours=1)
        with self._connect() as db:
            (count,) = self._run(
                db,
                "SELECT COUNT(*) FROM {coupon_misses} WHERE user_id = ? AND at > ?",
                (user_id, self._ts(since)),
            ).fetchone()
        return int(count)

    # The paid check

    def _paid(self, db: Any, user_id: str, kind: str, report_hash: str) -> Order | None:
        row = self._run(
            db,
            f"SELECT {_ORDER_COLUMNS} FROM {{orders}} o "
            "LEFT JOIN {coupons} c ON c.id = o.coupon_id "
            "WHERE o.user_id = ? AND o.report_kind = ? AND o.report_hash = ? "
            "AND o.status = 'paid'",
            (user_id, kind, report_hash),
        ).fetchone()
        return None if row is None else self._order(row)

    def paid_order(self, user_id: str, kind: str, report_hash: str) -> Order | None:
        """This account's order for the report, if it has paid for it."""
        with self._connect() as db:
            return self._paid(db, user_id, kind, report_hash)

    def paid_count(self, user_id: str) -> int:
        """How many reports this account has paid for: each adds a chat allowance (docs/21)."""
        with self._connect() as db:
            (count,) = self._run(
                db,
                "SELECT COUNT(*) FROM {orders} WHERE user_id = ? AND status = 'paid'",
                (user_id,),
            ).fetchone()
        return int(count)

    def void(self, order_id: str) -> bool:
        """Undoes an unlock (misuse): the report is no longer paid and the coupon use comes back."""
        with self._connect() as db:
            cursor = self._run(
                db,
                "UPDATE {orders} SET status = 'void' WHERE id = ? AND status = 'paid'",
                (order_id,),
            )
            return bool(cursor.rowcount)

    def _order(self, row: Sequence[Any]) -> Order:
        (
            order_id,
            kind,
            report_hash,
            price,
            currency,
            code,
            percent,
            paid,
            method,
            created,
            provider,
        ) = row
        return Order(
            id=str(order_id),
            report_kind=kind,
            report_hash=report_hash,
            price=Price(int(price), cast(Currency, currency)),
            coupon_code=code,
            percent_off=int(percent),
            amount_paid=int(paid),
            method=method,
            created_at=self._read_ts(created),
            provider=provider,
        )


def sqlite_orders(path: Path, clock: Clock = _utc_now) -> OrderStore:
    """A store in a SQLite file, making its tables if they are not there yet."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lock = threading.Lock()

    @contextmanager
    def connect() -> Iterator[sqlite3.Connection]:
        with lock:
            db = sqlite3.connect(path)
            try:
                with db:  # commits, or rolls back on error
                    yield db
            finally:
                db.close()

    with connect() as db:
        for statement in _SQLITE_SCHEMA:
            db.execute(statement)
        # A file made before payments gets the new columns, as the migration does.
        columns = {row[1] for row in db.execute("PRAGMA table_info(orders)")}
        for column in ("provider", "provider_ref"):
            if column not in columns:
                db.execute(f"ALTER TABLE orders ADD COLUMN {column} TEXT")
    return OrderStore(_SQLITE, connect, clock)


def postgres_orders(url: str, clock: Clock = _utc_now) -> OrderStore:
    """A store in the `sidera` schema. Raises MissingTables when the migrations are not applied."""
    postgres.require_tables(url, TABLES)
    return OrderStore(_POSTGRES, lambda: postgres.connect(url), clock)
