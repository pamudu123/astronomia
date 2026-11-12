"""Share links: a snapshot of one result, kept only after the visitor presses Share.

Only hashes of the link code and of the delete token are kept, so a copy of this database
cannot be turned back into working links. Snapshots expire and can be deleted at any time.

Two stores with the same methods: SQLite for local runs and tests, PostgreSQL on hosts
without a lasting disk (set ASTRONOMIA_DATABASE_URL). The API only uses those methods.
"""

import datetime as dt
import hashlib
import json
import secrets
import sqlite3
import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import psycopg
from psycopg.types.json import Jsonb

Clock = Callable[[], dt.datetime]

_SCHEMA = """
CREATE TABLE IF NOT EXISTS shares (
    code_hash TEXT PRIMARY KEY,
    delete_hash TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    payload TEXT NOT NULL
)
"""


def _hash(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


@dataclass(frozen=True)
class NewShare:
    code: str  # goes in the link
    delete_token: str  # stays with the person who shared
    created_at: dt.datetime
    expires_at: dt.datetime


@dataclass(frozen=True)
class StoredShare:
    kind: str
    created_at: dt.datetime
    expires_at: dt.datetime
    payload: dict[str, Any]


class DeleteRefused(Exception):
    """The delete token does not match."""


class Store(Protocol):
    """What the share endpoints need from a store."""

    clock: Clock

    def create(self, kind: str, payload: dict[str, Any], days: int) -> NewShare: ...

    def get(self, code: str) -> StoredShare | None: ...

    def delete(self, code: str, delete_token: str) -> bool: ...


def _new_share(now: dt.datetime, days: int) -> NewShare:
    return NewShare(
        code=secrets.token_urlsafe(16),
        delete_token=secrets.token_urlsafe(24),
        created_at=now,
        expires_at=now + dt.timedelta(days=days),
    )


class ShareStore:
    def __init__(self, path: Path, clock: Clock = _utc_now) -> None:
        self.path = path
        self.clock = clock
        self._lock = threading.Lock()
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.execute(_SCHEMA)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path)
        try:
            with db:  # commits, or rolls back on error
                yield db
        finally:
            db.close()

    def _purge(self, db: sqlite3.Connection) -> None:
        db.execute("DELETE FROM shares WHERE expires_at <= ?", (self.clock().isoformat(),))

    def create(self, kind: str, payload: dict[str, Any], days: int) -> NewShare:
        share = _new_share(self.clock(), days)
        with self._lock, self._connect() as db:
            self._purge(db)
            db.execute(
                "INSERT INTO shares VALUES (?, ?, ?, ?, ?, ?)",
                (
                    _hash(share.code),
                    _hash(share.delete_token),
                    kind,
                    share.created_at.isoformat(),
                    share.expires_at.isoformat(),
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
        return share

    def get(self, code: str) -> StoredShare | None:
        with self._lock, self._connect() as db:
            self._purge(db)
            row = db.execute(
                "SELECT kind, created_at, expires_at, payload FROM shares WHERE code_hash = ?",
                (_hash(code),),
            ).fetchone()
        if row is None:
            return None
        kind, created, expires, payload = row
        return StoredShare(
            kind=kind,
            created_at=dt.datetime.fromisoformat(created),
            expires_at=dt.datetime.fromisoformat(expires),
            payload=json.loads(payload),
        )

    def delete(self, code: str, delete_token: str) -> bool:
        """True when deleted, False when there is no such share. Raises on a wrong token."""
        with self._lock, self._connect() as db:
            self._purge(db)
            row = db.execute(
                "SELECT delete_hash FROM shares WHERE code_hash = ?", (_hash(code),)
            ).fetchone()
            if row is None:
                return False
            if not secrets.compare_digest(row[0], _hash(delete_token)):
                raise DeleteRefused
            db.execute("DELETE FROM shares WHERE code_hash = ?", (_hash(code),))
        return True


_PG_SCHEMA = """
CREATE TABLE IF NOT EXISTS shares (
    code_hash TEXT PRIMARY KEY,
    delete_hash TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL
)
"""


class PostgresShareStore:
    """The same store in PostgreSQL. One short connection per call keeps it simple."""

    def __init__(self, url: str, clock: Clock = _utc_now) -> None:
        self.url = url
        self.clock = clock
        with self._connect() as db:
            db.execute(_PG_SCHEMA)

    def _connect(self) -> psycopg.Connection[Any]:
        # The connection's context manager commits on success and rolls back on error.
        return psycopg.connect(self.url, connect_timeout=10)

    def _purge(self, db: psycopg.Connection[Any]) -> None:
        db.execute("DELETE FROM shares WHERE expires_at <= %s", (self.clock(),))

    def create(self, kind: str, payload: dict[str, Any], days: int) -> NewShare:
        share = _new_share(self.clock(), days)
        with self._connect() as db:
            self._purge(db)
            db.execute(
                "INSERT INTO shares VALUES (%s, %s, %s, %s, %s, %s)",
                (
                    _hash(share.code),
                    _hash(share.delete_token),
                    kind,
                    share.created_at,
                    share.expires_at,
                    Jsonb(payload),
                ),
            )
        return share

    def get(self, code: str) -> StoredShare | None:
        with self._connect() as db:
            self._purge(db)
            row = db.execute(
                "SELECT kind, created_at, expires_at, payload FROM shares WHERE code_hash = %s",
                (_hash(code),),
            ).fetchone()
        if row is None:
            return None
        kind, created, expires, payload = row
        return StoredShare(
            kind=kind,
            created_at=created.astimezone(dt.UTC),
            expires_at=expires.astimezone(dt.UTC),
            payload=payload,
        )

    def delete(self, code: str, delete_token: str) -> bool:
        with self._connect() as db:
            self._purge(db)
            row = db.execute(
                "SELECT delete_hash FROM shares WHERE code_hash = %s FOR UPDATE", (_hash(code),)
            ).fetchone()
            if row is None:
                return False
            if not secrets.compare_digest(row[0], _hash(delete_token)):
                raise DeleteRefused
            db.execute("DELETE FROM shares WHERE code_hash = %s", (_hash(code),))
        return True
