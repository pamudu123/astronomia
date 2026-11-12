"""The share store: hashed codes, expiry and delete."""

import datetime as dt
import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest

from app.store.shares import DeleteRefused, PostgresShareStore, ShareStore, Store

# PostgreSQL tests run when a test database is given (CI always gives one).
PG_URL = os.environ.get("ASTRONOMIA_TEST_DATABASE_URL", "")

START = dt.datetime(2026, 11, 12, 8, 0, tzinfo=dt.UTC)


class Clock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> dt.datetime:
        return self.now


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture(params=["sqlite", "postgres"])
def store(request: pytest.FixtureRequest, tmp_path: Path, clock: Clock) -> Iterator[Store]:
    if request.param == "sqlite":
        yield ShareStore(tmp_path / "var" / "shares.sqlite", clock)
        return
    if not PG_URL:
        pytest.skip("no test PostgreSQL (set ASTRONOMIA_TEST_DATABASE_URL)")
    with psycopg.connect(PG_URL) as db:
        db.execute("DROP TABLE IF EXISTS shares")
    yield PostgresShareStore(PG_URL, clock)


def raw(store: Store) -> str:
    """Everything in the table, as text, straight from the database."""
    if isinstance(store, ShareStore):
        db = sqlite3.connect(store.path)
        try:
            return repr(db.execute("SELECT * FROM shares").fetchall())
        finally:
            db.close()
    assert isinstance(store, PostgresShareStore)
    with psycopg.connect(store.url) as pg:
        return repr(pg.execute("SELECT * FROM shares").fetchall())


def test_create_and_open(store: Store) -> None:
    created = store.create("hadahan", {"name": "Nimali"}, days=30)
    assert len(created.code) >= 22
    assert created.code != created.delete_token
    assert created.expires_at == START + dt.timedelta(days=30)
    found = store.get(created.code)
    assert found is not None
    assert (found.kind, found.payload, found.expires_at) == (
        "hadahan",
        {"name": "Nimali"},
        created.expires_at,
    )


def test_only_hashes_are_stored(store: Store) -> None:
    created = store.create("hadahan", {}, days=30)
    table = raw(store)
    assert created.code not in table
    assert created.delete_token not in table


def test_codes_are_unique_and_unknown_codes_find_nothing(store: Store) -> None:
    codes = {store.create("hadahan", {}, days=30).code for _ in range(50)}
    assert len(codes) == 50
    assert store.get("A" * 22) is None


def test_a_link_expires(store: Store, clock: Clock) -> None:
    created = store.create("porondam", {}, days=30)
    clock.now = START + dt.timedelta(days=30) - dt.timedelta(seconds=1)
    assert store.get(created.code) is not None
    clock.now = START + dt.timedelta(days=30)
    assert store.get(created.code) is None
    # Expired rows are removed, not only hidden.
    assert raw(store) == "[]"


def test_delete_needs_the_right_token(store: Store) -> None:
    created = store.create("hadahan", {}, days=30)
    with pytest.raises(DeleteRefused):
        store.delete(created.code, "wrong")
    assert store.get(created.code) is not None
    assert store.delete(created.code, created.delete_token) is True
    assert store.get(created.code) is None
    assert store.delete(created.code, created.delete_token) is False


def test_the_database_setting_picks_postgres(tmp_path: Path) -> None:
    from app.api.deps import share_store
    from app.config import Settings

    sqlite = share_store(Settings(shares_db=tmp_path / "s.sqlite"))
    assert isinstance(sqlite, ShareStore)
    if not PG_URL:
        pytest.skip("no test PostgreSQL (set ASTRONOMIA_TEST_DATABASE_URL)")
    assert isinstance(share_store(Settings(database_url=PG_URL)), PostgresShareStore)
