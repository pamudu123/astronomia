"""Share links: a snapshot of one result, kept only after the visitor presses Share.

Only hashes of the link code and of the delete token are kept, so a copy of this database
cannot be turned back into working links. Snapshots expire and can be deleted at any time.

SQLite for now. The `ShareStore` methods are all the API uses, so PostgreSQL can take its
place at deploy without touching the endpoints.
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
from typing import Any

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
        now = self.clock()
        share = NewShare(
            code=secrets.token_urlsafe(16),
            delete_token=secrets.token_urlsafe(24),
            created_at=now,
            expires_at=now + dt.timedelta(days=days),
        )
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
