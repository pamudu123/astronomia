"""Paying for a report over the API, with the stand-in provider (docs/23)."""

import datetime as dt
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from app.api import checkout as checkout_api
from app.api.report_requests import HadahanReport, PorondamReport
from app.api.saved import RateLimit, input_hash
from app.config import Settings
from app.main import create_app
from app.payments import BadNotice
from app.payments.mock import MockProvider
from app.store.chapters import ChapterStore
from app.store.orders import OrderStore, Payment
from app.tiers.prices import Price
from tests.auth import bearer, browser, token
from tests.test_api_paid import PAID, access, apply, paid_reports, sign_in, unlock
from tests.test_api_saved import hadahan, merge, porondam


@pytest.fixture(autouse=True)
def coupons(client: TestClient, orders: OrderStore) -> None:
    paid_reports(client)
    orders.create_coupon("pamudu", 100, max_uses=200, max_uses_per_account=10)
    orders.create_coupon("sidera20", 20, max_uses_per_account=1)


def start(client: TestClient, code: str | None = None, report: dict[str, Any] | None = None) -> Any:
    return client.post("/v1/checkout", json={"report": report or hadahan(), "code": code})


def finish(client: TestClient, payment: str, outcome: str = "paid") -> Any:
    return client.post(f"/v1/payments/{payment}/mock", json={"outcome": outcome})


def status_of(client: TestClient, payment: str) -> Any:
    return client.get(f"/v1/payments/{payment}").json()["status"]


def locked(client: TestClient, report: dict[str, Any] | None = None) -> bool:
    found = access(client, report)
    return found["paid"] is False and found["features"] == []


# Starting


def test_the_server_works_out_the_amount(client: TestClient) -> None:
    sign_in(client, kind="guest")
    whole = start(client).json()
    assert whole["amount"] == {"amount": 80_000, "currency": "LKR"}
    # An amount or price sent by the page is not looked at.
    body = {
        "report": hadahan(),
        "code": "Sidera 20",
        "amount": {"amount": 1, "currency": "LKR"},
        "price": {"amount": 1, "currency": "LKR"},
    }
    less = client.post("/v1/checkout", json=body).json()
    assert (less["price"]["amount"], less["percent_off"]) == (80_000, 20)
    assert less["amount"] == {"amount": 64_000, "currency": "LKR"}
    abroad = client.post("/v1/checkout", json=body, headers={"x-vercel-ip-country": "AU"}).json()
    assert abroad["amount"] == {"amount": 200, "currency": "USD"}


def test_starting_a_payment_unlocks_nothing(client: TestClient) -> None:
    sign_in(client, kind="guest")
    response = start(client, "sidera20")
    assert response.status_code == 201
    payment = response.json()
    assert (payment["status"], payment["provider"]) == ("pending", "mock")
    assert status_of(client, payment["id"]) == "pending"
    assert locked(client)
    saved = client.post("/v1/saved", json=hadahan()).json()
    assert saved["paid"] is False


def test_what_cannot_be_paid_for(client: TestClient) -> None:
    assert start(client).status_code == 401  # no account
    sign_in(client)
    assert start(client, "nope").json()["detail"] == "unknown"
    assert start(client, "pamudu").json()["detail"] == "nothing_to_pay"
    assert unlock(client, "pamudu").status_code == 200
    assert start(client).json()["detail"] == "already_paid"
    other = start(client, None, porondam())
    assert other.status_code == 201


def test_without_a_provider_nothing_can_be_paid(client: TestClient) -> None:
    sign_in(client, kind="guest")
    payment = start(client).json()["id"]
    paid_reports(client, payment_provider="off")
    refused = start(client)
    assert (refused.status_code, refused.json()["detail"]) == (402, "payment_not_available")
    assert access(client)["checkout"] is None
    # The stand-in is gone too, even for a payment started before.
    assert finish(client, payment).status_code == 404
    assert locked(client)


def test_nothing_is_sold_while_everything_is_free(client: TestClient) -> None:
    paid_reports(client, on=False)
    sign_in(client, kind="guest")
    assert start(client).json()["detail"] == "free_now"


def test_payments_per_address_are_limited(client: TestClient) -> None:
    limit = RateLimit(1)
    client.app.dependency_overrides[checkout_api.payment_limit] = lambda: limit  # type: ignore[attr-defined]
    sign_in(client, kind="guest")
    assert start(client).status_code == 201
    assert start(client).status_code == 429


def test_the_stand_in_is_refused_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    production = Settings(
        environment="production", database_url="postgresql://x", payment_provider="mock"
    )
    assert production.checkout is None
    monkeypatch.setattr("app.main.get_settings", lambda: production)
    with pytest.raises(RuntimeError, match="not for production"):
        create_app()
    # Left to itself it is on only on a developer's own computer.
    assert Settings(environment="development").checkout == "mock"
    assert Settings(environment="staging").checkout is None
    assert Settings(environment="production").checkout is None
    assert Settings(environment="staging", payment_provider="mock").checkout == "mock"


# Finishing


def test_a_paid_payment_unlocks_that_report(client: TestClient, orders: OrderStore) -> None:
    user = sign_in(client, kind="guest")
    payment = start(client, "sidera20").json()["id"]
    done = finish(client, payment)
    assert (done.status_code, done.json()["status"]) == (200, "paid")
    assert access(client)["features"] == PAID
    assert locked(client, hadahan(name="Kasun"))
    assert locked(client, porondam())
    assert orders.paid_count(user) == 1
    # Saving it now keeps it as paid, for good.
    saved = client.post("/v1/saved", json=hadahan()).json()
    assert (saved["paid"], saved["expires_at"]) == (True, None)
    # It is over: it cannot be ended another way.
    assert finish(client, payment, "failed").status_code == 409
    assert access(client)["paid"] is True


@pytest.mark.parametrize("outcome", ["failed", "cancelled"])
def test_a_payment_that_fails_unlocks_nothing(client: TestClient, outcome: str) -> None:
    sign_in(client, kind="guest")
    payment = start(client, "sidera20").json()["id"]
    assert finish(client, payment, outcome).json()["status"] == outcome
    assert locked(client)
    assert finish(client, payment, "paid").status_code == 409
    assert locked(client)
    # The code was not used up: it can be tried again.
    assert apply(client, "sidera20")["result"] == "discount"
    again = start(client, "sidera20").json()["id"]
    assert finish(client, again).json()["status"] == "paid"
    assert access(client)["paid"] is True


def test_only_the_buyer_sees_or_ends_a_payment(client: TestClient) -> None:
    sign_in(client, kind="guest")
    payment = start(client).json()["id"]
    sign_in(client, kind="guest")
    assert client.get(f"/v1/payments/{payment}").status_code == 404
    assert finish(client, payment).status_code == 404
    client.headers.pop("authorization")
    assert finish(client, payment).status_code == 404
    sign_in(client)
    assert client.get(f"/v1/payments/{uuid.uuid4()}").status_code == 404


def test_a_page_on_another_site_cannot_pay(client: TestClient) -> None:
    sign_in(client, kind="guest")
    payment = start(client).json()["id"]
    evil = {"Origin": "https://evil.example"}
    body = {"report": hadahan(), "code": None}
    assert client.post("/v1/checkout", json=body, headers=evil).status_code == 403
    path = f"/v1/payments/{payment}/mock"
    assert client.post(path, json={"outcome": "paid"}, headers=evil).status_code == 403
    assert locked(client)


def test_starting_again_replaces_the_open_payment(client: TestClient) -> None:
    sign_in(client, kind="guest")
    first = start(client).json()["id"]
    second = start(client, "sidera20").json()["id"]
    assert status_of(client, first) == "cancelled"
    assert status_of(client, second) == "pending"


def test_the_pdf_and_the_chapters_wait_for_the_payment(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    printed: list[bool] = []

    def fake(*args: Any, full: bool) -> bytes:
        printed.append(full)
        return b"%PDF-1.7"

    monkeypatch.setattr("app.api.reports.render_hadahan", fake)
    paid_reports(client, chat_key="k")
    sign_in(client, kind="guest")
    payment = start(client, "sidera20").json()["id"]
    keep = {"report": hadahan(), "language": "en", "id": "chart.nature", "text": "Calm."}
    key = {"X-Chat-Key": "k"}

    client.post("/v1/reports/pdf", json=hadahan())
    assert client.post("/v1/reports/chapters/keep", json=keep, headers=key).status_code == 402
    finish(client, payment)
    client.post("/v1/reports/pdf", json=hadahan())
    assert client.post("/v1/reports/chapters/keep", json=keep, headers=key).status_code == 200
    assert printed == [False, True]


# The notice


def a_payment() -> Payment:
    return Payment(
        id=str(uuid.uuid4()),
        report_kind="hadahan",
        report_hash="h",
        price=Price(80_000, "LKR"),
        percent_off=20,
        amount=64_000,
        provider="mock",
        status="pending",
        created_at=dt.datetime.now(dt.UTC),
    )


def test_a_notice_must_be_signed() -> None:
    provider, payment = MockProvider(), a_payment()
    body, signature = provider.finish(payment, "paid")
    notice = provider.verify(body, signature)
    assert (notice.payment_id, notice.outcome) == (payment.id, "paid")
    assert (notice.amount, notice.currency) == (64_000, "LKR")
    failed, failed_signature = provider.finish(payment, "failed")
    for forged, with_signature in [
        (body, ""),
        (body, failed_signature),
        (body.replace(b"64000", b"1"), signature),
        (failed.replace(b"failed", b"paid"), failed_signature),
    ]:
        with pytest.raises(BadNotice):
            provider.verify(forged, with_signature)
    with pytest.raises(BadNotice):
        MockProvider().verify(body, signature)  # another server's key


# Signing in afterwards


def test_a_guest_who_links_google_keeps_the_report(client: TestClient) -> None:
    """Supabase adds Google to the same user, so the id does not change."""
    guest = sign_in(client, kind="guest")
    finish(client, start(client).json()["id"])
    client.headers.update(bearer(token(guest, anonymous=False)))
    found = access(client)
    assert (found["account"], found["paid"], found["features"]) == ("google", True, PAID)


def test_a_guests_unlocked_reports_join_an_existing_google_account(
    client: TestClient, orders: OrderStore, chapters: ChapterStore
) -> None:
    google_id, guest_id = str(uuid.uuid4()), str(uuid.uuid4())
    google = browser(client, google_id, anonymous=False)
    guest = browser(client, guest_id)
    # The Google account already keeps the match, free.
    kept = google.post("/v1/saved", json=porondam()).json()
    assert kept["expires_at"] is not None
    # The guest pays for a chart and unlocks the same match with a code.
    finish(guest, start(guest).json()["id"])
    assert guest.post("/v1/saved", json=hadahan()).json()["paid"] is True
    assert unlock(guest, "pamudu", porondam()).status_code == 200
    order = orders.paid_order(guest_id, "porondam", checkout_hash(porondam()))
    assert order is not None
    chapters.keep(order.id, guest_id, "en", "match.summary", "Kept.")

    assert merge(client, google_id, token(guest_id)).status_code == 200
    assert access(google)["features"] == PAID
    assert access(google, porondam())["features"] == PAID
    assert orders.paid_count(google_id) == 2
    assert orders.paid_count(guest_id) == 0
    listed = google.get("/v1/saved").json()["reports"]
    assert [(item["paid"], item["expires_at"]) for item in listed] == [(True, None)] * 2
    # The chapters are the account's: deleting the account takes them away.
    assert chapters.kept(order.id, "en") == {"match.summary": "Kept."}
    chapters.forget_user(google_id)
    assert chapters.kept(order.id, "en") == {}


def test_a_report_both_paid_for_stays_one_order(client: TestClient, orders: OrderStore) -> None:
    google_id, guest_id = str(uuid.uuid4()), str(uuid.uuid4())
    google = browser(client, google_id, anonymous=False)
    guest = browser(client, guest_id)
    assert unlock(google, "pamudu").status_code == 200
    finish(guest, start(guest).json()["id"])
    for _ in range(2):  # and once more, as after a lost answer
        assert merge(client, google_id, token(guest_id)).status_code == 200
    assert orders.paid_count(google_id) == 1
    assert access(google)["paid"] is True


def checkout_hash(report: dict[str, Any]) -> str:
    parsed: HadahanReport | PorondamReport = TypeAdapter(
        HadahanReport | PorondamReport
    ).validate_python(report)
    return input_hash(parsed.model_dump(mode="json"))


def test_a_guest_with_an_unlocked_report_gets_its_chat(client: TestClient) -> None:
    paid_reports(client, chat_key="k", chat_free_per_week=2)
    sign_in(client, kind="guest")
    asker = {"browser": "b" * 32, "address": "203.0.113.7"}
    key = {"X-Chat-Key": "k"}
    before = client.post("/v1/chat/status", json=asker, headers=key).json()
    assert (before["mode"], before["paid"]) == ("free", None)
    finish(client, start(client).json()["id"])
    after = client.post("/v1/chat/status", json=asker, headers=key).json()
    assert (after["mode"], after["paid"]["questions_total"]) == ("paid", 20)


def test_deleting_the_account_forgets_its_payments(client: TestClient, orders: OrderStore) -> None:
    user = sign_in(client, kind="guest")
    payment = start(client).json()["id"]
    assert client.delete("/v1/me").status_code == 204
    assert orders.payment(user, payment) is None
