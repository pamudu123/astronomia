"""Accounts, sessions and saved reports (docs/16).

A guest account is made quietly the first time someone presses Save. It is a random session
code in a cookie, and nothing personal. Google sign in (later) turns a guest into a Google
account and keeps its reports.

Only a hash of the session code is kept, so a copy of this database cannot be turned back into
working sessions. Every saved report query filters on the owner, so one account can never read
another's reports.

One class for both databases: SQLite for local runs and tests, PostgreSQL on hosts without a
lasting disk (set ASTRONOMIA_DATABASE_URL). The few differences are in `_Dialect`.
"""

import datetime as dt
import hashlib
import json
import secrets
import sqlite3
import threading
import uuid
from collections.abc import Callable, Iterator, Sequence
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import psycopg
from psycopg.types.json import Jsonb

Clock = Callable[[], dt.datetime]
Kind = Literal["guest", "google"]

SCHEMA_VERSION = 1
GUEST_SESSION_DAYS = 365
# A guest account nobody has used for this long is deleted with its reports.
GUEST_IDLE_DAYS = 365
# A session is renewed (and its cookie sent again) at most once a day.
RENEW_AFTER = dt.timedelta(days=1)


def _hash(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


@dataclass(frozen=True)
class User:
    id: str
    kind: Kind


@dataclass(frozen=True)
class Session:
    token: str  # goes in the cookie, never stored
    user: User
    expires_at: dt.datetime


@dataclass(frozen=True)
class FoundSession:
    user: User
    expires_at: dt.datetime
    renewed: bool  # True when the cookie should be sent again with the new expiry


@dataclass(frozen=True)
class SavedSummary:
    id: str
    kind: str
    title: str
    summary: dict[str, Any]
    created_at: dt.datetime


@dataclass(frozen=True)
class SavedReport:
    id: str
    kind: str
    title: str
    summary: dict[str, Any]
    created_at: dt.datetime
    input: dict[str, Any]
    snapshot: dict[str, Any]


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

    timestamp: str
    json: str
    placeholder: str

    def sql(self, statement: str) -> str:
        return statement.replace("?", self.placeholder)


_SQLITE = _Dialect(timestamp="TEXT", json="TEXT", placeholder="?")
_POSTGRES = _Dialect(timestamp="TIMESTAMPTZ", json="JSONB", placeholder="%s")


def _schema(d: _Dialect) -> list[str]:
    return [
        "CREATE TABLE IF NOT EXISTS accounts_schema (version INTEGER NOT NULL)",
        f"""CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            google_sub TEXT UNIQUE,
            email TEXT,
            name TEXT,
            created_at {d.timestamp} NOT NULL,
            last_seen_at {d.timestamp} NOT NULL
        )""",
        f"""CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at {d.timestamp} NOT NULL,
            expires_at {d.timestamp} NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)",
        f"""CREATE TABLE IF NOT EXISTS saved_reports (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            input {d.json} NOT NULL,
            input_hash TEXT NOT NULL,
            snapshot {d.json} NOT NULL,
            summary {d.json} NOT NULL,
            rules TEXT NOT NULL,
            purchase_id TEXT,
            created_at {d.timestamp} NOT NULL,
            updated_at {d.timestamp} NOT NULL,
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
        with self._connect() as db:
            for statement in _schema(dialect):
                db.execute(statement)
            if db.execute("SELECT version FROM accounts_schema").fetchone() is None:
                db.execute(self._d.sql("INSERT INTO accounts_schema VALUES (?)"), (SCHEMA_VERSION,))

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

    def _run(self, db: Any, statement: str, params: Sequence[Any] = ()) -> Any:
        return db.execute(self._d.sql(statement), tuple(params))

    # Accounts and sessions

    def create_guest(self) -> Session:
        """A new guest account with its first session. Also clears out old guests."""
        now = self.clock()
        with self._connect() as db:
            return self._insert_guest(db, now)

    def create_guest_with(self, report: NewReport, limit: int) -> tuple[Session, SavedSummary]:
        """A new guest account holding its first report, kept together or not at all.

        A save that fails leaves no empty account behind (and no cookie for one)."""
        now = self.clock()
        with self._connect() as db:
            session = self._insert_guest(db, now)
            item, _ = self._save(db, session.user.id, report, limit, now)
        return session, item

    def _insert_guest(self, db: Any, now: dt.datetime) -> Session:
        user = User(id=str(uuid.uuid4()), kind="guest")
        token = secrets.token_urlsafe(32)
        expires = now + dt.timedelta(days=GUEST_SESSION_DAYS)
        self._purge(db, now)
        self._run(
            db,
            "INSERT INTO users (id, kind, created_at, last_seen_at) VALUES (?, ?, ?, ?)",
            (user.id, user.kind, self._ts(now), self._ts(now)),
        )
        self._run(
            db,
            "INSERT INTO sessions VALUES (?, ?, ?, ?)",
            (_hash(token), user.id, self._ts(now), self._ts(expires)),
        )
        return Session(token=token, user=user, expires_at=expires)

    def find_session(self, token: str) -> FoundSession | None:
        """The account behind a session code, renewing the session once a day."""
        now = self.clock()
        with self._connect() as db:
            row = self._run(
                db,
                "SELECT u.id, u.kind, s.expires_at FROM sessions s "
                "JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
                (_hash(token),),
            ).fetchone()
            if row is None:
                return None
            user_id, kind, expires_raw = row
            expires = self._read_ts(expires_raw)
            if expires <= now:
                self._run(db, "DELETE FROM sessions WHERE token_hash = ?", (_hash(token),))
                return None
            renewed_expiry = now + dt.timedelta(days=GUEST_SESSION_DAYS)
            renew = renewed_expiry - expires >= RENEW_AFTER
            if renew:
                expires = renewed_expiry
                self._run(
                    db,
                    "UPDATE sessions SET expires_at = ? WHERE token_hash = ?",
                    (self._ts(expires), _hash(token)),
                )
                self._run(
                    db, "UPDATE users SET last_seen_at = ? WHERE id = ?", (self._ts(now), user_id)
                )
        return FoundSession(user=User(id=user_id, kind=kind), expires_at=expires, renewed=renew)

    def end_session(self, token: str) -> None:
        with self._connect() as db:
            self._run(db, "DELETE FROM sessions WHERE token_hash = ?", (_hash(token),))

    def delete_user(self, user_id: str) -> None:
        """The account, every session and every saved report."""
        with self._connect() as db:
            self._delete_users(db, [user_id])

    def _delete_users(self, db: Any, user_ids: list[str]) -> None:
        for user_id in user_ids:
            self._run(db, "DELETE FROM saved_reports WHERE user_id = ?", (user_id,))
            self._run(db, "DELETE FROM sessions WHERE user_id = ?", (user_id,))
            self._run(db, "DELETE FROM users WHERE id = ?", (user_id,))

    def _purge(self, db: Any, now: dt.datetime) -> None:
        self._run(db, "DELETE FROM sessions WHERE expires_at <= ?", (self._ts(now),))
        idle_since = now - dt.timedelta(days=GUEST_IDLE_DAYS)
        rows = self._run(
            db,
            "SELECT id FROM users WHERE kind = 'guest' AND last_seen_at <= ?",
            (self._ts(idle_since),),
        ).fetchall()
        self._delete_users(db, [row[0] for row in rows])

    # Saved reports

    def save(self, user_id: str, report: NewReport, limit: int) -> tuple[SavedSummary, bool]:
        """Keeps a report. Saving the same input again returns the one already kept.

        The second value is True when a new report was kept. Raises LimitReached when the
        account is full.
        """
        now = self.clock()
        with self._connect() as db:
            return self._save(db, user_id, report, limit, now)

    def _save(
        self, db: Any, user_id: str, report: NewReport, limit: int, now: dt.datetime
    ) -> tuple[SavedSummary, bool]:
        existing = self._run(
            db,
            "SELECT id, kind, title, summary, created_at FROM saved_reports "
            "WHERE user_id = ? AND input_hash = ?",
            (user_id, report.input_hash),
        ).fetchone()
        if existing is not None:
            return self._summary(existing), False
        (count,) = self._run(
            db, "SELECT COUNT(*) FROM saved_reports WHERE user_id = ?", (user_id,)
        ).fetchone()
        if count >= limit:
            raise LimitReached
        report_id = str(uuid.uuid4())
        self._run(
            db,
            "INSERT INTO saved_reports (id, user_id, kind, title, input, input_hash, "
            "snapshot, summary, rules, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
                self._ts(now),
                self._ts(now),
            ),
        )
        return SavedSummary(report_id, report.kind, "", report.summary, now), True

    def _summary(self, row: Sequence[Any]) -> SavedSummary:
        report_id, kind, title, summary, created = row
        return SavedSummary(
            report_id, kind, title, self._read_json(summary), self._read_ts(created)
        )

    def list_saved(self, user_id: str) -> list[SavedSummary]:
        with self._connect() as db:
            rows = self._run(
                db,
                "SELECT id, kind, title, summary, created_at FROM saved_reports "
                "WHERE user_id = ? ORDER BY created_at DESC, id",
                (user_id,),
            ).fetchall()
        return [self._summary(row) for row in rows]

    def count_saved(self, user_id: str) -> int:
        with self._connect() as db:
            (count,) = self._run(
                db, "SELECT COUNT(*) FROM saved_reports WHERE user_id = ?", (user_id,)
            ).fetchone()
        return int(count)

    def get_saved(self, user_id: str, report_id: str) -> SavedReport | None:
        with self._connect() as db:
            row = self._run(
                db,
                "SELECT id, kind, title, summary, created_at, input, snapshot "
                "FROM saved_reports WHERE user_id = ? AND id = ?",
                (user_id, report_id),
            ).fetchone()
        if row is None:
            return None
        summary = self._summary(row[:5])
        return SavedReport(
            id=summary.id,
            kind=summary.kind,
            title=summary.title,
            summary=summary.summary,
            created_at=summary.created_at,
            input=self._read_json(row[5]),
            snapshot=self._read_json(row[6]),
        )

    def rename(self, user_id: str, report_id: str, title: str) -> bool:
        with self._connect() as db:
            cursor = self._run(
                db,
                "UPDATE saved_reports SET title = ?, updated_at = ? WHERE user_id = ? AND id = ?",
                (title, self._ts(self.clock()), user_id, report_id),
            )
            return bool(cursor.rowcount)

    def delete_saved(self, user_id: str, report_id: str) -> bool:
        with self._connect() as db:
            cursor = self._run(
                db, "DELETE FROM saved_reports WHERE user_id = ? AND id = ?", (user_id, report_id)
            )
            return bool(cursor.rowcount)


def sqlite_accounts(path: Path, clock: Clock = _utc_now) -> AccountStore:
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

    return AccountStore(_SQLITE, connect, clock)


def postgres_accounts(url: str, clock: Clock = _utc_now) -> AccountStore:
    def connect() -> psycopg.Connection[Any]:
        # The connection's context manager commits on success and rolls back on error.
        return psycopg.connect(url, connect_timeout=10)

    return AccountStore(_POSTGRES, connect, clock)
