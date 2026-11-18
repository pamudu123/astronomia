"""My reports: /v1/me and /v1/saved, with the quiet guest account behind them."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api import saved
from app.config import Settings, get_settings
from app.main import create_app
from app.tiers import save_access

KANDY = 1241622
NIMALI = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY}
KASUN = {"date": "1992-08-03", "time": "10:00", "place_id": KANDY}


def hadahan(lang: str = "en", name: str = "Nimali") -> dict[str, Any]:
    return {"kind": "hadahan", "name": name, "birth": {**NIMALI, "lang": lang}}


def porondam() -> dict[str, Any]:
    match = {"bride": {**NIMALI, "name": "Nimali"}, "groom": {**KASUN, "name": "Kasun"}}
    return {"kind": "porondam", "match": {**match, "lang": "en"}}


def save(client: TestClient, body: dict[str, Any], status: int = 201) -> dict[str, Any]:
    response = client.post("/v1/saved", json=body)
    assert response.status_code == status, response.text
    assert response.headers["cache-control"] == "no-store"
    out: dict[str, Any] = response.json()
    return out


def other_browser(client: TestClient) -> TestClient:
    """The same site, opened in a browser with no cookies."""
    return TestClient(client.app)


def test_the_first_save_makes_a_guest_account(client: TestClient) -> None:
    assert client.get("/v1/me").json() == {"kind": None, "saved": 0}
    response = client.post("/v1/saved", json=hadahan())
    assert response.status_code == 201
    cookies = response.headers.get_list("set-cookie")
    session = next(c for c in cookies if c.startswith("sid="))
    assert "HttpOnly" in session
    assert "SameSite=lax" in session
    assert "Path=/" in session
    hint = next(c for c in cookies if c.startswith("sidera_saved="))
    assert "HttpOnly" not in hint
    assert client.get("/v1/me").json() == {"kind": "guest", "saved": 1}


def test_save_a_hadahan_and_open_it_in_both_languages(client: TestClient) -> None:
    created = save(client, hadahan())
    assert created["created"] is True
    assert created["kind"] == "hadahan"
    assert created["title"] == ""
    assert created["hadahan"] == {
        "name": "Nimali",
        "date": "1995-04-19",
        "lagna": "simha",
        "rashi": created["hadahan"]["rashi"],
        "nakshatra": created["hadahan"]["nakshatra"],
    }
    assert created["porondam"] is None

    listed = client.get("/v1/saved").json()["reports"]
    assert [item["id"] for item in listed] == [created["id"]]

    opened = client.get(f"/v1/saved/{created['id']}")
    assert opened.status_code == 200
    assert opened.headers["x-robots-tag"] == "noindex, nofollow"
    body = opened.json()
    assert body["request"] == {
        "kind": "hadahan",
        "name": "Nimali",
        "birth": body["request"]["birth"],
    }
    assert body["request"]["birth"]["place_id"] == KANDY
    result = body["hadahan_result"]
    assert result["place"] == "Kandy, Central Province, Sri Lanka"
    assert result["result"]["kuja"]["reasons"][0].startswith("Mars is in")

    si = client.get(f"/v1/saved/{created['id']}", params={"lang": "si"}).json()
    assert si["hadahan_result"]["result"]["kuja"]["reasons"][0].startswith("ලග්")


def test_save_a_match(client: TestClient) -> None:
    created = save(client, porondam())
    assert created["porondam"] == {
        "bride": "Nimali",
        "groom": "Kasun",
        "passed": 9,
        "total": 18,
        "mode": "full",
    }
    body = client.get(f"/v1/saved/{created['id']}").json()
    assert body["porondam_result"]["kuja"]["comparison"] == "bride_only"
    assert body["request"]["match"]["groom"]["name"] == "Kasun"


def test_saving_again_in_the_other_language_keeps_one(client: TestClient) -> None:
    first = save(client, hadahan("en"))
    again = save(client, hadahan("si"), status=200)
    assert again["created"] is False
    assert again["id"] == first["id"]
    # A different name is a different report.
    assert save(client, hadahan(name="Nimali P"))["id"] != first["id"]
    assert len(client.get("/v1/saved").json()["reports"]) == 2


def test_without_an_account_there_is_nothing(client: TestClient) -> None:
    some_id = uuid.uuid4()
    assert client.get("/v1/saved").json() == {"reports": []}
    assert client.get(f"/v1/saved/{some_id}").status_code == 404
    assert client.patch(f"/v1/saved/{some_id}", json={"title": "x"}).status_code == 404
    assert client.delete(f"/v1/saved/{some_id}").status_code == 404
    assert client.get("/v1/saved/not-an-id").status_code == 422


def test_another_browser_never_sees_my_report(client: TestClient) -> None:
    mine = save(client, hadahan())["id"]
    theirs = other_browser(client)
    assert theirs.get("/v1/saved").json() == {"reports": []}
    assert theirs.get(f"/v1/saved/{mine}").status_code == 404
    assert theirs.delete(f"/v1/saved/{mine}").status_code == 404
    save(theirs, hadahan())
    assert theirs.get(f"/v1/saved/{mine}").status_code == 404
    assert client.get(f"/v1/saved/{mine}").status_code == 200


def test_rename(client: TestClient) -> None:
    item = save(client, hadahan())["id"]
    assert client.patch(f"/v1/saved/{item}", json={"title": "  Amma  "}).status_code == 204
    assert client.get(f"/v1/saved/{item}").json()["title"] == "Amma"
    assert client.patch(f"/v1/saved/{item}", json={"title": ""}).status_code == 204
    assert client.get("/v1/saved").json()["reports"][0]["title"] == ""
    assert client.patch(f"/v1/saved/{item}", json={"title": "x" * 81}).status_code == 422


def test_delete_one_and_the_hint_goes_with_the_last(client: TestClient) -> None:
    first = save(client, hadahan())["id"]
    second = save(client, porondam())["id"]

    response = client.delete(f"/v1/saved/{first}")
    assert response.status_code == 204
    assert client.get(f"/v1/saved/{first}").status_code == 404
    assert client.cookies.get("sidera_saved") == "1"

    response = client.delete(f"/v1/saved/{second}")
    assert response.status_code == 204
    assert any(c.startswith('sidera_saved=""') for c in response.headers.get_list("set-cookie"))
    assert client.get("/v1/me").json() == {"kind": "guest", "saved": 0}


def test_delete_my_account(client: TestClient) -> None:
    item = save(client, hadahan())["id"]
    response = client.delete("/v1/me")
    assert response.status_code == 204
    cleared = response.headers.get_list("set-cookie")
    assert any(c.startswith('sid=""') for c in cleared)
    assert any(c.startswith('sidera_saved=""') for c in cleared)
    assert client.get("/v1/me").json() == {"kind": None, "saved": 0}
    assert client.get(f"/v1/saved/{item}").status_code == 404


def test_a_page_on_another_site_cannot_save_or_delete(client: TestClient) -> None:
    evil = {"Origin": "https://evil.example"}
    assert client.post("/v1/saved", json=hadahan(), headers=evil).status_code == 403
    assert "set-cookie" not in client.post("/v1/saved", json=hadahan(), headers=evil).headers
    item = save(client, hadahan())["id"]
    assert client.delete(f"/v1/saved/{item}", headers=evil).status_code == 403
    assert client.patch(f"/v1/saved/{item}", json={"title": "x"}, headers=evil).status_code == 403
    assert client.delete("/v1/me", headers=evil).status_code == 403
    assert client.get(f"/v1/saved/{item}").status_code == 200

    # The site itself, directly or through the frontend's forward, is fine.
    own = {"Origin": "http://testserver"}
    assert client.patch(f"/v1/saved/{item}", json={"title": "a"}, headers=own).status_code == 204
    forwarded = {"Origin": "https://sidera.lk", "X-Forwarded-Host": "sidera.lk"}
    assert (
        client.patch(f"/v1/saved/{item}", json={"title": "b"}, headers=forwarded).status_code == 204
    )


def test_a_listed_site_address_is_allowed(client: TestClient) -> None:
    settings = Settings(site_origins=("https://sidera.lk",))
    client.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    site = {"Origin": "https://sidera.lk"}
    assert client.post("/v1/saved", json=hadahan(), headers=site).status_code == 201
    item = client.get("/v1/saved").json()["reports"][0]["id"]
    assert client.delete(f"/v1/saved/{item}", headers=site).status_code == 204


def test_the_paid_check_blocks_saving_but_not_reading(client: TestClient) -> None:
    item = save(client, hadahan())["id"]

    def paid_only() -> None:
        raise HTTPException(402, "saving needs a paid report")

    client.app.dependency_overrides[save_access] = paid_only  # type: ignore[attr-defined]
    assert client.post("/v1/saved", json=porondam()).status_code == 402
    assert client.get(f"/v1/saved/{item}").status_code == 200
    assert len(client.get("/v1/saved").json()["reports"]) == 1
    assert client.delete(f"/v1/saved/{item}").status_code == 204


def test_the_limit(client: TestClient) -> None:
    settings = Settings(guest_saved_limit=1)
    client.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    save(client, hadahan())
    response = client.post("/v1/saved", json=porondam())
    assert response.status_code == 409
    save(client, hadahan(), status=200)


def test_a_failed_first_save_makes_no_account_and_no_cookie(client: TestClient) -> None:
    settings = Settings(guest_saved_limit=0)
    client.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    response = client.post("/v1/saved", json=hadahan())
    assert response.status_code == 409
    assert not any(c.startswith("sid=") for c in response.headers.get_list("set-cookie"))
    assert client.get("/v1/me").json() == {"kind": None, "saved": 0}


def test_new_guests_are_rate_limited(client: TestClient) -> None:
    limit = saved.RateLimit(1)
    client.app.dependency_overrides[saved.guest_limit] = lambda: limit  # type: ignore[attr-defined]
    save(client, hadahan())
    save(client, porondam())  # the same account: not a new guest
    assert other_browser(client).post("/v1/saved", json=hadahan()).status_code == 429


def test_an_unresolved_clock_change_makes_no_account(client: TestClient) -> None:
    london = {
        "date": "2025-10-26",
        "time": "01:30",
        "latitude": 51.5,
        "longitude": -0.12,
        "timezone": "Europe/London",
    }
    response = client.post("/v1/saved", json={"kind": "hadahan", "birth": london})
    assert response.status_code == 422
    assert "set-cookie" not in response.headers
    assert client.get("/v1/me").json()["kind"] is None


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "forecast"},
        {"kind": "hadahan", "birth": NIMALI, "name": "x" * 61},
        {"kind": "porondam", "match": {"bride": {"nakshatra": "x", "pada": 9}}},
    ],
)
def test_bad_requests(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post("/v1/saved", json=body).status_code == 422


def test_an_unknown_session_cookie_is_cleared(client: TestClient) -> None:
    client.cookies.set("sid", "no-such-session")
    response = client.get("/v1/saved")
    assert response.json() == {"reports": []}
    assert any(c.startswith('sid=""') for c in response.headers.get_list("set-cookie"))


def test_cookies_are_https_only_off_a_developer_computer(client: TestClient) -> None:
    settings = Settings(environment="staging")
    client.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    response = client.post("/v1/saved", json=hadahan())
    cookies = response.headers.get_list("set-cookie")
    session = next(c for c in cookies if c.startswith("__Host-sid="))
    assert "Secure" in session
    assert "Domain" not in session
    assert "Secure" in next(c for c in cookies if c.startswith("sidera_saved="))


@pytest.fixture
def production(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("ASTRONOMIA_ENVIRONMENT", "production")
    monkeypatch.delenv("ASTRONOMIA_DATABASE_URL", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.usefixtures("production")
def test_production_needs_postgresql() -> None:
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        create_app()
