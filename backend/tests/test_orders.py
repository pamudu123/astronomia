"""Coupons and orders (docs/18, section 4), in SQLite and in PostgreSQL."""

import datetime as dt
import sqlite3
import uuid
from collections.abc import Callable, Iterator
from pathlib import Path

import psycopg
import pytest

from app.store.accounts import User
from app.store.orders import (
    AlreadyPaid,
    CouponRefused,
    NothingToPay,
    OrderStore,
    Outcome,
    Payment,
    PaymentNeeded,
    WrongPayment,
    normalise_code,
    postgres_orders,
    sqlite_orders,
)
from app.tiers import PAID_FEATURES, report_access
from app.tiers.prices import Price, ReportKind
from tests.pg import migrate, need_postgres

START = dt.datetime(2026, 11, 21, 8, 0, tzinfo=dt.UTC)
LKR = Price(80_000, "LKR")
NewUser = Callable[[], str]


class Clock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> dt.datetime:
        return self.now

    def advance(self, **delta: float) -> None:
        self.now += dt.timedelta(**delta)


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture(params=["sqlite", "postgres"])
def store(request: pytest.FixtureRequest, tmp_path: Path, clock: Clock) -> Iterator[OrderStore]:
    if request.param == "sqlite":
        yield sqlite_orders(tmp_path / "orders.sqlite", clock)
        return
    url = need_postgres()
    migrate(url)
    yield postgres_orders(url, clock)


@pytest.fixture
def new_user(store: OrderStore) -> NewUser:
    """Makes account ids. On PostgreSQL an order needs its account in sidera.users."""
    url = need_postgres() if store._d.schema else None

    def make() -> str:
        user_id = str(uuid.uuid4())
        if url:
            with psycopg.connect(url) as db:
                db.execute(
                    "INSERT INTO sidera.users (id, kind, created_at, last_seen_at) "
                    "VALUES (%s, 'google', now(), now())",
                    (user_id,),
                )
        return user_id

    return make


def test_codes_ignore_case_and_spaces() -> None:
    assert normalise_code("  Pam udu ") == "pamudu"
    assert normalise_code("PAMUDU") == "pamudu"
    assert normalise_code("\tpa\nmudu") == "pamudu"


def test_create_and_list_coupons(store: OrderStore) -> None:
    ends = dt.datetime(2027, 7, 1, tzinfo=dt.UTC)
    made = store.create_coupon(
        "Pamudu", 100, max_uses=200, max_uses_per_account=10, ends_at=ends, note="friends"
    )
    assert made.code == "pamudu"
    store.create_coupon("SIDERA 20", 20, ["porondam"])
    listed = {c.code: c for c in store.list_coupons()}
    assert set(listed) == {"pamudu", "sidera20"}
    pamudu = listed["pamudu"]
    assert (pamudu.percent_off, pamudu.kinds, pamudu.max_uses) == (
        100,
        ("hadahan", "porondam"),
        200,
    )
    assert (pamudu.max_uses_per_account, pamudu.ends_at, pamudu.active) == (10, ends, True)
    assert (pamudu.note, pamudu.uses) == ("friends", 0)
    assert listed["sidera20"].kinds == ("porondam",)
    assert listed["sidera20"].max_uses is None


@pytest.mark.parametrize(
    ("code", "percent", "kinds"),
    [
        ("", 100, ["hadahan"]),
        ("   ", 100, ["hadahan"]),
        ("x" * 65, 100, ["hadahan"]),
        ("ok", 0, ["hadahan"]),
        ("ok", 101, ["hadahan"]),
        ("ok", 50, []),
        ("ok", 50, ["nakath"]),
    ],
)
def test_bad_coupons_are_refused(
    store: OrderStore, code: str, percent: int, kinds: list[ReportKind]
) -> None:
    with pytest.raises(ValueError):
        store.create_coupon(code, percent, kinds)


def test_a_code_is_taken_once(store: OrderStore) -> None:
    store.create_coupon("pamudu", 100)
    with pytest.raises(ValueError, match="already taken"):
        store.create_coupon("PAMUDU ", 50)


def test_a_free_coupon_unlocks_one_report(store: OrderStore, new_user: NewUser) -> None:
    store.create_coupon("pamudu", 100, max_uses_per_account=10)
    user = new_user()
    assert store.paid_order(user, "hadahan", "h1") is None
    order, created = store.redeem(user, " PamUdu", "hadahan", "h1", LKR)
    assert created
    assert (order.price, order.amount_paid, order.percent_off) == (LKR, 0, 100)
    assert (order.method, order.coupon_code, order.report_kind) == ("coupon", "pamudu", "hadahan")
    assert store.paid_order(user, "hadahan", "h1") == order
    # Only that report: another one, or the same one for another account, is not paid.
    assert store.paid_order(user, "hadahan", "h2") is None
    assert store.paid_order(user, "porondam", "h1") is None
    assert store.paid_order(new_user(), "hadahan", "h1") is None


def test_unlocking_a_paid_report_again_uses_nothing(store: OrderStore, new_user: NewUser) -> None:
    store.create_coupon("pamudu", 100, max_uses_per_account=1)
    user = new_user()
    first, _ = store.redeem(user, "pamudu", "hadahan", "h1", LKR)
    again, created = store.redeem(user, "pamudu", "hadahan", "h1", LKR)
    assert (again, created) == (first, False)
    assert store.list_coupons()[0].uses == 1


def test_unknown_codes(store: OrderStore, new_user: NewUser) -> None:
    user = new_user()
    for code in ("nope", "", "x" * 200):
        with pytest.raises(CouponRefused) as refused:
            store.check_coupon(user, code, "hadahan")
        assert refused.value.reason == "unknown"


def test_a_switched_off_coupon_has_ended(store: OrderStore, new_user: NewUser) -> None:
    store.create_coupon("pamudu", 100)
    user = new_user()
    assert store.set_active("PAMUDU", False)
    with pytest.raises(CouponRefused) as refused:
        store.redeem(user, "pamudu", "hadahan", "h1", LKR)
    assert refused.value.reason == "ended"
    assert store.set_active("pamudu", True)
    store.redeem(user, "pamudu", "hadahan", "h1", LKR)
    assert not store.set_active("nope", False)


def test_a_coupon_ends_on_its_end_date(store: OrderStore, clock: Clock, new_user: NewUser) -> None:
    store.create_coupon("pamudu", 100, ends_at=START + dt.timedelta(hours=1))
    user = new_user()
    assert store.check_coupon(user, "pamudu", "hadahan").code == "pamudu"
    clock.advance(hours=1)
    with pytest.raises(CouponRefused) as refused:
        store.check_coupon(user, "pamudu", "hadahan")
    assert refused.value.reason == "ended"


def test_a_coupon_only_for_its_reports(store: OrderStore, new_user: NewUser) -> None:
    store.create_coupon("match", 100, ["porondam"])
    user = new_user()
    with pytest.raises(CouponRefused) as refused:
        store.redeem(user, "match", "hadahan", "h1", LKR)
    assert refused.value.reason == "wrong_report"
    store.redeem(user, "match", "porondam", "h1", LKR)


def test_the_total_limit(store: OrderStore, new_user: NewUser) -> None:
    store.create_coupon("two", 100, max_uses=2, max_uses_per_account=5)
    store.redeem(new_user(), "two", "hadahan", "h1", LKR)
    store.redeem(new_user(), "two", "hadahan", "h1", LKR)
    with pytest.raises(CouponRefused) as refused:
        store.redeem(new_user(), "two", "hadahan", "h1", LKR)
    assert refused.value.reason == "used_up"


def test_the_limit_per_account_and_one_use_per_report(store: OrderStore, new_user: NewUser) -> None:
    store.create_coupon("pamudu", 100, max_uses_per_account=2)
    user = new_user()
    store.redeem(user, "pamudu", "hadahan", "h1", LKR)
    store.redeem(user, "pamudu", "porondam", "h2", LKR)
    with pytest.raises(CouponRefused) as refused:
        store.redeem(user, "pamudu", "hadahan", "h3", LKR)
    assert refused.value.reason == "account_limit"
    # Someone else still can.
    store.redeem(new_user(), "pamudu", "hadahan", "h3", LKR)
    assert store.list_coupons()[0].uses == 3


def test_a_discount_needs_a_payment_that_does_not_exist_yet(
    store: OrderStore, new_user: NewUser
) -> None:
    store.create_coupon("sidera20", 20)
    user = new_user()
    assert store.check_coupon(user, "sidera20", "hadahan").percent_off == 20
    with pytest.raises(PaymentNeeded):
        store.redeem(user, "sidera20", "hadahan", "h1", LKR)
    assert store.paid_order(user, "hadahan", "h1") is None
    assert store.list_coupons()[0].uses == 0


def test_a_void_order_gives_the_use_back(store: OrderStore, new_user: NewUser) -> None:
    store.create_coupon("once", 100, max_uses=1)
    user = new_user()
    order, _ = store.redeem(user, "once", "hadahan", "h1", LKR)
    assert store.void(order.id)
    assert not store.void(order.id)
    assert store.paid_order(user, "hadahan", "h1") is None
    again, created = store.redeem(user, "once", "hadahan", "h1", LKR)
    assert created and again.id != order.id


def test_wrong_guesses_count_for_an_hour(
    store: OrderStore, clock: Clock, new_user: NewUser
) -> None:
    user, other = new_user(), new_user()
    for _ in range(3):
        store.record_miss(user)
        clock.advance(minutes=20)
    assert store.misses_last_hour(user) == 2  # the first is an hour old
    assert store.misses_last_hour(other) == 0
    clock.advance(hours=1)
    assert store.misses_last_hour(user) == 0


def test_the_paid_check(store: OrderStore, new_user: NewUser) -> None:
    store.create_coupon("pamudu", 100)
    user = User(new_user(), "google")
    # Paid features switched off: everyone has everything, paid or not.
    off = report_access(store, None, "hadahan", "h1", paid_reports_on=False)
    assert (off.paid, off.features) == (False, PAID_FEATURES)
    # Switched on: nothing paid until the report is unlocked.
    assert report_access(store, None, "hadahan", "h1", paid_reports_on=True).features == ()
    assert report_access(store, user, "hadahan", "h1", paid_reports_on=True).features == ()
    order, _ = store.redeem(user.id, "pamudu", "hadahan", "h1", LKR)
    on = report_access(store, user, "hadahan", "h1", paid_reports_on=True)
    assert (on.paid, on.order_id, on.features) == (True, order.id, PAID_FEATURES)
    assert on.allows("ai_reading")
    assert not report_access(store, user, "hadahan", "h2", paid_reports_on=True).paid


# Payments


def start(store: OrderStore, user: str, code: str | None = None, report: str = "h1") -> Payment:
    return store.start_payment(user, code, "hadahan", report, LKR, "mock")


def settle(store: OrderStore, payment: Payment, outcome: Outcome = "paid") -> Payment:
    return store.settle("mock", payment.id, outcome, payment.amount, "LKR", "ref-1")


def test_a_payment_makes_an_order_only_once_paid(store: OrderStore, new_user: NewUser) -> None:
    user = new_user()
    store.create_coupon("sidera20", 20)
    payment = start(store, user, "SIDERA 20")
    assert (payment.amount, payment.percent_off, payment.status) == (64_000, 20, "pending")
    assert store.paid_order(user, "hadahan", "h1") is None
    assert store.payment(user, payment.id) == payment
    assert store.payment(new_user(), payment.id) is None

    assert settle(store, payment).status == "paid"
    order = store.paid_order(user, "hadahan", "h1")
    assert order is not None
    assert (order.method, order.provider, order.coupon_code) == ("payment", "mock", "sidera20")
    assert (order.price, order.amount_paid, order.percent_off) == (LKR, 64_000, 20)
    # The same notice again makes nothing more.
    assert settle(store, payment).status == "paid"
    assert store.paid_count(user) == 1
    # Nor does a later one take it away.
    assert settle(store, payment, "failed").status == "paid"
    with pytest.raises(AlreadyPaid):
        start(store, user)


def test_a_notice_that_does_not_match_changes_nothing(store: OrderStore, new_user: NewUser) -> None:
    user = new_user()
    payment = start(store, user)
    for provider, payment_id, amount, currency in [
        ("other", payment.id, payment.amount, "LKR"),
        ("mock", str(uuid.uuid4()), payment.amount, "LKR"),
        ("mock", payment.id, 1, "LKR"),
        ("mock", payment.id, payment.amount, "USD"),
    ]:
        with pytest.raises(WrongPayment):
            store.settle(provider, payment_id, "paid", amount, currency, "ref")
    assert store.paid_order(user, "hadahan", "h1") is None
    assert store.payment(user, payment.id) == payment


@pytest.mark.parametrize("outcome", ["failed", "cancelled"])
def test_an_unpaid_payment_makes_no_order(
    store: OrderStore, new_user: NewUser, outcome: Outcome
) -> None:
    user = new_user()
    payment = start(store, user)
    assert settle(store, payment, outcome).status == outcome
    assert store.paid_order(user, "hadahan", "h1") is None
    assert store.paid_count(user) == 0


def test_a_free_coupon_is_not_a_payment(store: OrderStore, new_user: NewUser) -> None:
    user = new_user()
    store.create_coupon("pamudu", 100)
    with pytest.raises(NothingToPay):
        start(store, user, "pamudu")
    with pytest.raises(CouponRefused):
        start(store, user, "nope")


def test_a_discount_that_rounds_to_nothing_is_free(store: OrderStore, new_user: NewUser) -> None:
    """The amount decides, not the percentage."""
    store.create_coupon("almost", 99)
    tiny = Price(1, "LKR")
    user = new_user()
    with pytest.raises(NothingToPay):
        store.start_payment(user, "almost", "hadahan", "h1", tiny, "mock")
    order, made = store.redeem(user, "almost", "hadahan", "h1", tiny)
    assert (made, order.amount_paid) == (True, 0)


def test_an_open_payment_holds_its_coupon_use(
    store: OrderStore, new_user: NewUser, clock: Clock
) -> None:
    store.create_coupon("once", 20, max_uses=1)
    user, other = new_user(), new_user()
    first = start(store, user, "once")
    with pytest.raises(CouponRefused, match="used_up"):
        start(store, other, "once", "h2")
    # The same buyer may look again, and start again for the same report.
    assert store.check_coupon(user, "once", "hadahan").code == "once"
    second = start(store, user, "once")
    assert store.payment(user, first.id) is not None
    found = store.payment(user, first.id)
    assert found is not None
    assert found.status == "cancelled"
    # Left open for an hour, it holds nothing any more.
    clock.advance(minutes=61)
    third = start(store, other, "once", "h2")
    settle(store, third)
    with pytest.raises(CouponRefused, match="used_up"):
        start(store, user, "once")
    # Money that arrives late was still paid.
    assert settle(store, second).status == "paid"
    assert store.paid_order(user, "hadahan", "h1") is not None


def test_one_account_cannot_hold_a_code_past_its_limit(
    store: OrderStore, new_user: NewUser
) -> None:
    store.create_coupon("sidera20", 20, max_uses_per_account=1)
    user = new_user()
    start(store, user, "sidera20", "h1")
    with pytest.raises(CouponRefused, match="account_limit"):
        start(store, user, "sidera20", "h2")


def test_paying_for_what_a_code_unlocked_meanwhile_stays_one_order(
    store: OrderStore, new_user: NewUser
) -> None:
    user = new_user()
    store.create_coupon("pamudu", 100)
    payment = start(store, user)
    order, _ = store.redeem(user, "pamudu", "hadahan", "h1", LKR)
    assert settle(store, payment).status == "paid"
    kept = store.paid_order(user, "hadahan", "h1")
    assert kept is not None
    assert kept.id == order.id
    assert store.paid_count(user) == 1


def test_a_guests_orders_move(store: OrderStore, new_user: NewUser) -> None:
    guest, google = new_user(), new_user()
    store.create_coupon("pamudu", 100, max_uses_per_account=5)
    store.redeem(google, "pamudu", "hadahan", "both", LKR)
    store.redeem(guest, "pamudu", "hadahan", "both", LKR)
    store.redeem(guest, "pamudu", "porondam", "match", LKR)
    payment = start(store, guest)
    settle(store, payment)
    opened = start(store, guest, None, "h2")
    store.record_miss(guest)

    assert store.move_user(guest, google) == 2
    assert store.paid_order(google, "hadahan", "h1") is not None
    assert store.paid_order(google, "porondam", "match") is not None
    assert store.paid_count(google) == 3
    assert store.misses_last_hour(google) == 1
    assert store.move_user(guest, google) == 0
    assert store.move_user(google, google) == 0
    # A payment still on its way when the guest joined lands in the account.
    settle(store, opened)
    assert store.paid_order(google, "hadahan", "h2") is not None


def test_a_file_from_before_payments_gets_the_new_columns(tmp_path: Path) -> None:
    path = tmp_path / "old.sqlite"
    with sqlite3.connect(path) as db:
        db.execute(
            "CREATE TABLE orders (id TEXT PRIMARY KEY, user_id TEXT, report_kind TEXT NOT NULL, "
            "report_hash TEXT NOT NULL, price INTEGER NOT NULL, currency TEXT NOT NULL, "
            "coupon_id TEXT, percent_off INTEGER NOT NULL DEFAULT 0, amount_paid INTEGER NOT "
            "NULL, method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'paid', created_at TEXT "
            "NOT NULL)"
        )
    db.close()
    store = sqlite_orders(path)
    settle(store, start(store, "someone"))
    assert store.paid_count("someone") == 1
    assert sqlite_orders(path).paid_count("someone") == 1
