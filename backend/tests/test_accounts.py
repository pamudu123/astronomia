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
    FREE_KEEP,
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


def test_free_and_paid_reports_have_their_own_limits(store: AccountStore) -> None:
    user = new_user(store)
    store.save(user, report(key="free"), limit=1)
    with pytest.raises(LimitReached):
        store.save(user, report(key="free-2"), limit=1)
    # Free reports leave room for paid ones, and paid ones for free ones.
    store.save(user, report(key="paid"), limit=1, purchase_id="order-1")
    with pytest.raises(LimitReached):
        store.save(user, report(key="paid-2"), limit=1, purchase_id="order-2")
    assert store.count_saved(user) == 2


# Free reports are deleted 7 days after saving (docs/18, section 3)


def test_a_free_report_is_deleted_seven_days_after_saving(
    store: AccountStore, clock: Clock
) -> None:
    user = new_user(store)
    item, _ = store.save(user, report(), limit=10)
    assert item.paid is False
    assert item.expires_at == START + FREE_KEEP
    assert store.list_saved(user)[0].expires_at == START + FREE_KEEP

    clock.now = START + FREE_KEEP - dt.timedelta(seconds=1)
    assert store.get_saved(user, item.id) is not None
    assert store.count_saved(user) == 1

    clock.now = START + FREE_KEEP
    assert store.get_saved(user, item.id) is None  # hidden the moment its time comes
    assert store.rename(user, item.id, "late") is False
    assert store.list_saved(user) == []
    assert store.count_saved(user) == 0
    # ...and deleted, not hidden: going back in time does not bring it back.
    clock.now = START
    assert store.get_saved(user, item.id) is None


def test_saving_again_does_not_restart_the_seven_days(store: AccountStore, clock: Clock) -> None:
    user = new_user(store)
    store.save(user, report(key="same"), limit=10)
    clock.advance(days=3)
    again, created = store.save(user, report(key="same"), limit=10)
    assert created is False
    assert again.expires_at == START + FREE_KEEP


def test_an_expired_report_frees_its_place_and_can_be_saved_anew(
    store: AccountStore, clock: Clock
) -> None:
    user = new_user(store)
    store.save(user, report(key="1"), limit=1)
    with pytest.raises(LimitReached):
        store.save(user, report(key="2"), limit=1)
    clock.advance(days=7)
    second, created = store.save(user, report(key="2"), limit=1)
    assert created is True
    assert second.expires_at == clock.now + FREE_KEEP
    again, created = store.save(user, report(key="1"), limit=1, purchase_id="order-1")
    assert created is True  # the old free copy was deleted: this is a new, paid report
    assert again.expires_at is None


def test_a_paid_report_never_expires(store: AccountStore, clock: Clock) -> None:
    user = new_user(store)
    item, _ = store.save(user, report(), limit=10, purchase_id="order-1")
    assert (item.paid, item.expires_at) == (True, None)
    clock.advance(days=3650)
    assert store.delete_expired() == 0
    opened = store.get_saved(user, item.id)
    assert opened is not None
    assert (opened.paid, opened.expires_at) == (True, None)


def test_unlocking_a_free_report_stops_it_expiring_and_keeps_its_place(
    store: AccountStore, clock: Clock
) -> None:
    user = new_user(store)
    older, _ = store.save(user, report("Nimali", "a"), limit=10)
    clock.advance(minutes=1)
    newer, _ = store.save(user, report("Kasun", "b"), limit=10)
    clock.advance(days=6)

    upgraded, created = store.save(user, report("Nimali", "a"), limit=10, purchase_id="order-1")
    assert created is False
    assert upgraded.id == older.id
    assert (upgraded.paid, upgraded.expires_at, upgraded.created_at) == (True, None, START)

    clock.advance(days=2)  # past the free report's 7 days
    listed = store.list_saved(user)
    assert [(item.id, item.paid) for item in listed] == [(older.id, True)]
    assert newer.id not in {item.id for item in listed}


def test_an_unlocked_report_does_not_count_as_free(store: AccountStore) -> None:
    user = new_user(store)
    store.save(user, report(key="1"), limit=1)
    store.save(user, report(key="1"), limit=1, purchase_id="order-1")
    store.save(user, report(key="2"), limit=1)  # the free place is free again


def test_the_hourly_job_deletes_every_accounts_expired_reports(
    store: AccountStore, clock: Clock
) -> None:
    one, two, three = new_user(store), new_user(store, "google"), new_user(store)
    store.save(one, report("A", "a"), limit=10)
    store.save(two, report("B", "b"), limit=10)
    store.save(two, report("C", "c"), limit=10, purchase_id="order-1")
    clock.advance(days=7)
    store.save(three, report("D", "d"), limit=10)  # saved later: not yet
    assert store.delete_expired() == 2
    assert store.delete_expired() == 0
    assert store.list_saved(one) == []
    assert [item.summary["name"] for item in store.list_saved(two)] == ["C"]
    assert [item.summary["name"] for item in store.list_saved(three)] == ["D"]


def test_moving_a_guest_keeps_each_reports_expiry(store: AccountStore, clock: Clock) -> None:
    guest = new_user(store)
    google = new_user(store, "google")
    store.save(guest, report("Nimali", "a"), limit=10)
    store.save(guest, report("Kasun", "b"), limit=10, purchase_id="order-1")
    clock.advance(days=2)
    store.move_reports(guest, google)
    by_name = {item.summary["name"]: item for item in store.list_saved(google)}
    assert by_name["Nimali"].expires_at == START + FREE_KEEP
    assert by_name["Kasun"].expires_at is None


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


def test_an_older_file_gets_expiry_for_its_free_reports(tmp_path: Path, clock: Clock) -> None:
    path = tmp_path / "accounts.sqlite"
    store = sqlite_accounts(path, clock)
    user = new_user(store)
    free, _ = store.save(user, report("Nimali", "a"), limit=10)
    store.save(user, report("Kasun", "b"), limit=10, purchase_id="order-1")
    db = sqlite3.connect(path)  # as the file was before free reports expired
    try:
        db.execute("ALTER TABLE saved_reports DROP COLUMN expires_at")
        db.commit()
    finally:
        db.close()
    store = sqlite_accounts(path, clock)
    by_name = {item.summary["name"]: item for item in store.list_saved(user)}
    assert by_name["Nimali"].expires_at == START + FREE_KEEP
    assert by_name["Kasun"].expires_at is None
    clock.advance(days=7)
    assert store.get_saved(user, free.id) is None


def test_the_database_setting_picks_postgres(tmp_path: Path) -> None:
    settings = Settings(accounts_db=tmp_path / "a.sqlite")
    assert isinstance(account_store(settings), AccountStore)
    url = need_postgres()
    migrate(url)
    assert account_store(Settings(database_url=url)) is account_store(Settings(database_url=url))
