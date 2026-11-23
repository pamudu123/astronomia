"""Astro chat usage: one row per question and what it cost (docs/18, section 5; docs/21).

Only numbers and ids are kept, never the text of a question or an answer:

- a free question: the browser's random chat id, a keyed hash of its network, and the start
  of that browser's week;
- a paid question: the account.

Each row also holds the tokens the AI provider reported and their cost, in millionths of a US
dollar. The rules that read these counts are in app/tiers/chat.py; this module only counts and
writes, so the same numbers are seen whether the question is then allowed or not.

One class for both databases, as in orders.py: SQLite for local runs and tests, PostgreSQL
(Supabase) when ASTRONOMIA_DATABASE_URL is set, where the table is made by supabase/migrations/.
"""

import datetime as dt
import sqlite3
import threading
import uuid
import zlib
from collections.abc import Callable, Iterator, Sequence
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, TypeVar

from app.store import postgres

Clock = Callable[[], dt.datetime]
Kind = Literal["free", "paid"]
Purpose = Literal["answer", "suggest"]
T = TypeVar("T")

TABLES = ("chat_turns",)
WEEK = dt.timedelta(days=7)
MINUTE = dt.timedelta(minutes=1)
# A question the AI service never took up within this time is not counted: an error on the way
# must not use up one of someone's 2 free questions.
START_WITHIN = dt.timedelta(minutes=2)
# The follow-up buttons are written right after the answer; later than this, they are refused.
SUGGEST_WITHIN = dt.timedelta(minutes=30)
# An answer still being written has no cost yet. For the site's daily spending ceiling it counts
# as an average answer until its cost arrives, or until this long has passed.
PENDING_FOR = dt.timedelta(minutes=10)
# Free questions are kept only as long as the weekly limits need them.
KEEP_FREE = dt.timedelta(days=8)


def _utc_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


@dataclass(frozen=True)
class Who:
    """Whose question it is. A browser always has a chat id; `user_id` is a signed in account."""

    browser: str
    network: str  # a keyed hash of the network address
    user_id: str | None


@dataclass(frozen=True)
class Counts:
    """Everything the chat rules need to know about one asker, at one moment."""

    now: dt.datetime
    # This browser's free questions in its current week, and when that week began (None: the
    # next free question starts a new week).
    free_in_week: int
    week_start: dt.datetime | None
    # Free questions from this network in the last 7 days, and the oldest of them.
    network_in_week: int
    network_oldest: dt.datetime | None
    # Questions in the last minute from this browser or account, and the oldest of them.
    burst: int
    burst_oldest: dt.datetime | None
    # Cost of the whole site's free questions since the start of today.
    free_spent_today: int
    # The account's paid questions: their cost in all, and since the start of today.
    paid_spent: int
    paid_spent_today: int


@dataclass(frozen=True)
class Usage:
    input_tokens: int
    cached_tokens: int
    output_tokens: int
    cost_micros: int


@dataclass(frozen=True)
class _Dialect:
    placeholder: str
    schema: str | None

    def sql(self, statement: str) -> str:
        names = {n: f"{self.schema}.{n}" if self.schema else n for n in TABLES}
        return statement.format(**names).replace("?", self.placeholder)


_SQLITE = _Dialect(placeholder="?", schema=None)
_POSTGRES = _Dialect(placeholder="%s", schema=postgres.SCHEMA)

# SQLite only. PostgreSQL gets its table from supabase/migrations/.
_SQLITE_SCHEMA = [
    """CREATE TABLE IF NOT EXISTS chat_turns (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        user_id TEXT,
        browser TEXT,
        network TEXT,
        week_start TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        suggested INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        cached_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_micros INTEGER NOT NULL DEFAULT 0,
        reported_at TEXT
    )""",
    "CREATE INDEX IF NOT EXISTS chat_turns_browser ON chat_turns (browser, created_at)",
    "CREATE INDEX IF NOT EXISTS chat_turns_network ON chat_turns (network, created_at)",
    "CREATE INDEX IF NOT EXISTS chat_turns_user ON chat_turns (user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS chat_turns_kind ON chat_turns (kind, created_at)",
]

# A question counts once the AI service took it up, or while it may still do so.
_COUNTED = "(started_at IS NOT NULL OR created_at > ?)"


class ChatStore:
    """See `sqlite_chat` and `postgres_chat` for the two ways to make one."""

    def __init__(
        self,
        dialect: _Dialect,
        connect: Callable[[], AbstractContextManager[Any]],
        clock: Clock = _utc_now,
    ) -> None:
        self._d = dialect
        self._connect = connect
        self.clock = clock

    def _ts(self, value: dt.datetime) -> Any:
        value = value.astimezone(dt.UTC)
        return value.isoformat() if self._d is _SQLITE else value

    @staticmethod
    def _read_ts(value: Any) -> dt.datetime | None:
        if value is None:
            return None
        if isinstance(value, str):
            return dt.datetime.fromisoformat(value)
        stamp: dt.datetime = value
        return stamp.astimezone(dt.UTC)

    def _run(self, db: Any, statement: str, params: Sequence[Any] = ()) -> Any:
        return db.execute(self._d.sql(statement), tuple(params))

    def _lock(self, db: Any, who: Who) -> None:
        """Holds this browser, account and network until the transaction ends, so two questions
        sent at once cannot both take the last free one. SQLite has one writer at a time."""
        if self._d is _SQLITE:
            return
        keys = [(1, who.browser), (2, who.network)]
        if who.user_id:
            keys.append((3, who.user_id))
        for space, key in keys:  # always in this order, so two requests never wait on each other
            signed = zlib.crc32(key.encode()) - 2**31  # PostgreSQL's int4 is signed
            db.execute("SELECT pg_advisory_xact_lock(%s, %s)", (space, signed))

    def _counts(self, db: Any, who: Who, day_start: dt.datetime, average: int) -> Counts:
        now = self.clock()
        recent = self._ts(now - START_WITHIN)

        latest = self._run(
            db,
            "SELECT week_start FROM {chat_turns} WHERE browser = ? AND kind = 'free' AND "
            f"{_COUNTED} ORDER BY created_at DESC LIMIT 1",
            (who.browser, recent),
        ).fetchone()
        week_start = self._read_ts(latest[0]) if latest else None
        free_in_week = 0
        if week_start is not None and now < week_start + WEEK:
            (free_in_week,) = self._run(
                db,
                "SELECT COUNT(*) FROM {chat_turns} WHERE browser = ? AND kind = 'free' AND "
                f"week_start = ? AND {_COUNTED}",
                (who.browser, self._ts(week_start), recent),
            ).fetchone()
        else:
            week_start = None

        network_in_week, network_oldest = self._run(
            db,
            "SELECT COUNT(*), MIN(created_at) FROM {chat_turns} WHERE network = ? AND "
            f"kind = 'free' AND created_at > ? AND {_COUNTED}",
            (who.network, self._ts(now - WEEK), recent),
        ).fetchone()

        mine, params = "browser = ?", [who.browser]
        if who.user_id:
            mine, params = "(browser = ? OR user_id = ?)", [who.browser, who.user_id]
        burst, burst_oldest = self._run(
            db,
            f"SELECT COUNT(*), MIN(created_at) FROM {{chat_turns}} WHERE {mine} AND created_at > ?",
            (*params, self._ts(now - MINUTE)),
        ).fetchone()

        spent, pending = self._run(
            db,
            "SELECT COALESCE(SUM(cost_micros), 0), "
            "COALESCE(SUM(CASE WHEN reported_at IS NULL AND created_at > ? THEN 1 ELSE 0 END), 0) "
            "FROM {chat_turns} WHERE kind = 'free' AND created_at >= ?",
            (self._ts(now - PENDING_FOR), self._ts(day_start)),
        ).fetchone()

        paid_spent = paid_today = 0
        if who.user_id:
            paid_spent, paid_today = self._run(
                db,
                "SELECT COALESCE(SUM(cost_micros), 0), "
                "COALESCE(SUM(CASE WHEN created_at >= ? THEN cost_micros ELSE 0 END), 0) "
                "FROM {chat_turns} WHERE user_id = ? AND kind = 'paid'",
                (self._ts(day_start), who.user_id),
            ).fetchone()

        return Counts(
            now=now,
            free_in_week=int(free_in_week),
            week_start=week_start,
            network_in_week=int(network_in_week),
            network_oldest=self._read_ts(network_oldest),
            burst=int(burst),
            burst_oldest=self._read_ts(burst_oldest),
            free_spent_today=int(spent) + int(pending) * average,
            paid_spent=int(paid_spent),
            paid_spent_today=int(paid_today),
        )

    def counts(self, who: Who, day_start: dt.datetime, average: int) -> Counts:
        """The counts for one asker, for showing what is left. Writes nothing.

        `day_start`: the start of today on the site's calendar. `average`: the cost of an average
        answer, standing in for answers still being written."""
        with self._connect() as db:
            return self._counts(db, who, day_start, average)

    def begin(
        self,
        who: Who,
        day_start: dt.datetime,
        average: int,
        decide: Callable[[Counts], tuple[Kind | None, T]],
    ) -> tuple[str | None, Counts, T]:
        """Counts, lets `decide` choose, and records the question if it is allowed, all in one
        transaction. `decide` gives the kind of question ("free" or "paid") or None to refuse,
        and anything else the caller wants back. Gives the new question's id, or None."""
        with self._connect() as db:
            self._lock(db, who)
            counts = self._counts(db, who, day_start, average)
            kind, extra = decide(counts)
            if kind is None:
                return None, counts, extra
            turn_id = str(uuid.uuid4())
            now = counts.now
            if kind == "free":
                week_start = counts.week_start or now
                self._run(
                    db,
                    "INSERT INTO {chat_turns} (id, kind, browser, network, week_start, created_at) "
                    "VALUES (?, 'free', ?, ?, ?, ?)",
                    (turn_id, who.browser, who.network, self._ts(week_start), self._ts(now)),
                )
            else:
                self._run(
                    db,
                    "INSERT INTO {chat_turns} (id, kind, user_id, created_at) "
                    "VALUES (?, 'paid', ?, ?)",
                    (turn_id, who.user_id, self._ts(now)),
                )
            # Free questions older than the weekly limits need are not kept.
            self._run(
                db,
                "DELETE FROM {chat_turns} WHERE kind = 'free' AND created_at < ?",
                (self._ts(now - KEEP_FREE),),
            )
            return turn_id, counts, extra

    def start(self, turn_id: str, purpose: Purpose) -> Kind | None:
        """The AI service takes a question up. Each question is answered once and gets its
        follow-up buttons once. Gives its kind, or None for an unknown, used or stale one."""
        now = self.clock()
        with self._connect() as db:
            if purpose == "answer":
                row = self._run(
                    db,
                    "UPDATE {chat_turns} SET started_at = ? "
                    "WHERE id = ? AND started_at IS NULL AND created_at > ? RETURNING kind",
                    (self._ts(now), turn_id, self._ts(now - START_WITHIN)),
                ).fetchone()
            else:
                row = self._run(
                    db,
                    "UPDATE {chat_turns} SET suggested = TRUE "
                    "WHERE id = ? AND started_at IS NOT NULL AND NOT suggested "
                    "AND created_at > ? RETURNING kind",
                    (turn_id, self._ts(now - SUGGEST_WITHIN)),
                ).fetchone()
        kind: Kind | None = row[0] if row else None
        return kind

    def record(self, turn_id: str, usage: Usage) -> bool:
        """Adds what the AI provider reported for one run (an answer, or its follow-up buttons).
        False for a question the AI service never took up."""
        with self._connect() as db:
            cursor = self._run(
                db,
                "UPDATE {chat_turns} SET input_tokens = input_tokens + ?, "
                "cached_tokens = cached_tokens + ?, output_tokens = output_tokens + ?, "
                "cost_micros = cost_micros + ?, reported_at = ? "
                "WHERE id = ? AND started_at IS NOT NULL",
                (
                    usage.input_tokens,
                    usage.cached_tokens,
                    usage.output_tokens,
                    usage.cost_micros,
                    self._ts(self.clock()),
                    turn_id,
                ),
            )
            return bool(cursor.rowcount)

    def move_user(self, from_user: str, to_user: str) -> None:
        """For a guest who joined a Google account: what the guest's reports' chat used goes
        with the reports, so joining does not give it back."""
        with self._connect() as db:
            self._run(
                db, "UPDATE {chat_turns} SET user_id = ? WHERE user_id = ?", (to_user, from_user)
            )

    def forget_user(self, user_id: str) -> None:
        """Deletes an account's chat usage (Delete account). PostgreSQL also does this itself."""
        with self._connect() as db:
            self._run(db, "DELETE FROM {chat_turns} WHERE user_id = ?", (user_id,))


def sqlite_chat(path: Path, clock: Clock = _utc_now) -> ChatStore:
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
        for statement in _SQLITE_SCHEMA:
            db.execute(statement)
    return ChatStore(_SQLITE, connect, clock)


def postgres_chat(url: str, clock: Clock = _utc_now) -> ChatStore:
    """A store in the `sidera` schema. Raises MissingTables when the migration is not applied."""
    postgres.require_tables(url, TABLES)
    return ChatStore(_POSTGRES, lambda: postgres.connect(url), clock)
