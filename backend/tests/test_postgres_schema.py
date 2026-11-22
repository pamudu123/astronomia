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
        "coupon_misses",
        "coupons",
        "orders",
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
    postgres_accounts(url).save(user, fresh, limit=5)
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


def test_a_free_report_always_expires_and_a_paid_one_never() -> None:
    url = need_postgres()
    migrate(url)
    user = postgres_accounts(url).add_user("00000000-0000-0000-0000-000000000001", "guest").id
    insert = (
        "INSERT INTO sidera.saved_reports (id, user_id, kind, title, input, input_hash, snapshot,"
        " summary, rules, purchase_id, created_at, updated_at, expires_at) VALUES"
        " (gen_random_uuid(), %s, 'hadahan', '', '{}', %s, '{}', '{}', '', %s, now(), now(), %s)"
    )
    for purchase_id, expires in (("order-1", dt.datetime.now(dt.UTC)), (None, None)):
        with connected() as db, pytest.raises(psycopg.errors.CheckViolation):
            db.execute(insert, (user, "x", purchase_id, expires))
