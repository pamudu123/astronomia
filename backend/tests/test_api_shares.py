"""POST, GET and DELETE /v1/shares."""

import logging
import sqlite3
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.logging import loggable_path
from app.store.shares import ShareStore

KANDY = 1241622
NIMALI = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY}
KASUN = {"date": "1992-08-03", "time": "10:00", "place_id": KANDY}


def hadahan(**extra: Any) -> dict[str, Any]:
    return {"kind": "hadahan", "name": "Nimali", "birth": {**NIMALI, "lang": "en"}, **extra}


def porondam(**extra: Any) -> dict[str, Any]:
    match = {"bride": {**NIMALI, "name": "Nimali"}, "groom": {**KASUN, "name": "Kasun"}}
    return {"kind": "porondam", "match": match, **extra}


def create(client: TestClient, body: dict[str, Any]) -> dict[str, Any]:
    response = client.post("/v1/shares", json=body)
    assert response.status_code == 201, response.text
    assert response.headers["cache-control"] == "no-store"
    created: dict[str, Any] = response.json()
    return created


def stored(shares: ShareStore) -> str:
    db = sqlite3.connect(shares.path)
    try:
        return repr(db.execute("SELECT * FROM shares").fetchall())
    finally:
        db.close()


def test_share_a_hadahan_and_open_it_in_both_languages(client: TestClient) -> None:
    created = create(client, hadahan())
    assert set(created) == {"code", "delete_token", "expires_at"}

    response = client.get(f"/v1/shares/{created['code']}")
    assert response.status_code == 200
    assert response.headers["x-robots-tag"] == "noindex, nofollow"
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["kind"] == "hadahan"
    assert body["names_hidden"] is False
    assert body["porondam"] is None
    shared = body["hadahan"]
    assert (shared["name"], shared["date"], shared["time"]) == ("Nimali", "1995-04-19", "14:35")
    assert shared["place"] == "Kandy, Central Province, Sri Lanka"
    assert shared["result"]["chart"]["lagna"]["sign"] == "simha"
    assert shared["result"]["kuja"]["reasons"][0].startswith("Mars is in")

    si = client.get(f"/v1/shares/{created['code']}", params={"lang": "si"}).json()["hadahan"]
    assert si["result"]["kuja"]["reasons"][0].startswith("ලග්")
    assert "Sri Lanka" not in si["place"]


def test_share_a_match(client: TestClient) -> None:
    created = create(client, porondam())
    body = client.get(f"/v1/shares/{created['code']}").json()
    assert body["kind"] == "porondam"
    match = body["porondam"]
    assert (match["bride"]["name"], match["groom"]["name"]) == ("Nimali", "Kasun")
    assert match["match"]["score"] == {"passed": 9, "total": 18}
    assert match["kuja"]["comparison"] == "bride_only"


def test_share_a_quick_match(client: TestClient) -> None:
    quick = {
        "kind": "porondam",
        "match": {
            "bride": {"name": "", "nakshatra": "anuradha", "pada": 2},
            "groom": {"name": "", "nakshatra": "rohini", "pada": 1},
        },
    }
    body = client.get(f"/v1/shares/{create(client, quick)['code']}").json()
    assert body["porondam"]["kuja"] is None
    assert body["porondam"]["bride"]["mode"] == "quick"


def test_hidden_names_are_never_stored(client: TestClient, shares: ShareStore) -> None:
    hadahan_code = create(client, hadahan(hide_names=True))["code"]
    porondam_code = create(client, porondam(hide_names=True))["code"]
    table = stored(shares)
    assert "Nimali" not in table
    assert "Kasun" not in table
    assert client.get(f"/v1/shares/{hadahan_code}").json()["hadahan"]["name"] == ""
    match = client.get(f"/v1/shares/{porondam_code}").json()
    assert match["names_hidden"] is True
    assert match["porondam"]["bride"]["name"] == ""


def test_the_request_is_not_stored(client: TestClient, shares: ShareStore) -> None:
    create(client, hadahan())
    # The place id and the clock change choice stay out. The result itself names the place.
    table = stored(shares)
    assert str(KANDY) not in table
    assert "place_id" not in table
    assert "fold" not in table


def test_delete_with_the_token(client: TestClient) -> None:
    created = create(client, hadahan())
    code = created["code"]
    wrong = client.delete(f"/v1/shares/{code}", headers={"X-Delete-Token": "x" * 32})
    assert wrong.status_code == 403
    assert client.delete(f"/v1/shares/{code}").status_code == 422  # no token at all
    token = {"X-Delete-Token": created["delete_token"]}
    deleted = client.delete(f"/v1/shares/{code}", headers=token)
    assert deleted.status_code == 204
    gone = client.get(f"/v1/shares/{code}")
    assert gone.status_code == 404
    assert gone.headers["x-robots-tag"] == "noindex, nofollow"
    again = client.delete(f"/v1/shares/{code}", headers=token)
    assert again.status_code == 404


def test_unknown_and_malformed_codes(client: TestClient) -> None:
    assert client.get("/v1/shares/" + "A" * 22).status_code == 404
    assert client.get("/v1/shares/short").status_code == 422
    assert client.get("/v1/shares/" + "a" * 22 + "%2E%2E").status_code in (404, 422)


def test_an_unresolved_clock_change_cannot_be_shared(client: TestClient) -> None:
    london = {
        "date": "2025-10-26",
        "time": "01:30",
        "latitude": 51.5,
        "longitude": -0.12,
        "timezone": "Europe/London",
    }
    response = client.post("/v1/shares", json={"kind": "hadahan", "birth": london})
    assert response.status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "forecast"},
        {"kind": "hadahan", "birth": NIMALI, "hide_names": "maybe"},
        {"kind": "porondam", "match": {"bride": {"nakshatra": "x", "pada": 9}}},
    ],
)
def test_bad_requests(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post("/v1/shares", json=body).status_code == 422


def test_the_log_never_shows_a_code(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    assert loggable_path("/v1/shares/abcDEF_123-xyz456789") == "/v1/shares/\u2026"
    assert loggable_path("/v1/places") == "/v1/places"
    code = create(client, hadahan())["code"]
    with caplog.at_level(logging.INFO, logger="astronomia.access"):
        client.get(f"/v1/shares/{code}")
    # Only the server's access log counts here. The test client logs its own requests too.
    access = [r.getMessage() for r in caplog.records if r.name == "astronomia.access"]
    assert any("/v1/shares/\u2026" in line for line in access)
    assert not any(code in line for line in access)
