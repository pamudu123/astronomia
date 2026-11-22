"""Astro chat limits over the API (docs/18 section 5, docs/21), on a clock the tests move."""

import datetime as dt
import sqlite3
import uuid
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.store.accounts import AccountStore
from app.store.chat import ChatStore
from app.store.orders import OrderStore
from app.tiers.prices import Price
from tests.auth import bearer, token
from tests.conftest import Clock

KEY = {"X-Chat-Key": "chat-key"}
BROWSER = "b-0000-aaaa-1111"
HOME = "203.0.113.7"


def limits(client: TestClient, **more: Any) -> Settings:
    settings = Settings(**{"chat_key": "chat-key", **more})
    client.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    return settings


@pytest.fixture(autouse=True)
def chat_on(client: TestClient) -> None:
    limits(client)


@pytest.fixture
def chat_db(tmp_path: Path, chats: ChatStore) -> Path:
    """The SQLite file behind the `chats` store (tests/conftest.py)."""
    return tmp_path / "chat.sqlite"


def asker(browser: str = BROWSER, address: str = HOME, **more: Any) -> dict[str, Any]:
    return {"browser": browser, "address": address, **more}


def status(client: TestClient, headers: dict[str, str] | None = None, **who: Any) -> Any:
    response = client.post("/v1/chat/status", json=asker(**who), headers={**KEY, **(headers or {})})
    assert response.status_code == 200, response.text
    return response.json()


def ask(
    client: TestClient,
    expect: int = 201,
    headers: dict[str, str] | None = None,
    length: int = 20,
    **who: Any,
) -> Any:
    response = client.post(
        "/v1/chat/turns", json=asker(length=length, **who), headers={**KEY, **(headers or {})}
    )
    assert response.status_code == expect, response.text
    return response.json()


def answer(client: TestClient, turn: str, cost: float = 0.01, suggest: bool = False) -> None:
    """The AI service takes the question up and reports what the answer cost (US dollars)."""
    purpose = "suggest" if suggest else "answer"
    started = client.post(f"/v1/chat/turns/{turn}/start", json={"purpose": purpose}, headers=KEY)
    assert started.status_code == 200, started.text
    used = client.post(
        f"/v1/chat/turns/{turn}/usage",
        json={
            "input_tokens": 9000,
            "cached_tokens": 4000,
            "output_tokens": 600,
            "cost_micros": round(cost * 1_000_000),
        },
        headers=KEY,
    )
    assert used.status_code == 204, used.text


def paid_account(accounts: AccountStore, orders: OrderStore, reports: int = 1) -> dict[str, str]:
    """A Google account that unlocked `reports` reports with a free coupon. Gives its headers."""
    user_id = str(uuid.uuid4())
    accounts.add_user(user_id, "google")
    if not any(c.code == "free" for c in orders.list_coupons()):
        orders.create_coupon("free", 100, max_uses_per_account=1000)
    for n in range(reports):
        orders.redeem(user_id, "free", "hadahan", f"report-{n}", Price(250, "USD"))
    return bearer(token(user_id, anonymous=False))


def when(value: str | None) -> dt.datetime | None:
    return dt.datetime.fromisoformat(value) if value else None


# Free questions


def test_free_users_see_two_questions_from_the_start(client: TestClient) -> None:
    found = status(client)
    assert found == {
        "mode": "free",
        "max_length": 1000,
        "free": {"limit": 2, "left": 2, "resets_at": None},
        "paid": None,
        "blocked": None,
    }


def test_two_free_questions_a_week_then_a_date(client: TestClient, clock: Clock) -> None:
    first = clock.now
    one = ask(client)
    assert one["kind"] == "free"
    assert one["status"]["free"]["left"] == 1
    answer(client, one["turn"])
    clock.advance(days=2)
    answer(client, ask(client)["turn"])

    refused = ask(client, expect=429)
    assert refused["reason"] == "free_used"
    # The week started at the first question, not at the last.
    assert when(refused["until"]) == first + dt.timedelta(days=7)
    assert refused["status"]["free"]["left"] == 0
    assert refused["status"]["blocked"]["reason"] == "free_used"

    clock.advance(days=5, seconds=-1)
    assert ask(client, expect=429)["reason"] == "free_used"
    clock.advance(seconds=1)
    back = status(client)
    assert back["free"] == {"limit": 2, "left": 2, "resets_at": None}
    assert back["blocked"] is None


def test_the_next_week_starts_at_its_own_first_question(client: TestClient, clock: Clock) -> None:
    answer(client, ask(client)["turn"])
    clock.advance(days=9)  # a quiet week, then one question on day 9
    second_week = clock.now
    answer(client, ask(client)["turn"])
    clock.advance(days=3)
    answer(client, ask(client)["turn"])
    refused = ask(client, expect=429)
    assert when(refused["until"]) == second_week + dt.timedelta(days=7)


def test_each_browser_has_its_own_questions(client: TestClient) -> None:
    answer(client, ask(client)["turn"])
    answer(client, ask(client)["turn"])
    assert ask(client, expect=429)["reason"] == "free_used"
    # Another browser (or cleared cookies) has its own two: accepted for 2 questions (docs/18).
    assert ask(client, browser="other-browser-1")["kind"] == "free"


def test_a_question_the_assistant_never_took_up_is_not_counted(
    client: TestClient, clock: Clock
) -> None:
    ask(client)  # the AI service failed before it took the question up
    assert status(client)["free"]["left"] == 1  # still counted while it may yet start
    clock.advance(minutes=3)
    assert status(client)["free"]["left"] == 2


# Cost controls


def test_a_burst_of_messages_is_slowed_down(
    client: TestClient, clock: Clock, accounts: AccountStore, orders: OrderStore
) -> None:
    paid = paid_account(accounts, orders, reports=5)
    for _ in range(5):
        ask(client, headers=paid)
    refused = ask(client, expect=429, headers=paid)
    assert refused["reason"] == "burst"
    assert when(refused["until"]) == clock.now + dt.timedelta(minutes=1)
    clock.advance(seconds=61)
    assert ask(client, headers=paid)["kind"] == "paid"


def test_one_network_gets_ten_free_questions_a_week(client: TestClient, clock: Clock) -> None:
    first = clock.now
    for n in range(10):  # five browsers, as if the cookie were cleared again and again
        answer(client, ask(client, browser=f"browser-{n // 2:04d}")["turn"])
        clock.advance(minutes=1)
    refused = ask(client, expect=429, browser="browser-new1")
    assert refused["reason"] == "network"
    assert when(refused["until"]) == first + dt.timedelta(days=7)
    # Another network is not affected.
    assert ask(client, browser="browser-new1", address="198.51.100.4")["kind"] == "free"


def test_an_ipv6_home_counts_as_one_network(client: TestClient) -> None:
    limits(client, chat_network_per_week=2)
    ask(client, browser="browser-0001", address="2001:db8:1:2::10")
    ask(client, browser="browser-0002", address="2001:db8:1:2:ffff::99")
    assert (
        ask(client, browser="browser-0003", address="2001:db8:1:2::1", expect=429)["reason"]
        == "network"
    )
    assert ask(client, browser="browser-0003", address="2001:db8:1:3::1")["kind"] == "free"


def test_a_busy_day_stops_free_chat_but_not_paid(
    client: TestClient, clock: Clock, accounts: AccountStore, orders: OrderStore
) -> None:
    limits(client, chat_free_daily_usd=0.05)
    for n in range(2):
        answer(client, ask(client, browser=f"browser-{n:04d}", address=f"10.0.0.{n}")["turn"], 0.03)
    refused = ask(client, browser="browser-late", address="10.0.0.9", expect=429)
    assert refused["reason"] == "busy"
    # Back at midnight in Sri Lanka (UTC+5:30).
    assert when(refused["until"]) == dt.datetime(2026, 11, 22, 18, 30, tzinfo=dt.UTC)
    # Paid chat goes on.
    paid = paid_account(accounts, orders)
    assert ask(client, browser="browser-paid", headers=paid)["kind"] == "paid"
    clock.now = dt.datetime(2026, 11, 22, 18, 30, tzinfo=dt.UTC)
    assert ask(client, browser="browser-late", address="10.0.0.9")["kind"] == "free"


def test_answers_still_being_written_count_toward_the_daily_ceiling(
    client: TestClient, clock: Clock
) -> None:
    # Each answer is costed at the average (USD 0.01) until its cost arrives.
    limits(client, chat_free_daily_usd=0.03)
    for n in range(3):
        ask(client, browser=f"browser-{n:04d}", address=f"10.0.0.{n}")
    assert ask(client, browser="browser-0009", address="10.0.0.9", expect=429)["reason"] == "busy"
    clock.advance(minutes=11)  # they never reported: no longer counted
    assert ask(client, browser="browser-0009", address="10.0.0.9")["kind"] == "free"


def test_long_messages_are_refused(client: TestClient) -> None:
    refused = ask(client, expect=413, length=1001)
    assert refused["reason"] == "too_long"
    assert refused["status"]["free"]["left"] == 2  # nothing used
    assert ask(client, length=1000)["kind"] == "free"


def test_every_limit_is_a_setting(client: TestClient) -> None:
    limits(client, chat_free_per_week=3, chat_max_length=200)
    found = status(client)
    assert found["free"]["limit"] == 3
    assert found["max_length"] == 200


# Paid allowance


def test_a_paid_report_adds_about_twenty_questions(
    client: TestClient, accounts: AccountStore, orders: OrderStore
) -> None:
    paid = paid_account(accounts, orders)
    found = status(client, headers=paid)
    assert found["mode"] == "paid"
    assert found["paid"] == {"questions_left": 20, "questions_total": 20, "used_share": 0.0}

    two = paid_account(accounts, orders, reports=2)
    assert status(client, headers=two)["paid"]["questions_total"] == 40


def test_the_allowance_is_measured_by_real_cost(
    client: TestClient, clock: Clock, accounts: AccountStore, orders: OrderStore
) -> None:
    paid = paid_account(accounts, orders)  # USD 0.20: 20 answers at USD 0.01
    turn = ask(client, headers=paid)
    assert turn["kind"] == "paid"
    answer(client, turn["turn"], cost=0.05)  # a long answer uses more
    found = status(client, headers=paid)
    assert found["paid"]["questions_left"] == 15
    assert found["paid"]["used_share"] == pytest.approx(0.25)

    clock.advance(minutes=1)
    answer(client, ask(client, headers=paid)["turn"], cost=0.11)  # 80% used: the gentle note
    assert status(client, headers=paid)["paid"]["used_share"] == pytest.approx(0.8)
    # The allowance is kept until used: a month later it is still there.
    clock.advance(days=30)
    assert status(client, headers=paid)["paid"]["questions_left"] == 4


def test_when_the_allowance_is_used_the_free_questions_remain(
    client: TestClient, clock: Clock, accounts: AccountStore, orders: OrderStore
) -> None:
    paid = paid_account(accounts, orders)
    answer(client, ask(client, headers=paid)["turn"], cost=0.25)
    used = status(client, headers=paid)
    assert used["mode"] == "free"
    assert used["paid"]["questions_left"] == 0
    assert used["free"]["left"] == 2
    clock.advance(minutes=1)
    answer(client, ask(client, headers=paid)["turn"])
    answer(client, ask(client, headers=paid)["turn"])
    refused = ask(client, headers=paid, expect=429)
    assert refused["reason"] == "paid_used"  # "You've used the chat that came with your reports"


def test_free_and_paid_questions_do_not_mix(
    client: TestClient, accounts: AccountStore, orders: OrderStore
) -> None:
    paid = paid_account(accounts, orders)
    for _ in range(3):
        answer(client, ask(client, headers=paid)["turn"])
    # Paid questions used none of this browser's free questions...
    assert status(client)["free"]["left"] == 2
    assert status(client, headers=paid)["free"]["left"] == 2
    # ...and a free question uses none of the allowance.
    answer(client, ask(client)["turn"], cost=0.05)
    assert status(client, headers=paid)["paid"]["questions_left"] == 17
    # A guest (anonymous sign in) has no allowance: free questions, by browser.
    guest = bearer(token(str(uuid.uuid4()), anonymous=True))
    assert ask(client, headers=guest)["kind"] == "free"
    assert status(client, headers=guest)["paid"] is None


def test_paid_cost_does_not_count_toward_the_free_ceiling(
    client: TestClient, accounts: AccountStore, orders: OrderStore
) -> None:
    limits(client, chat_free_daily_usd=0.05)
    paid = paid_account(accounts, orders, reports=5)
    answer(client, ask(client, headers=paid)["turn"], cost=0.5)
    assert ask(client)["kind"] == "free"


def test_one_account_has_a_hard_daily_ceiling(
    client: TestClient, clock: Clock, accounts: AccountStore, orders: OrderStore
) -> None:
    limits(client, chat_account_daily_usd=0.10)
    paid = paid_account(accounts, orders, reports=10)
    answer(client, ask(client, headers=paid)["turn"], cost=0.12)
    refused = ask(client, headers=paid, expect=429)
    assert refused["reason"] == "account_day"
    assert when(refused["until"]) == dt.datetime(2026, 11, 22, 18, 30, tzinfo=dt.UTC)
    clock.now = dt.datetime(2026, 11, 22, 18, 30, tzinfo=dt.UTC)
    assert ask(client, headers=paid)["kind"] == "paid"


def test_an_undone_order_takes_its_allowance_away(
    client: TestClient, accounts: AccountStore, orders: OrderStore
) -> None:
    user_id = str(uuid.uuid4())
    accounts.add_user(user_id, "google")
    orders.create_coupon("free", 100)
    order, _ = orders.redeem(user_id, "free", "hadahan", "h", Price(250, "USD"))
    paid = bearer(token(user_id, anonymous=False))
    assert status(client, headers=paid)["paid"]["questions_total"] == 20
    orders.void(order.id)
    assert status(client, headers=paid)["paid"] is None


# The AI service's side


def test_a_question_is_answered_once_and_suggested_once(client: TestClient, clock: Clock) -> None:
    turn = ask(client)["turn"]
    url = f"/v1/chat/turns/{turn}/start"
    # Follow-up buttons only come after the answer.
    assert client.post(url, json={"purpose": "suggest"}, headers=KEY).status_code == 409
    taken = client.post(url, json={"purpose": "answer"}, headers=KEY).json()
    assert taken == {"kind": "free", "max_length": 1000}
    assert client.post(url, json={"purpose": "answer"}, headers=KEY).status_code == 409
    assert client.post(url, json={"purpose": "suggest"}, headers=KEY).status_code == 200
    assert client.post(url, json={"purpose": "suggest"}, headers=KEY).status_code == 409


def test_a_question_must_be_taken_up_soon(client: TestClient, clock: Clock) -> None:
    turn = ask(client)["turn"]
    clock.advance(minutes=3)
    started = client.post(f"/v1/chat/turns/{turn}/start", json={}, headers=KEY)
    assert started.status_code == 409


def test_unknown_questions_cannot_be_started_or_charged(client: TestClient) -> None:
    unknown = str(uuid.uuid4())
    assert client.post(f"/v1/chat/turns/{unknown}/start", json={}, headers=KEY).status_code == 409
    usage = {"input_tokens": 1, "output_tokens": 1, "cost_micros": 1}
    charged = client.post(f"/v1/chat/turns/{unknown}/usage", json=usage, headers=KEY)
    assert charged.status_code == 404
    assert client.post("/v1/chat/turns/nope/start", json={}, headers=KEY).status_code == 422


def test_the_answer_and_its_buttons_add_up(client: TestClient, chat_db: Path) -> None:
    turn = ask(client)["turn"]
    answer(client, turn, cost=0.02)
    answer(client, turn, cost=0.001, suggest=True)
    with sqlite3.connect(chat_db) as db:
        row = db.execute(
            "SELECT input_tokens, output_tokens, cost_micros FROM chat_turns WHERE id = ?", (turn,)
        ).fetchone()
    assert row == (18000, 1200, 21000)


def test_only_the_chat_key_opens_these_endpoints(client: TestClient) -> None:
    assert client.post("/v1/chat/status", json=asker()).status_code == 401
    wrong = {"X-Chat-Key": "guess"}
    assert client.post("/v1/chat/turns", json=asker(length=1), headers=wrong).status_code == 401
    limits(client, chat_key="")
    assert client.post("/v1/chat/status", json=asker(), headers=KEY).status_code == 503


def test_a_strange_browser_id_is_refused(client: TestClient) -> None:
    bad = client.post("/v1/chat/status", json=asker(browser="x" * 65), headers=KEY)
    assert bad.status_code == 422
    assert (
        client.post("/v1/chat/status", json=asker(browser="a b c d e"), headers=KEY).status_code
        == 422
    )


# Privacy


def test_usage_records_keep_numbers_not_words(
    client: TestClient, chat_db: Path, accounts: AccountStore, orders: OrderStore
) -> None:
    answer(client, ask(client)["turn"])
    answer(client, ask(client, headers=paid_account(accounts, orders))["turn"])
    with sqlite3.connect(chat_db) as db:
        columns = [row[1] for row in db.execute("PRAGMA table_info(chat_turns)")]
        rows = db.execute("SELECT * FROM chat_turns").fetchall()
    assert columns == [
        "id",
        "kind",
        "user_id",
        "browser",
        "network",
        "week_start",
        "created_at",
        "started_at",
        "suggested",
        "input_tokens",
        "cached_tokens",
        "output_tokens",
        "cost_micros",
        "reported_at",
    ]
    text = repr(rows)
    assert HOME not in text  # only a keyed hash of the network
    free, paid = sorted(rows, key=lambda row: row[1])
    assert free[3] == BROWSER and free[2] is None
    assert paid[3] is None and paid[4] is None and paid[2] is not None


def test_deleting_the_account_deletes_its_chat_usage(
    client: TestClient, chat_db: Path, accounts: AccountStore, orders: OrderStore
) -> None:
    paid = paid_account(accounts, orders)
    answer(client, ask(client, headers=paid)["turn"])
    deleted = client.delete("/v1/me", headers=paid)
    assert deleted.status_code == 204, deleted.text
    with sqlite3.connect(chat_db) as db:
        assert db.execute("SELECT COUNT(*) FROM chat_turns").fetchone() == (0,)


def test_old_free_questions_are_not_kept(client: TestClient, clock: Clock, chat_db: Path) -> None:
    answer(client, ask(client)["turn"])
    clock.advance(days=9)
    ask(client, browser="someone-else")
    with sqlite3.connect(chat_db) as db:
        assert db.execute("SELECT browser FROM chat_turns").fetchall() == [("someone-else",)]
