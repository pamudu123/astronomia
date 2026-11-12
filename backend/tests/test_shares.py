"""The share store: hashed codes, expiry and delete."""

import datetime as dt
import sqlite3
from pathlib import Path

import pytest

from app.store.shares import DeleteRefused, ShareStore

START = dt.datetime(2026, 11, 12, 8, 0, tzinfo=dt.UTC)


class Clock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> dt.datetime:
        return self.now


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def store(tmp_path: Path, clock: Clock) -> ShareStore:
    return ShareStore(tmp_path / "var" / "shares.sqlite", clock)


def raw(store: ShareStore) -> str:
    db = sqlite3.connect(store.path)
    try:
        return repr(db.execute("SELECT * FROM shares").fetchall())
    finally:
        db.close()


def test_create_and_open(store: ShareStore) -> None:
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


def test_only_hashes_are_stored(store: ShareStore) -> None:
    created = store.create("hadahan", {}, days=30)
    table = raw(store)
    assert created.code not in table
    assert created.delete_token not in table


def test_codes_are_unique_and_unknown_codes_find_nothing(store: ShareStore) -> None:
    codes = {store.create("hadahan", {}, days=30).code for _ in range(50)}
    assert len(codes) == 50
    assert store.get("A" * 22) is None


def test_a_link_expires(store: ShareStore, clock: Clock) -> None:
    created = store.create("porondam", {}, days=30)
    clock.now = START + dt.timedelta(days=30) - dt.timedelta(seconds=1)
    assert store.get(created.code) is not None
    clock.now = START + dt.timedelta(days=30)
    assert store.get(created.code) is None
    # Expired rows are removed, not only hidden.
    assert raw(store) == "[]"


def test_delete_needs_the_right_token(store: ShareStore) -> None:
    created = store.create("hadahan", {}, days=30)
    with pytest.raises(DeleteRefused):
        store.delete(created.code, "wrong")
    assert store.get(created.code) is not None
    assert store.delete(created.code, created.delete_token) is True
    assert store.get(created.code) is None
    assert store.delete(created.code, created.delete_token) is False
