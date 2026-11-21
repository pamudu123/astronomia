"""The account store: guest accounts, sessions and saved reports, in SQLite and PostgreSQL."""

import datetime as dt
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.api.deps import account_store
from app.config import Settings
from app.store.accounts import (
    AccountStore,
    LimitReached,
    NewReport,
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


def test_a_guest_session_finds_its_account(store: AccountStore) -> None:
    session = store.create_guest()
    assert session.user.kind == "guest"
    assert len(session.token) >= 40
    found = store.find_session(session.token)
    assert found is not None
    assert found.user == session.user
    assert found.renewed is False
    assert store.find_session("not-a-session") is None


def test_only_a_hash_of_the_session_is_kept(tmp_path: Path, clock: Clock) -> None:
    path = tmp_path / "accounts.sqlite"
    session = sqlite_accounts(path, clock).create_guest()
    db = sqlite3.connect(path)
    try:
        rows = repr(db.execute("SELECT * FROM sessions").fetchall())
    finally:
        db.close()
    assert session.token not in rows


def test_a_session_is_renewed_once_a_day(store: AccountStore, clock: Clock) -> None:
    session = store.create_guest()
    clock.advance(hours=23)
    found = store.find_session(session.token)
    assert found is not None and found.renewed is False
    clock.advance(hours=2)
    found = store.find_session(session.token)
    assert found is not None and found.renewed is True
    assert found.expires_at == clock.now + dt.timedelta(days=365)


def test_an_expired_session_is_gone(store: AccountStore, clock: Clock) -> None:
    session = store.create_guest()
    clock.advance(days=366)
    assert store.find_session(session.token) is None


def test_ending_a_session(store: AccountStore) -> None:
    session = store.create_guest()
    store.end_session(session.token)
    assert store.find_session(session.token) is None


def test_save_list_open_rename_delete(store: AccountStore, clock: Clock) -> None:
    user = store.create_guest().user.id
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
    user = store.create_guest().user.id
    first, _ = store.save(user, report(key="same"), limit=10)
    again, created = store.save(user, report(key="same"), limit=10)
    assert created is False
    assert again.id == first.id
    assert store.count_saved(user) == 1


def test_one_account_never_sees_anothers_reports(store: AccountStore) -> None:
    mine = store.create_guest().user.id
    theirs = store.create_guest().user.id
    item, _ = store.save(mine, report(key="same"), limit=10)
    store.save(theirs, report(key="same"), limit=10)  # the same input is fine for two people

    assert store.get_saved(theirs, item.id) is None
    assert store.rename(theirs, item.id, "x") is False
    assert store.delete_saved(theirs, item.id) is False
    assert len(store.list_saved(theirs)) == 1
    assert store.get_saved(mine, item.id) is not None


def test_the_limit(store: AccountStore) -> None:
    user = store.create_guest().user.id
    store.save(user, report(key="1"), limit=2)
    store.save(user, report(key="2"), limit=2)
    with pytest.raises(LimitReached):
        store.save(user, report(key="3"), limit=2)
    # Saving one already kept still answers, even when full.
    assert store.save(user, report(key="1"), limit=2)[1] is False


def test_deleting_an_account_deletes_everything(store: AccountStore) -> None:
    session = store.create_guest()
    item, _ = store.save(session.user.id, report(), limit=10)
    store.delete_user(session.user.id)
    assert store.find_session(session.token) is None
    assert store.get_saved(session.user.id, item.id) is None
    assert store.list_saved(session.user.id) == []


def test_unused_guests_are_cleared_out(store: AccountStore, clock: Clock) -> None:
    idle = store.create_guest()
    idle_item, _ = store.save(idle.user.id, report(), limit=10)
    active = store.create_guest()
    for _ in range(13):  # used every month, so renewed
        clock.advance(days=30)
        assert store.find_session(active.token) is not None
    clock.advance(days=6)
    store.create_guest()  # clean up runs when a guest is made
    assert store.find_session(active.token) is not None
    assert store.get_saved(idle.user.id, idle_item.id) is None
    assert store.find_session(idle.token) is None


def test_reopening_keeps_the_data(tmp_path: Path, clock: Clock) -> None:
    path = tmp_path / "accounts.sqlite"
    session = sqlite_accounts(path, clock).create_guest()
    again = sqlite_accounts(path, clock)
    assert again.find_session(session.token) is not None


def test_the_database_setting_picks_postgres(tmp_path: Path) -> None:
    settings = Settings(accounts_db=tmp_path / "a.sqlite")
    assert isinstance(account_store(settings), AccountStore)
    url = need_postgres()
    migrate(url)
    assert account_store(Settings(database_url=url)) is account_store(Settings(database_url=url))


def test_a_first_report_and_its_guest_are_kept_together(store: AccountStore) -> None:
    session, item = store.create_guest_with(report(), limit=5)
    found = store.find_session(session.token)
    assert found is not None and found.user == session.user
    assert [saved.id for saved in store.list_saved(session.user.id)] == [item.id]


def test_a_first_save_that_fails_leaves_no_account(store: AccountStore) -> None:
    with pytest.raises(LimitReached):
        store.create_guest_with(report(), limit=0)
    with store._connect() as db:
        (users,) = store._run(db, "SELECT COUNT(*) FROM {users}").fetchone()
        (sessions,) = store._run(db, "SELECT COUNT(*) FROM {sessions}").fetchone()
    assert (users, sessions) == (0, 0)
