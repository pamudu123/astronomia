"""Accounts and saved reports (docs/16, docs/19).

Sign in is Supabase Auth's: an anonymous user on the first Save, or a Google account. The
backend checks the caller's access token (app/auth.py) and keeps one `users` row per Supabase
user, under the same id, made the first time that user calls. Supabase keeps the sessions, so
this store keeps none, and nothing personal: names and emails stay in Supabase Auth.

Every saved report query filters on the owner, so one account can never read another's reports.

One class for both databases: SQLite for local runs and tests, PostgreSQL (Supabase) on hosts
without a lasting disk (set ASTRONOMIA_DATABASE_URL). The few differences are in `_Dialect`.
SQLite makes its own tables. On PostgreSQL the tables are in the private `sidera` schema and are
made by the migrations in `supabase/migrations/`, never by the app.
"""

import datetime as dt
import json
import sqlite3
import threading
import uuid
from collections.abc import Callable, Iterator, Sequence
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from psycopg.types.json import Jsonb

from app.store import postgres

Clock = Callable[[], dt.datetime]
Kind = Literal["guest", "google"]

SCHEMA_VERSION = 2
# The tables this store uses. Queries name them as {users} and so on; see `_Dialect.sql`.
TABLES = ("users", "saved_reports")
# When the user was last seen is written at most once a day.
SEEN_EVERY = dt.timedelta(days=1)


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


@dataclass(frozen=True)
class User:
    id: str
    kind: Kind


@dataclass(frozen=True)
class SavedSummary:
    id: str
    kind: str
    title: str
    summary: dict[str, Any]
    created_at: dt.datetime
    paid: bool = False  # kept with an order (docs/18): a paid report


@dataclass(frozen=True)
class SavedReport:
    id: str
    kind: str
    title: str
    summary: dict[str, Any]
    created_at: dt.datetime
    input: dict[str, Any]
    snapshot: dict[str, Any]
    paid: bool = False


@dataclass(frozen=True)
class NewReport:
    kind: str
    input: dict[str, Any]
    input_hash: str
    snapshot: dict[str, Any]
    summary: dict[str, Any]
    rules: str


class LimitReached(Exception):
    """The account already holds as many saved reports as it may."""


@dataclass(frozen=True)
class _Dialect:
    """How SQLite and PostgreSQL differ for this store."""

    placeholder: str
    # Where the tables are: None for SQLite's own file, the private schema on PostgreSQL.
    schema: str | None

    def table(self, name: str) -> str:
        return f"{self.schema}.{name}" if self.schema else name

    def sql(self, statement: str) -> str:
        """A query with its {table} names filled in and the right parameter marks."""
        names = {name: self.table(name) for name in TABLES}
        return statement.format(**names).replace("?", self.placeholder)


_SQLITE = _Dialect(placeholder="?", schema=None)
_POSTGRES = _Dialect(placeholder="%s", schema=postgres.SCHEMA)

# SQLite only. PostgreSQL gets its tables from supabase/migrations/.
_SQLITE_SCHEMA = [
    "CREATE TABLE IF NOT EXISTS accounts_schema (version INTEGER NOT NULL)",
    """CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
    )""",
    # The guest cookie's sessions, before sign in moved to Supabase Auth.
    "DROP TABLE IF EXISTS sessions",
    """CREATE TABLE IF NOT EXISTS saved_reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        input TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        summary TEXT NOT NULL,
        rules TEXT NOT NULL,
        purchase_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, input_hash)
    )""",
    "CREATE INDEX IF NOT EXISTS saved_reports_user ON saved_reports (user_id, created_at)",
]


class AccountStore:
    """The store the account and saved report endpoints use. See `sqlite_accounts` and
    `postgres_accounts` for the two ways to make one."""

    def __init__(
        self,
        dialect: _Dialect,
        connect: Callable[[], AbstractContextManager[Any]],
        clock: Clock = _utc_now,
    ) -> None:
        self._d = dialect
        self._connect = connect
        self.clock = clock

    # Values in and out. SQLite keeps text, PostgreSQL its own types.

    def _ts(self, value: dt.datetime) -> Any:
        return value.isoformat() if self._d is _SQLITE else value

    def _json(self, value: dict[str, Any]) -> Any:
        return json.dumps(value, ensure_ascii=False) if self._d is _SQLITE else Jsonb(value)

    @staticmethod
    def _read_ts(value: Any) -> dt.datetime:
        if isinstance(value, str):
            return dt.datetime.fromisoformat(value)
        stamp: dt.datetime = value
        return stamp.astimezone(dt.UTC)

    @staticmethod
    def _read_json(value: Any) -> dict[str, Any]:
        loaded: dict[str, Any] = json.loads(value) if isinstance(value, str) else value
        return loaded

    @staticmethod
    def _read_id(value: Any) -> str:
        """Ids are text in SQLite and uuid on PostgreSQL. Callers always get text."""
        return str(value)

    def _run(self, db: Any, statement: str, params: Sequence[Any] = ()) -> Any:
        return db.execute(self._d.sql(statement), tuple(params))

    # Accounts

    def find_user(self, user_id: str, kind: Kind) -> User | None:
        """The account of a Supabase user, or None when that user has not called before.

        `kind` is what the user's token says now. A guest who linked Google becomes a Google
        account, under the same id, so every report stays. A Google account never goes back to
        guest. When the user was last seen is kept, at most once a day.
        """
        now = self.clock()
        with self._connect() as db:
            return self._find_user(db, user_id, kind, now)

    def _find_user(self, db: Any, user_id: str, kind: Kind, now: dt.datetime) -> User | None:
        row = self._run(
            db, "SELECT kind, last_seen_at FROM {users} WHERE id = ?", (user_id,)
        ).fetchone()
        if row is None:
            return None
        stored, seen = row
        new_kind: Kind = "google" if "google" in (stored, kind) else "guest"
        if new_kind != stored or now - self._read_ts(seen) >= SEEN_EVERY:
            self._run(
                db,
                "UPDATE {users} SET kind = ?, last_seen_at = ? WHERE id = ?",
                (new_kind, self._ts(now), user_id),
            )
        return User(id=user_id, kind=new_kind)

    def add_user(self, user_id: str, kind: Kind) -> User:
        """The account of a Supabase user, made now if it is not there yet."""
        now = self.clock()
        with self._connect() as db:
            self._run(
                db,
                "INSERT INTO {users} (id, kind, created_at, last_seen_at) VALUES (?, ?, ?, ?) "
                "ON CONFLICT (id) DO NOTHING",
                (user_id, kind, self._ts(now), self._ts(now)),
            )
            user = self._find_user(db, user_id, kind, now)
        assert user is not None
        return user

    def move_reports(self, from_user: str, to_user: str) -> int:
        """Moves every report of one account into another, then deletes the first account.

        For a guest who signs in with a Google account that already exists. A report the second
        account already keeps (the same input) is not copied twice. Returns how many moved.
        """
        if from_user == to_user:
            return 0
        with self._connect() as db:
            cursor = self._run(
                db,
                "UPDATE {saved_reports} SET user_id = ?, updated_at = ? WHERE user_id = ? "
                "AND input_hash NOT IN "
                "(SELECT input_hash FROM {saved_reports} WHERE user_id = ?)",
                (to_user, self._ts(self.clock()), from_user, to_user),
            )
            moved = int(cursor.rowcount)
            self._delete_users(db, [from_user])
        return moved

    def delete_user(self, user_id: str) -> None:
        """The account and every saved report."""
        with self._connect() as db:
            self._delete_users(db, [user_id])

    def _delete_users(self, db: Any, user_ids: list[str]) -> None:
        for user_id in user_ids:
            self._run(db, "DELETE FROM {saved_reports} WHERE user_id = ?", (user_id,))
            self._run(db, "DELETE FROM {users} WHERE id = ?", (user_id,))

    # Saved reports

    def save(
        self, user_id: str, report: NewReport, limit: int, purchase_id: str | None = None
    ) -> tuple[SavedSummary, bool]:
        """Keeps a report. Saving the same input again returns the one already kept.

        `purchase_id` is the order that paid for it (app/store/orders.py), if any. A report
        kept free and saved again with one becomes paid. The second value is True when a new
        report was kept. Raises LimitReached when the account is full.
        """
        now = self.clock()
        with self._connect() as db:
            return self._save(db, user_id, report, limit, now, purchase_id)

    def _save(
        self,
        db: Any,
        user_id: str,
        report: NewReport,
        limit: int,
        now: dt.datetime,
        purchase_id: str | None = None,
    ) -> tuple[SavedSummary, bool]:
        existing = self._run(
            db,
            "SELECT id, kind, title, summary, created_at, purchase_id FROM {saved_reports} "
            "WHERE user_id = ? AND input_hash = ?",
            (user_id, report.input_hash),
        ).fetchone()
        if existing is not None:
            if purchase_id is not None and existing[5] != purchase_id:
                self._run(
                    db,
                    "UPDATE {saved_reports} SET purchase_id = ?, updated_at = ? WHERE id = ?",
                    (purchase_id, self._ts(now), existing[0]),
                )
                return self._summary((*existing[:5], purchase_id)), False
            return self._summary(existing), False
        (count,) = self._run(
            db, "SELECT COUNT(*) FROM {saved_reports} WHERE user_id = ?", (user_id,)
        ).fetchone()
        if count >= limit:
            raise LimitReached
        report_id = str(uuid.uuid4())
        self._run(
            db,
            "INSERT INTO {saved_reports} (id, user_id, kind, title, input, input_hash, "
            "snapshot, summary, rules, purchase_id, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                report_id,
                user_id,
                report.kind,
                "",
                self._json(report.input),
                report.input_hash,
                self._json(report.snapshot),
                self._json(report.summary),
                report.rules,
                purchase_id,
                self._ts(now),
                self._ts(now),
            ),
        )
        summary = SavedSummary(
            report_id, report.kind, "", report.summary, now, purchase_id is not None
        )
        return summary, True

    def _summary(self, row: Sequence[Any]) -> SavedSummary:
        report_id, kind, title, summary, created, purchase_id = row
        return SavedSummary(
            self._read_id(report_id),
            kind,
            title,
            self._read_json(summary),
            self._read_ts(created),
            purchase_id is not None,
        )

    def list_saved(self, user_id: str) -> list[SavedSummary]:
        with self._connect() as db:
            rows = self._run(
                db,
                "SELECT id, kind, title, summary, created_at, purchase_id FROM {saved_reports} "
                "WHERE user_id = ? ORDER BY created_at DESC, id",
                (user_id,),
            ).fetchall()
        return [self._summary(row) for row in rows]

    def count_saved(self, user_id: str) -> int:
        with self._connect() as db:
            (count,) = self._run(
                db, "SELECT COUNT(*) FROM {saved_reports} WHERE user_id = ?", (user_id,)
            ).fetchone()
        return int(count)

    def get_saved(self, user_id: str, report_id: str) -> SavedReport | None:
        with self._connect() as db:
            row = self._run(
                db,
                "SELECT id, kind, title, summary, created_at, purchase_id, input, snapshot "
                "FROM {saved_reports} WHERE user_id = ? AND id = ?",
                (user_id, report_id),
            ).fetchone()
        if row is None:
            return None
        summary = self._summary(row[:6])
        return SavedReport(
            id=summary.id,
            kind=summary.kind,
            title=summary.title,
            summary=summary.summary,
            created_at=summary.created_at,
            input=self._read_json(row[6]),
            snapshot=self._read_json(row[7]),
            paid=summary.paid,
        )

    def rename(self, user_id: str, report_id: str, title: str) -> bool:
        with self._connect() as db:
            cursor = self._run(
                db,
                "UPDATE {saved_reports} SET title = ?, updated_at = ? WHERE user_id = ? AND id = ?",
                (title, self._ts(self.clock()), user_id, report_id),
            )
            return bool(cursor.rowcount)

    def delete_saved(self, user_id: str, report_id: str) -> bool:
        with self._connect() as db:
            cursor = self._run(
                db, "DELETE FROM {saved_reports} WHERE user_id = ? AND id = ?", (user_id, report_id)
            )
            return bool(cursor.rowcount)


def sqlite_accounts(path: Path, clock: Clock = _utc_now) -> AccountStore:
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
        if db.execute("SELECT version FROM accounts_schema").fetchone() is None:
            db.execute("INSERT INTO accounts_schema VALUES (?)", (SCHEMA_VERSION,))
    return AccountStore(_SQLITE, connect, clock)


def postgres_accounts(url: str, clock: Clock = _utc_now) -> AccountStore:
    """A store in the `sidera` schema. Raises MissingTables when the migrations are not applied."""
    postgres.require_tables(url, TABLES)
    return AccountStore(_POSTGRES, lambda: postgres.connect(url), clock)
