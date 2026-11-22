"""Paid reports over the API: the price, coupons, unlocking and the paid check (docs/18)."""

import datetime as dt
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api import reports
from app.config import Settings, get_settings
from app.store.accounts import AccountStore
from app.store.orders import OrderStore
from tests.auth import bearer, token
from tests.test_api_saved import hadahan, porondam

PAID = ["ai_reading", "ai_explain", "full_detail", "full_pdf"]


def sign_in(client: TestClient, kind: str = "google") -> str:
    """Signs this browser in to Supabase (stand-in keys, tests/auth.py): a new account."""
    user_id = str(uuid.uuid4())
    client.headers.update(bearer(token(user_id, anonymous=kind == "guest")))
    return user_id


def paid_reports(client: TestClient, on: bool = True, **more: Any) -> None:
    settings = Settings(paid_reports=on, **more)
    client.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]


def apply(client: TestClient, code: str, kind: str = "hadahan", status: int = 200) -> Any:
    response = client.post("/v1/coupons/apply", json={"kind": kind, "code": code})
    assert response.status_code == status, response.text
    return response.json()


def unlock(client: TestClient, code: str, report: dict[str, Any] | None = None) -> Any:
    return client.post("/v1/reports/unlock", json={"report": report or hadahan(), "code": code})


def access(client: TestClient, report: dict[str, Any] | None = None) -> Any:
    response = client.post("/v1/reports/access", json=report or hadahan())
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def pamudu(orders: OrderStore) -> None:
    orders.create_coupon("pamudu", 100, max_uses=200, max_uses_per_account=10)


# Prices


def test_the_price_follows_the_buyers_country(client: TestClient) -> None:
    home = client.get(
        "/v1/price", params={"kind": "hadahan"}, headers={"x-vercel-ip-country": "LK"}
    )
    assert home.json() == {
        "kind": "hadahan",
        "country": "LK",
        "price": {"amount": 80_000, "currency": "LKR"},
        "paid_reports": False,
    }
    abroad = client.get(
        "/v1/price", params={"kind": "porondam"}, headers={"x-vercel-ip-country": "au"}
    )
    assert abroad.json()["price"] == {"amount": 250, "currency": "USD"}
    # No country (a local run, or Vercel does not know): the site's default, Sri Lanka.
    assert client.get("/v1/price", params={"kind": "hadahan"}).json()["country"] == "LK"
    unknown = client.get(
        "/v1/price", params={"kind": "hadahan"}, headers={"x-vercel-ip-country": "XX"}
    )
    assert unknown.json()["price"]["currency"] == "LKR"
    paid_reports(client, default_country="US")
    switched_on = client.get("/v1/price", params={"kind": "hadahan"}).json()
    assert switched_on["price"]["currency"] == "USD"
    assert switched_on["paid_reports"] is True


def test_only_reports_have_a_price(client: TestClient) -> None:
    assert client.get("/v1/price", params={"kind": "nakath"}).status_code == 422


# Coupons


def test_coupons_need_a_google_account(client: TestClient, pamudu: None) -> None:
    assert apply(client, "pamudu", status=401)["detail"] == "sign in with Google first"
    assert unlock(client, "pamudu").status_code == 401
    sign_in(client, kind="guest")
    apply(client, "pamudu", status=401)
    assert unlock(client, "pamudu").status_code == 401


def test_a_free_coupon_shows_a_price_of_nothing(client: TestClient, pamudu: None) -> None:
    sign_in(client)
    quote = apply(client, "  PAM udu ")
    assert quote == {
        "result": "free",
        "percent_off": 100,
        "price": {"amount": 80_000, "currency": "LKR"},
        "new_price": {"amount": 0, "currency": "LKR"},
    }


def test_a_discount_coupon_waits_for_payments(client: TestClient, orders: OrderStore) -> None:
    orders.create_coupon("sidera20", 20)
    sign_in(client)
    quote = apply(client, "SIDERA20")
    assert quote["result"] == "payment_not_available"
    assert quote["new_price"] == {"amount": 64_000, "currency": "LKR"}
    response = unlock(client, "sidera20")
    assert response.status_code == 402
    assert response.json()["detail"] == "payment_not_available"
    assert access(client)["paid"] is False


def test_coupons_that_do_not_work_say_why(client: TestClient, orders: OrderStore) -> None:
    orders.create_coupon("matchonly", 100, ["porondam"])
    orders.create_coupon("gone", 100, ends_at=dt.datetime(2020, 1, 1, tzinfo=dt.UTC))
    orders.create_coupon("off", 100)
    orders.set_active("off", False)
    sign_in(client)
    assert apply(client, "nope")["result"] == "unknown"
    assert apply(client, "matchonly")["result"] == "wrong_report"
    assert apply(client, "matchonly", kind="porondam")["result"] == "free"
    assert apply(client, "gone")["result"] == "ended"
    assert apply(client, "off")["result"] == "ended"
    assert unlock(client, "off").json()["detail"] == "ended"


def test_wrong_guesses_are_limited_per_account(client: TestClient, pamudu: None) -> None:
    paid_reports(client, coupon_misses_per_hour=3)
    sign_in(client)
    for _ in range(2):
        assert apply(client, "guess")["result"] == "unknown"
    assert unlock(client, "guess").status_code == 409  # the third wrong code
    # Now even the right code waits an hour.
    assert apply(client, "pamudu", status=429)["detail"].startswith("too many wrong codes")
    assert unlock(client, "pamudu").status_code == 429
    # Another account is not held up.
    sign_in(client)
    assert apply(client, "pamudu")["result"] == "free"


def test_codes_that_exist_are_not_wrong_guesses(client: TestClient, orders: OrderStore) -> None:
    orders.create_coupon("off", 100)
    orders.set_active("off", False)
    paid_reports(client, coupon_misses_per_hour=1)
    sign_in(client)
    for _ in range(3):
        assert apply(client, "off")["result"] == "ended"


# Unlocking and the paid check


def test_unlock_with_a_free_coupon(client: TestClient, pamudu: None) -> None:
    paid_reports(client)
    sign_in(client)
    before = access(client)
    assert before == {
        "paid": False,
        "features": [],
        "paid_reports": True,
        "account": "google",
        "price": {"amount": 80_000, "currency": "LKR"},
    }
    response = unlock(client, "pamudu")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["order"]["price"] == {"amount": 80_000, "currency": "LKR"}
    assert body["order"]["amount_paid"] == {"amount": 0, "currency": "LKR"}
    assert (body["order"]["method"], body["order"]["percent_off"]) == ("coupon", 100)
    assert body["saved"]["paid"] is True
    assert body["access"]["paid"] is True
    assert body["access"]["features"] == PAID
    # The same report in the other language is the same report.
    assert access(client, hadahan(lang="si"))["features"] == PAID
    # Another report is not.
    assert access(client, hadahan(name="Kasun"))["paid"] is False
    assert access(client, porondam())["paid"] is False
    # Kept in My reports as paid.
    listed = client.get("/v1/saved").json()["reports"]
    assert [(item["id"], item["paid"]) for item in listed] == [(body["saved"]["id"], True)]
    assert client.get(f"/v1/saved/{body['saved']['id']}").json()["paid"] is True


def test_unlocking_twice_uses_the_coupon_once(client: TestClient, orders: OrderStore) -> None:
    orders.create_coupon("once", 100, max_uses_per_account=1)
    sign_in(client)
    first = unlock(client, "once").json()
    again = unlock(client, "once")
    assert again.status_code == 200
    assert again.json()["order"]["id"] == first["order"]["id"]
    assert unlock(client, "once", porondam()).json()["detail"] == "account_limit"


def test_a_free_save_becomes_paid_when_unlocked(client: TestClient, pamudu: None) -> None:
    sign_in(client)
    kept = client.post("/v1/saved", json=porondam()).json()
    assert kept["paid"] is False
    unlocked = unlock(client, "pamudu", porondam()).json()
    assert unlocked["saved"]["id"] == kept["id"]
    assert unlocked["saved"]["paid"] is True


def test_unlocking_a_saved_free_report_stops_it_expiring_and_keeps_its_place(
    client: TestClient, pamudu: None, accounts: AccountStore
) -> None:
    paid_reports(client)
    sign_in(client)
    saved_at = dt.datetime(2026, 11, 15, 8, 0, tzinfo=dt.UTC)
    accounts.clock = lambda: saved_at
    older = client.post("/v1/saved", json=porondam()).json()
    accounts.clock = lambda: saved_at + dt.timedelta(minutes=1)
    newer = client.post("/v1/saved", json=hadahan()).json()
    assert older["expires_at"] == "2026-11-22T08:00:00Z"
    listed = client.get("/v1/saved").json()
    assert listed["paid_reports"] is True
    assert [item["id"] for item in listed["reports"]] == [newer["id"], older["id"]]

    accounts.clock = lambda: saved_at + dt.timedelta(days=6)  # 1 day left: "Get the full report"
    unlocked = unlock(client, "pamudu", porondam()).json()
    assert (unlocked["saved"]["id"], unlocked["saved"]["expires_at"]) == (older["id"], None)
    listed = client.get("/v1/saved").json()["reports"]
    assert [(item["id"], item["paid"]) for item in listed] == [
        (newer["id"], False),
        (older["id"], True),
    ]
    assert listed[1]["created_at"] == older["created_at"]  # the same place in the list

    accounts.clock = lambda: saved_at + dt.timedelta(days=30)
    listed = client.get("/v1/saved").json()["reports"]
    assert [(item["id"], item["expires_at"]) for item in listed] == [(older["id"], None)]


def test_paid_reports_do_not_take_free_places(client: TestClient, pamudu: None) -> None:
    paid_reports(client, free_saved_limit=1)
    sign_in(client)
    assert unlock(client, "pamudu", porondam()).status_code == 200  # saved as paid
    assert client.post("/v1/saved", json=hadahan()).status_code == 201  # the one free place
    full = client.post("/v1/saved", json=hadahan(name="Kasun"))
    assert (full.status_code, full.json()["detail"]) == (409, "free_limit")


def test_saving_a_paid_report_records_it_as_paid(client: TestClient, pamudu: None) -> None:
    sign_in(client)
    item = unlock(client, "pamudu").json()["saved"]["id"]
    assert client.delete(f"/v1/saved/{item}").status_code == 204
    again = client.post("/v1/saved", json=hadahan())
    assert again.status_code == 201
    assert again.json()["paid"] is True  # the order outlives the saved copy


def test_with_paid_reports_off_everyone_has_everything(client: TestClient) -> None:
    body = access(client)
    assert body["paid"] is False
    assert body["paid_reports"] is False
    assert body["features"] == PAID
    assert body["account"] is None


def test_with_paid_reports_on_free_users_keep_the_free_result(client: TestClient) -> None:
    paid_reports(client)
    assert access(client)["features"] == []
    sign_in(client, kind="guest")
    assert access(client)["features"] == []
    # Saving, sharing and the result itself work as before.
    assert client.post("/v1/saved", json=hadahan()).status_code == 201
    assert client.post("/v1/reports/pdf", json=hadahan()).status_code == 200


# The PDF


@pytest.fixture
def printed(monkeypatch: pytest.MonkeyPatch) -> list[list[tuple[str, str]]]:
    """The AI chapters each PDF was asked to print."""
    calls: list[list[tuple[str, str]]] = []

    def fake(*args: Any) -> bytes:
        calls.append(list(args[-1]))
        return b"%PDF-1.7"

    monkeypatch.setattr(reports, "render_hadahan", fake)
    monkeypatch.setattr(reports, "render_porondam", fake)
    return calls


READING = [{"title": "Your nature", "text": "Calm and steady."}]


def test_the_full_pdf_needs_a_paid_report(
    client: TestClient, pamudu: None, printed: list[list[tuple[str, str]]]
) -> None:
    pdf = {**hadahan(), "reading": READING}
    assert client.post("/v1/reports/pdf", json=pdf).status_code == 200  # paid reports off
    paid_reports(client)
    sign_in(client)
    assert client.post("/v1/reports/pdf", json=pdf).status_code == 200  # not paid
    assert unlock(client, "pamudu").status_code == 200
    assert client.post("/v1/reports/pdf", json=pdf).status_code == 200  # paid
    match = {**porondam(), "reading": READING}
    assert client.post("/v1/reports/pdf", json=match).status_code == 200  # another report
    chapter = [("Your nature", "Calm and steady.")]
    assert printed == [chapter, [], chapter, []]
