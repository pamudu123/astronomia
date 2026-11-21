"""The account store: accounts for Supabase users and their saved reports, SQLite and PostgreSQL."""

import datetime as dt
import sqlite3
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.api.deps import account_store
from app.config import Settings
from app.store.accounts import (
    AccountStore,
    Kind,
    LimitReached,
    NewReport,
    User,
    postgres_accounts,
    sqlite_accounts,
)
from tests.pg import migrate, need_postgres

START = dt.datetime(2026, 11, 15, 8, 0, tzinfo=dt.UTC)


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
def store(request: pytest.FixtureRequest, tmp_path: Path, clock: Clock) -> Iterator[AccountStore]:
    if request.param == "sqlite":
        yield sqlite_accounts(tmp_path / "var" / "accounts.sqlite", clock)
        return
    url = need_postgres()
    migrate(url)
    yield postgres_accounts(url, clock)


def report(name: str = "Nimali", key: str = "a") -> NewReport:
    return NewReport(
        kind="hadahan",
        input={"kind": "hadahan", "name": name},
        input_hash=f"hash-{key}",
        snapshot={"name": name, "result": {"en": {}, "si": {}}},
        summary={"name": name},
        rules="kuja_v1",
    )


def new_user(store: AccountStore, kind: Kind = "guest") -> str:
    return store.add_user(str(uuid.uuid4()), kind).id


def test_an_account_is_made_once_per_supabase_user(store: AccountStore) -> None:
    user_id = str(uuid.uuid4())
    assert store.find_user(user_id, "guest") is None
    assert store.add_user(user_id, "guest") == User(user_id, "guest")
    assert store.add_user(user_id, "guest") == User(user_id, "guest")  # a second call is fine
    assert store.find_user(user_id, "guest") == User(user_id, "guest")


def test_a_guest_who_links_google_becomes_google_for_good(store: AccountStore) -> None:
    user_id = new_user(store)
    item, _ = store.save(user_id, report(), limit=10)
    assert store.find_user(user_id, "google") == User(user_id, "google")
    assert store.find_user(user_id, "guest") == User(user_id, "google")
    assert store.add_user(user_id, "guest") == User(user_id, "google")
    assert store.get_saved(user_id, item.id) is not None


def test_last_seen_is_written_once_a_day(store: AccountStore, clock: Clock) -> None:
    user_id = new_user(store)

    def last_seen() -> dt.datetime:
        with store._connect() as db:
            (value,) = store._run(
                db, "SELECT last_seen_at FROM {users} WHERE id = ?", (user_id,)
            ).fetchone()
        return store._read_ts(value)

    clock.advance(hours=23)
    store.find_user(user_id, "guest")
    assert last_seen() == START
    clock.advance(hours=2)
    store.find_user(user_id, "guest")
    assert last_seen() == clock.now


def test_save_list_open_rename_delete(store: AccountStore, clock: Clock) -> None:
    user = new_user(store)
    first, created = store.save(user, report("Nimali", "a"), limit=10)
    assert created is True
    clock.advance(minutes=1)
    second, _ = store.save(user, report("Kasun", "b"), limit=10)

    assert [item.id for item in store.list_saved(user)] == [second.id, first.id]
    assert store.count_saved(user) == 2

    opened = store.get_saved(user, first.id)
    assert opened is not None
    assert opened.input == {"kind": "hadahan", "name": "Nimali"}
    assert opened.snapshot["name"] == "Nimali"
    assert opened.summary == {"name": "Nimali"}
    assert opened.created_at == START

    assert store.rename(user, first.id, "My chart") is True
    assert store.list_saved(user)[1].title == "My chart"

    assert store.delete_saved(user, first.id) is True
    assert store.delete_saved(user, first.id) is False
    assert store.get_saved(user, first.id) is None
    assert store.count_saved(user) == 1


def test_saving_the_same_input_twice_keeps_one(store: AccountStore) -> None:
    user = new_user(store)
    first, _ = store.save(user, report(key="same"), limit=10)
    again, created = store.save(user, report(key="same"), limit=10)
    assert created is False
    assert again.id == first.id
    assert store.count_saved(user) == 1


def test_one_account_never_sees_anothers_reports(store: AccountStore) -> None:
    mine = new_user(store)
    theirs = new_user(store, "google")
    item, _ = store.save(mine, report(key="same"), limit=10)
    store.save(theirs, report(key="same"), limit=10)  # the same input is fine for two people

    assert store.get_saved(theirs, item.id) is None
    assert store.rename(theirs, item.id, "x") is False
    assert store.delete_saved(theirs, item.id) is False
    assert len(store.list_saved(theirs)) == 1
    assert store.get_saved(mine, item.id) is not None


def test_moving_a_guests_reports_into_another_account(store: AccountStore) -> None:
    guest = new_user(store)
    google = new_user(store, "google")
    store.save(guest, report("Nimali", "a"), limit=10)
    store.save(guest, report("Kasun", "b"), limit=10)
    already, _ = store.save(google, report("Kasun", "b"), limit=10)
    store.save(google, report("Amma", "c"), limit=10)

    assert store.move_reports(guest, google) == 1  # Kasun is kept once
    names = sorted(item.summary["name"] for item in store.list_saved(google))
    assert names == ["Amma", "Kasun", "Nimali"]
    assert store.get_saved(google, already.id) is not None
    assert store.find_user(guest, "guest") is None
    assert store.list_saved(guest) == []
    assert store.move_reports(google, google) == 0


def test_the_limit(store: AccountStore) -> None:
    user = new_user(store)
    store.save(user, report(key="1"), limit=2)
    store.save(user, report(key="2"), limit=2)
    with pytest.raises(LimitReached):
        store.save(user, report(key="3"), limit=2)
    # Saving one already kept still answers, even when full.
    assert store.save(user, report(key="1"), limit=2)[1] is False


def test_deleting_an_account_deletes_everything(store: AccountStore) -> None:
    user_id = new_user(store)
    other = new_user(store)
    item, _ = store.save(user_id, report(), limit=10)
    kept, _ = store.save(other, report(), limit=10)
    store.delete_user(user_id)
    assert store.find_user(user_id, "guest") is None
    assert store.get_saved(user_id, item.id) is None
    assert store.list_saved(user_id) == []
    assert store.get_saved(other, kept.id) is not None


def test_reopening_keeps_the_data(tmp_path: Path, clock: Clock) -> None:
    path = tmp_path / "accounts.sqlite"
    user_id = new_user(sqlite_accounts(path, clock))
    assert sqlite_accounts(path, clock).find_user(user_id, "guest") is not None


def test_an_old_sessions_table_is_dropped(tmp_path: Path, clock: Clock) -> None:
    path = tmp_path / "accounts.sqlite"
    db = sqlite3.connect(path)
    try:
        db.execute("CREATE TABLE sessions (token_hash TEXT PRIMARY KEY)")
        db.commit()
    finally:
        db.close()
    sqlite_accounts(path, clock)
    db = sqlite3.connect(path)
    try:
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master")}
    finally:
        db.close()
    assert "sessions" not in tables


def test_the_database_setting_picks_postgres(tmp_path: Path) -> None:
    settings = Settings(accounts_db=tmp_path / "a.sqlite")
    assert isinstance(account_store(settings), AccountStore)
    url = need_postgres()
    migrate(url)
    assert account_store(Settings(database_url=url)) is account_store(Settings(database_url=url))
