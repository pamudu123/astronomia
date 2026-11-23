"""The AI chapters of a paid report, kept with it and written once (docs/17, section 6a).

A chapter written again would read differently, so the first text of each chapter is the one
the report keeps: on the page, in the PDF, in the chat, on every device of the account.

A row names its report by the order that paid for it, and the account, so the chapters go with
either. Like orders.py there is one class for both databases. On PostgreSQL the table is in the
private `sidera` schema and is made by supabase/migrations/, never by the app.
"""

import datetime as dt
import sqlite3
import threading
from collections.abc import Callable, Iterator, Sequence
from contextlib import AbstractContextManager, contextmanager
from pathlib import Path
from typing import Any

from app.store import postgres

Clock = Callable[[], dt.datetime]
TABLES = ("report_chapters",)


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


_SQLITE_SCHEMA = """CREATE TABLE IF NOT EXISTS report_chapters (
    order_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    language TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (order_id, language, chapter_id)
)"""


class ChapterStore:
    """See `sqlite_chapters` and `postgres_chapters` for the two ways to make one."""

    def __init__(
        self,
        connect: Callable[[], AbstractContextManager[Any]],
        *,
        on_postgres: bool,
        clock: Clock = _utc_now,
    ) -> None:
        self._connect = connect
        self._pg = on_postgres
        self.clock = clock

    def _run(self, db: Any, statement: str, params: Sequence[Any]) -> Any:
        table = postgres.table("report_chapters") if self._pg else "report_chapters"
        sql = statement.format(report_chapters=table)
        return db.execute(sql.replace("?", "%s") if self._pg else sql, tuple(params))

    def keep(self, order_id: str, user_id: str, language: str, chapter_id: str, text: str) -> str:
        """Keeps a chapter unless the report has it already. Returns the text that is kept."""
        now = self.clock()
        with self._connect() as db:
            self._run(
                db,
                "INSERT INTO {report_chapters} "
                "(order_id, user_id, language, chapter_id, text, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
                (
                    order_id,
                    user_id,
                    language,
                    chapter_id,
                    text,
                    now if self._pg else now.isoformat(),
                ),
            )
            row = self._run(
                db,
                "SELECT text FROM {report_chapters} "
                "WHERE order_id = ? AND language = ? AND chapter_id = ?",
                (order_id, language, chapter_id),
            ).fetchone()
        return str(row[0])

    def kept(self, order_id: str, language: str) -> dict[str, str]:
        """Every chapter the report keeps in this language, by its id."""
        with self._connect() as db:
            rows = self._run(
                db,
                "SELECT chapter_id, text FROM {report_chapters} "
                "WHERE order_id = ? AND language = ? ORDER BY created_at, chapter_id",
                (order_id, language),
            ).fetchall()
        return {str(chapter_id): str(text) for chapter_id, text in rows}

    def forget_user(self, user_id: str) -> None:
        """For a deleted account. PostgreSQL also does this through the foreign key."""
        with self._connect() as db:
            self._run(db, "DELETE FROM {report_chapters} WHERE user_id = ?", (user_id,))


def sqlite_chapters(path: Path, clock: Clock = _utc_now) -> ChapterStore:
    """A store in a SQLite file, making its table if it is not there yet."""
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
        db.execute(_SQLITE_SCHEMA)
    return ChapterStore(connect, on_postgres=False, clock=clock)


def postgres_chapters(url: str, clock: Clock = _utc_now) -> ChapterStore:
    """A store in the `sidera` schema. Raises MissingTables when the migrations are not applied."""
    postgres.require_tables(url, TABLES)
    return ChapterStore(lambda: postgres.connect(url), on_postgres=True, clock=clock)
