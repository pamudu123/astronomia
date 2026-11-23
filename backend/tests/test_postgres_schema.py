"""The PostgreSQL stores use the private `sidera` schema and never make tables (docs/19).

The first tests need no database: they watch the SQL the stores send. The rest run against a
test PostgreSQL built from supabase/migrations/, as on Supabase.
"""

import datetime as dt
import re
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg
import pytest

from app.store import accounts, postgres
from app.store.accounts import NewReport, postgres_accounts
from app.store.chapters import postgres_chapters
from app.store.chat import Usage, Who, postgres_chat
from app.store.orders import postgres_orders
from app.store.postgres import MissingTables
from app.store.shares import PostgresShareStore
from tests.pg import drop_sidera, migrate, migration_files, need_postgres

TABLE_NAME = re.compile(r"\b(?:FROM|INTO|UPDATE|JOIN)\s+([\w.]+)", re.IGNORECASE)


class Recorder:
    """Stands in for a PostgreSQL connection: keeps every statement, finds nothing."""

    def __init__(self, missing: tuple[str, ...] = ()) -> None:
        self.statements: list[str] = []
        self.missing = missing

    def execute(self, statement: str, params: tuple[Any, ...] = ()) -> "Recorder":
        self.statements.append(statement)
        self._row: tuple[Any, ...] | None = None
        if "to_regclass" in statement:
            self._row = (None,) if params[0] in self.missing else (12345,)
        elif "COUNT(*), MIN" in statement:
            self._row = (0, None)
        elif "COALESCE(SUM" in statement:
            self._row = (0, 0)
        elif "COUNT(*)" in statement:
            self._row = (0,)
        elif "SELECT kind, last_seen_at" in statement:
            self._row = ("guest", dt.datetime(2026, 11, 21, tzinfo=dt.UTC))
        return self

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._row

    def fetchall(self) -> list[tuple[Any, ...]]:
        return []

    @property
    def rowcount(self) -> int:
        return 1

    def __enter__(self) -> "Recorder":
        return self

    def __exit__(self, *exc: object) -> None:
        return None


@pytest.fixture
def recorder(monkeypatch: pytest.MonkeyPatch) -> Recorder:
    db = Recorder()
    monkeypatch.setattr(postgres, "connect", lambda url: db)
    return db


def report() -> NewReport:
    return NewReport(
        kind="hadahan", input={}, input_hash="h", snapshot={}, summary={}, rules="2026.1"
    )


def test_queries_name_the_sidera_schema() -> None:
    assert (
        accounts._POSTGRES.sql("SELECT id FROM {users} WHERE id = ?")
        == "SELECT id FROM sidera.users WHERE id = %s"
    )
    assert accounts._SQLITE.sql("SELECT id FROM {users} WHERE id = ?") == (
        "SELECT id FROM users WHERE id = ?"
    )


def test_the_account_store_only_touches_sidera_tables(recorder: Recorder) -> None:
    store = postgres_accounts("postgresql://test")
    user_id = "00000000-0000-0000-0000-000000000001"
    store.find_user(user_id, "guest")
    store.add_user(user_id, "guest")
    store.save(user_id, report(), limit=5)
    store.list_saved(user_id)
    store.count_saved(user_id)
    store.get_saved(user_id, "00000000-0000-0000-0000-000000000000")
    store.rename(user_id, "00000000-0000-0000-0000-000000000000", "Nimali")
    store.delete_saved(user_id, "00000000-0000-0000-0000-000000000000")
    store.move_reports(user_id, "00000000-0000-0000-0000-000000000002")
    store.delete_user(user_id)

    queries = [s for s in recorder.statements if "to_regclass" not in s]
    names = {name for statement in queries for name in TABLE_NAME.findall(statement)}
    assert names == {"sidera.users", "sidera.saved_reports"}
    assert not [s for s in recorder.statements if re.search(r"\b(CREATE|ALTER|DROP)\b", s)]
    assert not [s for s in queries if "?" in s]


def test_the_share_store_only_touches_sidera_tables(recorder: Recorder) -> None:
    store = PostgresShareStore("postgresql://test")
    created = store.create("hadahan", {}, days=30)
    store.get(created.code)
    store.delete(created.code, created.delete_token)

    queries = [s for s in recorder.statements if "to_regclass" not in s]
    assert {name for s in queries for name in TABLE_NAME.findall(s)} == {"sidera.shares"}
    assert not [s for s in recorder.statements if re.search(r"\b(CREATE|ALTER|DROP)\b", s)]


def test_the_order_store_only_touches_sidera_tables(recorder: Recorder) -> None:
    from app.tiers.prices import Price

    store = postgres_orders("postgresql://test")
    store.list_coupons()
    store.set_active("pamudu", False)
    store.misses_last_hour("00000000-0000-0000-0000-000000000000")
    store.record_miss("00000000-0000-0000-0000-000000000000")
    store.paid_order("00000000-0000-0000-0000-000000000000", "hadahan", "h")
    store.void("00000000-0000-0000-0000-000000000000")
    with pytest.raises(Exception):  # noqa: B017 - the recorder finds no coupon
        store.redeem("u", "pamudu", "hadahan", "h", Price(250, "USD"))

    queries = [s for s in recorder.statements if "to_regclass" not in s]
    names = {name for statement in queries for name in TABLE_NAME.findall(statement)}
    assert names == {"sidera.coupons", "sidera.orders", "sidera.coupon_misses"}
    assert not [s for s in recorder.statements if re.search(r"(CREATE|ALTER|DROP)", s)]
    assert not [s for s in queries if "?" in s]


def test_the_chat_store_only_touches_sidera_tables(recorder: Recorder) -> None:
    store = postgres_chat("postgresql://test")
    who = Who(browser="browser-1", network="n", user_id="00000000-0000-0000-0000-000000000001")
    day = dt.datetime(2026, 11, 22, tzinfo=dt.UTC)
    store.counts(who, day, 10_000)
    store.begin(who, day, 10_000, lambda counts: ("free", None))
    store.begin(who, day, 10_000, lambda counts: ("paid", None))
    store.start("00000000-0000-0000-0000-000000000002", "answer")
    store.start("00000000-0000-0000-0000-000000000002", "suggest")
    store.record("00000000-0000-0000-0000-000000000002", Usage(1, 0, 1, 1))
    store.forget_user(who.user_id or "")

    queries = [s for s in recorder.statements if "to_regclass" not in s]
    names = {name for statement in queries for name in TABLE_NAME.findall(statement)}
    assert names == {"sidera.chat_turns"}
    # Two questions sent at once wait for each other: browser, network and account are held.
    assert sum("pg_advisory_xact_lock" in s for s in queries) == 6
    assert not [s for s in recorder.statements if re.search(r"(CREATE|ALTER|DROP)", s)]
    assert not [s for s in queries if "?" in s]


def test_the_chapter_store_only_touches_sidera_tables(recorder: Recorder) -> None:
    store = postgres_chapters("postgresql://test")
    with pytest.raises(TypeError):  # the recorder finds no row to read back
        store.keep("o", "u", "en", "chart.work", "Text.")
    store.kept("o", "en")
    store.forget_user("u")

    queries = [s for s in recorder.statements if "to_regclass" not in s]
    names = {name for statement in queries for name in TABLE_NAME.findall(statement)}
    assert names == {"sidera.report_chapters"}
    assert not [s for s in queries if "?" in s]


def test_a_database_without_the_migrations_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    db = Recorder(missing=("sidera.saved_reports", "sidera.shares"))
    monkeypatch.setattr(postgres, "connect", lambda url: db)
    with pytest.raises(MissingTables, match=r"sidera\.saved_reports\..*supabase/migrations"):
        postgres_accounts("postgresql://test")
    with pytest.raises(MissingTables, match=r"sidera\.shares\."):
        PostgresShareStore("postgresql://test")


def test_the_migrations_run_in_name_order() -> None:
    names = [path.name for path in migration_files()]
    assert names and all(re.fullmatch(r"\d{14}_[a-z0-9_]+\.sql", name) for name in names)
    assert len({name[:14] for name in names}) == len(names)


# Against a real PostgreSQL


@contextmanager
def connected() -> Iterator[psycopg.Connection[Any]]:
    with psycopg.connect(need_postgres()) as db:
        yield db


def test_the_stores_refuse_a_database_without_the_migrations() -> None:
    url = need_postgres()
    drop_sidera(url)
    with pytest.raises(MissingTables):
        postgres_accounts(url)
    with pytest.raises(MissingTables):
        PostgresShareStore(url)
    with connected() as db:
        # The stores made nothing on their own.
        assert db.execute("SELECT to_regnamespace('sidera')").fetchone() == (None,)


def test_the_migrations_make_the_tables_the_stores_use() -> None:
    url = need_postgres()
    migrate(url)
    store = postgres_accounts(url)
    user = store.add_user("00000000-0000-0000-0000-000000000001", "guest")
    store.save(user.id, report(), limit=5)
    PostgresShareStore(url).create("hadahan", {}, days=30)
    with connected() as db:
        rows = db.execute(
            "SELECT relname FROM pg_class WHERE relnamespace = 'sidera'::regnamespace "
            "AND relkind = 'r' ORDER BY relname"
        ).fetchall()
        counts = db.execute(
            "SELECT (SELECT count(*) FROM sidera.users),"
            " (SELECT count(*) FROM sidera.saved_reports), (SELECT count(*) FROM sidera.shares)"
        ).fetchone()
    # The temporary guest sessions table is gone (20261121130000_drop_guest_sessions.sql).
    assert [row[0] for row in rows] == [
        "chat_turns",
        "coupon_misses",
        "coupons",
        "orders",
        "report_chapters",
        "saved_reports",
        "shares",
        "users",
    ]
    assert counts == (1, 1, 1)


def test_every_table_is_locked_to_everyone_but_the_owner() -> None:
    migrate(need_postgres())
    with connected() as db:
        tables = db.execute(
            "SELECT relname, relrowsecurity FROM pg_class "
            "WHERE relnamespace = 'sidera'::regnamespace AND relkind = 'r'"
        ).fetchall()
        policies = db.execute("SELECT count(*) FROM pg_policies WHERE schemaname = 'sidera'")
        assert policies.fetchone() == (0,)
        for role in ("anon", "authenticated", "public"):
            usage = db.execute("SELECT has_schema_privilege(%s, 'sidera', 'USAGE')", (role,))
            assert usage.fetchone() == (False,), role
            for name, _ in tables:
                for right in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                    granted = db.execute(
                        "SELECT has_table_privilege(%s, %s, %s)", (role, f"sidera.{name}", right)
                    ).fetchone()
                    assert granted == (False,), (role, name, right)
    assert tables and all(rls for _, rls in tables)


def test_a_deleted_user_takes_their_rows_along() -> None:
    url = need_postgres()
    migrate(url)
    store = postgres_accounts(url)
    user = store.add_user("00000000-0000-0000-0000-000000000001", "guest")
    store.save(user.id, report(), limit=5)
    with connected() as db:
        db.execute("DELETE FROM sidera.users WHERE id = %s", (user.id,))
        left = db.execute("SELECT count(*) FROM sidera.saved_reports").fetchone()
    assert left == (0,)


def test_the_chat_store_works_on_the_migrated_table() -> None:
    url = need_postgres()
    migrate(url)
    user = postgres_accounts(url).add_user("00000000-0000-0000-0000-000000000001", "google")
    store = postgres_chat(url)
    day = dt.datetime(2000, 1, 1, tzinfo=dt.UTC)
    free = Who(browser="browser-1", network="n1", user_id=None)
    paid = Who(browser="browser-1", network="n1", user_id=user.id)
    first, _, _ = store.begin(free, day, 10_000, lambda counts: ("free", None))
    second, _, _ = store.begin(paid, day, 10_000, lambda counts: ("paid", None))
    assert first and second
    assert store.start(first, "answer") == "free"
    assert store.start(first, "answer") is None
    assert store.start(first, "suggest") == "free"
    assert store.record(first, Usage(100, 50, 10, 1234))
    assert store.start(second, "answer") == "paid"
    assert store.record(second, Usage(100, 0, 10, 5000))
    counts = store.counts(paid, day, 10_000)
    assert (counts.free_in_week, counts.network_in_week, counts.burst) == (1, 1, 2)
    assert (counts.free_spent_today, counts.paid_spent) == (1234, 5000)
    # Deleting the account deletes its chat usage; free questions have no account.
    with connected() as db:
        db.execute("DELETE FROM sidera.users WHERE id = %s", (user.id,))
        left = db.execute("SELECT kind FROM sidera.chat_turns").fetchall()
    assert left == [("free",)]


def test_the_hourly_job_deletes_expired_free_reports() -> None:
    """sidera.delete_expired_reports() is what pg_cron runs on Supabase, every hour."""
    url = need_postgres()
    migrate(url)
    eight_days_ago = dt.datetime.now(dt.UTC) - dt.timedelta(days=8)
    old = postgres_accounts(url, clock=lambda: eight_days_ago)
    user = old.add_user("00000000-0000-0000-0000-000000000001", "guest").id
    old.save(user, report(), limit=5)  # free, saved 8 days ago
    paid = NewReport(kind="hadahan", input={}, input_hash="p", snapshot={}, summary={}, rules="")
    old.save(user, paid, limit=5, purchase_id="order-1")
    fresh = NewReport(kind="hadahan", input={}, input_hash="f", snapshot={}, summary={}, rules="")
    # Another account: the store deletes an account's own expired reports when it saves.
    now = postgres_accounts(url)
    other = now.add_user("00000000-0000-0000-0000-000000000002", "guest").id
    now.save(other, fresh, limit=5)
    with connected() as db:
        assert db.execute("SELECT sidera.delete_expired_reports()").fetchone() == (1,)
        left = db.execute("SELECT input_hash FROM sidera.saved_reports ORDER BY input_hash")
        assert left.fetchall() == [("f",), ("p",)]
        for role in ("anon", "authenticated", "public"):
            allowed = db.execute(
                "SELECT has_function_privilege(%s, 'sidera.delete_expired_reports()', 'EXECUTE')",
                (role,),
            ).fetchone()
            assert allowed == (False,), role


def test_the_database_keeps_the_expiry_rule_for_any_writer() -> None:
    """The backend from before this change writes no expiry: the database adds it, and clears it
    when an order is set, so deploying the migration first breaks nothing."""
    url = need_postgres()
    migrate(url)
    user = postgres_accounts(url).add_user("00000000-0000-0000-0000-000000000001", "guest").id
    saved_at = dt.datetime(2026, 11, 15, 8, 0, tzinfo=dt.UTC)
    insert = (
        "INSERT INTO sidera.saved_reports (id, user_id, kind, title, input, input_hash, snapshot,"
        " summary, rules, purchase_id, created_at, updated_at) VALUES"
        " (gen_random_uuid(), %s, 'hadahan', '', '{}', %s, '{}', '{}', '', %s, %s, %s)"
        " RETURNING id, expires_at"
    )
    with connected() as db:
        free = db.execute(insert, (user, "free", None, saved_at, saved_at)).fetchone()
        assert free is not None
        free_id, expires = free
        assert expires == saved_at + dt.timedelta(days=7)
        paid = db.execute(insert, (user, "paid", "order-1", saved_at, saved_at)).fetchone()
        assert paid is not None
        assert paid[1] is None
        # The old backend's unlock sets only the order.
        upgraded = db.execute(
            "UPDATE sidera.saved_reports SET purchase_id = 'order-2' WHERE id = %s"
            " RETURNING expires_at",
            (free_id,),
        ).fetchone()
        assert upgraded == (None,)
        # Without the trigger, the check still refuses a paid report with an expiry.
        db.execute("ALTER TABLE sidera.saved_reports DISABLE TRIGGER saved_reports_expiry")
        with pytest.raises(psycopg.errors.CheckViolation):
            db.execute(
                "UPDATE sidera.saved_reports SET expires_at = now() WHERE id = %s", (free_id,)
            )


def test_the_chapters_go_with_the_account_and_the_order_stays() -> None:
    from app.tiers.prices import Price

    url = need_postgres()
    migrate(url)
    user = "00000000-0000-0000-0000-000000000001"
    accounts_store = postgres_accounts(url)
    accounts_store.add_user(user, "google")
    orders = postgres_orders(url)
    orders.create_coupon("free", 100)
    order, _ = orders.redeem(user, "free", "hadahan", "h", Price(80_000, "LKR"))
    chapters = postgres_chapters(url)
    assert chapters.keep(order.id, user, "en", "chart.work", "First.") == "First."
    assert chapters.keep(order.id, user, "en", "chart.work", "Second.") == "First."
    assert chapters.kept(order.id, "en") == {"chart.work": "First."}
    assert chapters.kept(order.id, "si") == {}
    chapters.forget_order(order.id, user)
    assert chapters.kept(order.id, "en") == {}
    chapters.keep(order.id, user, "en", "chart.work", "Third.")
    accounts_store.delete_user(user)
    assert chapters.kept(order.id, "en") == {}
    with connected() as db:
        assert db.execute("SELECT count(*) FROM sidera.orders").fetchone() == (1,)
