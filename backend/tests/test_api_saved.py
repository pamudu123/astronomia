"""My reports: /v1/me and /v1/saved, for users signed in with Supabase (stand-in tokens)."""

import datetime as dt
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api import deps, saved
from app.config import Settings, get_settings
from app.main import create_app
from app.store.accounts import AccountStore
from app.tiers import save_access
from tests.auth import OTHER_KEY, bearer, browser, token
from tests.conftest import FakeAdmin

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


@pytest.fixture
def me(client: TestClient) -> TestClient:
    """A browser signed in to Supabase as a new guest."""
    return browser(client)


def test_saving_needs_a_sign_in(client: TestClient) -> None:
    assert client.get("/v1/me").json() == {"kind": None, "saved": 0}
    response = client.post("/v1/saved", json=hadahan())
    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Bearer")


def test_a_guest_gets_an_account_and_a_hint(me: TestClient) -> None:
    assert me.get("/v1/me").json() == {"kind": "guest", "saved": 0}
    response = me.post("/v1/saved", json=hadahan())
    assert response.status_code == 201
    cookies = response.headers.get_list("set-cookie")
    assert not [c for c in cookies if c.startswith(("sid=", "__Host-sid="))]
    hint = next(c for c in cookies if c.startswith("sidera_saved="))
    assert "HttpOnly" not in hint
    assert me.get("/v1/me").json() == {"kind": "guest", "saved": 1}


def test_save_a_hadahan_and_open_it_in_both_languages(me: TestClient) -> None:
    created = save(me, hadahan())
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

    listed = me.get("/v1/saved").json()["reports"]
    assert [item["id"] for item in listed] == [created["id"]]

    opened = me.get(f"/v1/saved/{created['id']}")
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

    si = me.get(f"/v1/saved/{created['id']}", params={"lang": "si"}).json()
    assert si["hadahan_result"]["result"]["kuja"]["reasons"][0].startswith("ලග්")


def test_save_a_match(me: TestClient) -> None:
    created = save(me, porondam())
    assert created["porondam"] == {
        "bride": "Nimali",
        "groom": "Kasun",
        "passed": 9,
        "total": 18,
        "mode": "full",
    }
    body = me.get(f"/v1/saved/{created['id']}").json()
    assert body["porondam_result"]["kuja"]["comparison"] == "bride_only"
    assert body["request"]["match"]["groom"]["name"] == "Kasun"


def test_saving_again_in_the_other_language_keeps_one(me: TestClient) -> None:
    first = save(me, hadahan("en"))
    again = save(me, hadahan("si"), status=200)
    assert again["created"] is False
    assert again["id"] == first["id"]
    # A different name is a different report.
    assert save(me, hadahan(name="Nimali P"))["id"] != first["id"]
    assert len(me.get("/v1/saved").json()["reports"]) == 2


def test_without_an_account_there_is_nothing(client: TestClient) -> None:
    some_id = uuid.uuid4()
    assert client.get("/v1/saved").json()["reports"] == []
    assert client.get(f"/v1/saved/{some_id}").status_code == 404
    assert client.patch(f"/v1/saved/{some_id}", json={"title": "x"}).status_code == 404
    assert client.delete(f"/v1/saved/{some_id}").status_code == 404
    assert client.get("/v1/saved/not-an-id").status_code == 422


def test_another_user_never_sees_my_report(me: TestClient, client: TestClient) -> None:
    mine = save(me, hadahan())["id"]
    for theirs in (browser(client), browser(client, anonymous=False)):
        assert theirs.get("/v1/saved").json()["reports"] == []
        assert theirs.get(f"/v1/saved/{mine}").status_code == 404
        assert theirs.patch(f"/v1/saved/{mine}", json={"title": "x"}).status_code == 404
        assert theirs.delete(f"/v1/saved/{mine}").status_code == 404
        save(theirs, hadahan())  # the same input is fine for two people
        assert theirs.get(f"/v1/saved/{mine}").status_code == 404
        assert len(theirs.get("/v1/saved").json()["reports"]) == 1
    assert me.get(f"/v1/saved/{mine}").status_code == 200
    assert me.get("/v1/me").json()["saved"] == 1


def test_rename(me: TestClient) -> None:
    item = save(me, hadahan())["id"]
    assert me.patch(f"/v1/saved/{item}", json={"title": "  Amma  "}).status_code == 204
    assert me.get(f"/v1/saved/{item}").json()["title"] == "Amma"
    assert me.patch(f"/v1/saved/{item}", json={"title": ""}).status_code == 204
    assert me.get("/v1/saved").json()["reports"][0]["title"] == ""
    assert me.patch(f"/v1/saved/{item}", json={"title": "x" * 81}).status_code == 422


def test_delete_one_and_the_hint_goes_with_the_last(me: TestClient) -> None:
    first = save(me, hadahan())["id"]
    second = save(me, porondam())["id"]

    response = me.delete(f"/v1/saved/{first}")
    assert response.status_code == 204
    assert me.get(f"/v1/saved/{first}").status_code == 404
    assert me.cookies.get("sidera_saved") == "1"

    response = me.delete(f"/v1/saved/{second}")
    assert response.status_code == 204
    assert any(c.startswith('sidera_saved=""') for c in response.headers.get_list("set-cookie"))
    assert me.get("/v1/me").json() == {"kind": "guest", "saved": 0}


def test_delete_my_account(client: TestClient, admin: FakeAdmin, accounts: AccountStore) -> None:
    user = str(uuid.uuid4())
    google = browser(client, user, anonymous=False)
    item = save(google, hadahan())["id"]
    other = browser(client)
    kept = save(other, hadahan())["id"]

    response = google.delete("/v1/me")
    assert response.status_code == 204
    assert any(c.startswith('sidera_saved=""') for c in response.headers.get_list("set-cookie"))
    # Every row went, then the Supabase user, with the secret key.
    assert accounts.find_user(user, "google") is None
    assert accounts.list_saved(user) == []
    assert admin.deleted == [user]
    assert other.get(f"/v1/saved/{kept}").status_code == 200
    assert google.get(f"/v1/saved/{item}").status_code == 404
    assert client.delete("/v1/me").status_code == 401


def test_when_supabase_cannot_delete_the_reports_are_still_gone(
    me: TestClient, admin: FakeAdmin
) -> None:
    item = save(me, hadahan())["id"]
    admin.fail = True
    assert me.delete("/v1/me").status_code == 502
    assert me.get(f"/v1/saved/{item}").status_code == 404
    admin.fail = False
    assert me.delete("/v1/me").status_code == 204  # trying again finishes it


def test_deleting_needs_the_secret_key_off_a_developer_computer(me: TestClient) -> None:
    me.app.dependency_overrides[deps.supabase_admin] = lambda: None  # type: ignore[attr-defined]
    assert me.delete("/v1/me").status_code == 204  # development
    settings = Settings(environment="staging")
    me.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    assert me.delete("/v1/me").status_code == 503


# Moving a guest into a Google account that already exists


def merge(client: TestClient, google: str, guest_token: str) -> Any:
    return client.post(
        "/v1/me/merge-guest",
        headers=bearer(token(google, anonymous=False)),
        json={"guest_token": guest_token},
    )


def test_a_guests_reports_move_into_an_existing_google_account(
    client: TestClient, admin: FakeAdmin, accounts: AccountStore
) -> None:
    google_id, guest_id = str(uuid.uuid4()), str(uuid.uuid4())
    save(browser(client, google_id, anonymous=False), porondam())  # from another phone
    guest = browser(client, guest_id)
    save(guest, hadahan())
    save(guest, porondam())  # the same match: kept once
    guest_token = token(guest_id)

    response = merge(client, google_id, guest_token)
    assert response.status_code == 200, response.text
    assert response.json() == {"moved": 1, "saved": 2}
    google = browser(client, google_id, anonymous=False)
    kinds = sorted(item["kind"] for item in google.get("/v1/saved").json()["reports"])
    assert kinds == ["hadahan", "porondam"]
    # The guest is gone, here and in Supabase.
    assert accounts.list_saved(guest_id) == []
    assert admin.deleted == [guest_id]


def test_moving_checks_both_tokens(client: TestClient, accounts: AccountStore) -> None:
    google_id, guest_id = str(uuid.uuid4()), str(uuid.uuid4())
    save(browser(client, guest_id), hadahan())

    def guest_reports() -> int:
        return len(accounts.list_saved(guest_id))

    # The Google token must be good: a forged or expired one is refused.
    for bad in (token(google_id, anonymous=False, key=OTHER_KEY), token(google_id, lifetime=-600)):
        response = client.post(
            "/v1/me/merge-guest", headers=bearer(bad), json={"guest_token": token(guest_id)}
        )
        assert response.status_code == 401
    # The caller must be a Google account, not another guest.
    response = client.post(
        "/v1/me/merge-guest",
        headers=bearer(token(str(uuid.uuid4()))),
        json={"guest_token": token(guest_id)},
    )
    assert response.status_code == 409
    # The guest token must be good, and a guest's: knowing a guest's id is not enough.
    for bad in (
        token(guest_id, key=OTHER_KEY),
        token(guest_id, lifetime=-600),
        token(guest_id, iss="https://other.supabase.co/auth/v1"),
        token(guest_id, anonymous=False),
        guest_id,
    ):
        assert merge(client, google_id, bad).status_code == 409
    assert guest_reports() == 1
    # Without any sign in, nothing moves.
    assert (
        client.post("/v1/me/merge-guest", json={"guest_token": token(guest_id)}).status_code == 401
    )
    assert guest_reports() == 1


def test_moving_twice_or_into_itself_changes_nothing(client: TestClient) -> None:
    google_id, guest_id = str(uuid.uuid4()), str(uuid.uuid4())
    save(browser(client, guest_id), hadahan())
    assert merge(client, google_id, token(guest_id)).json() == {"moved": 1, "saved": 1}
    assert merge(client, google_id, token(guest_id)).json() == {"moved": 0, "saved": 1}


def test_a_failed_supabase_delete_does_not_undo_the_move(
    client: TestClient, admin: FakeAdmin
) -> None:
    google_id, guest_id = str(uuid.uuid4()), str(uuid.uuid4())
    save(browser(client, guest_id), hadahan())
    admin.fail = True
    assert merge(client, google_id, token(guest_id)).json() == {"moved": 1, "saved": 1}


def test_a_page_on_another_site_cannot_save_or_delete(me: TestClient) -> None:
    evil = {"Origin": "https://evil.example"}
    assert me.post("/v1/saved", json=hadahan(), headers=evil).status_code == 403
    assert "set-cookie" not in me.post("/v1/saved", json=hadahan(), headers=evil).headers
    item = save(me, hadahan())["id"]
    assert me.delete(f"/v1/saved/{item}", headers=evil).status_code == 403
    assert me.patch(f"/v1/saved/{item}", json={"title": "x"}, headers=evil).status_code == 403
    assert me.delete("/v1/me", headers=evil).status_code == 403
    assert me.get(f"/v1/saved/{item}").status_code == 200

    # The site itself, directly or through the frontend's forward, is fine.
    own = {"Origin": "http://testserver"}
    assert me.patch(f"/v1/saved/{item}", json={"title": "a"}, headers=own).status_code == 204
    forwarded = {"Origin": "https://sidera.lk", "X-Forwarded-Host": "sidera.lk"}
    assert me.patch(f"/v1/saved/{item}", json={"title": "b"}, headers=forwarded).status_code == 204


def test_a_listed_site_address_is_allowed(me: TestClient) -> None:
    settings = Settings(site_origins=("https://sidera.lk",))
    me.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    site = {"Origin": "https://sidera.lk"}
    assert me.post("/v1/saved", json=hadahan(), headers=site).status_code == 201
    item = me.get("/v1/saved").json()["reports"][0]["id"]
    assert me.delete(f"/v1/saved/{item}", headers=site).status_code == 204


def test_the_paid_check_blocks_saving_but_not_reading(me: TestClient) -> None:
    item = save(me, hadahan())["id"]

    def paid_only() -> None:
        raise HTTPException(402, "saving needs a paid report")

    me.app.dependency_overrides[save_access] = paid_only  # type: ignore[attr-defined]
    assert me.post("/v1/saved", json=porondam()).status_code == 402
    assert me.get(f"/v1/saved/{item}").status_code == 200
    assert len(me.get("/v1/saved").json()["reports"]) == 1
    assert me.delete(f"/v1/saved/{item}").status_code == 204


def test_the_limit(me: TestClient) -> None:
    settings = Settings(free_saved_limit=1)
    me.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    save(me, hadahan())
    response = me.post("/v1/saved", json=porondam())
    assert response.status_code == 409
    save(me, hadahan(), status=200)


def test_twenty_free_reports_at_a_time(me: TestClient) -> None:
    assert Settings().free_saved_limit == 20  # docs/18, section 3
    settings = Settings(free_saved_limit=2)
    me.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    save(me, hadahan(name="One"))
    save(me, hadahan(name="Two"))
    response = me.post("/v1/saved", json=porondam())
    assert response.status_code == 409
    assert response.json()["detail"] == "free_limit"  # the page says what to do
    assert me.get("/v1/saved").json()["free_limit"] == 2


def test_a_free_report_says_when_it_is_deleted_and_goes(
    me: TestClient, accounts: AccountStore
) -> None:
    saved_at = dt.datetime(2026, 11, 15, 8, 0, tzinfo=dt.UTC)
    accounts.clock = lambda: saved_at
    item = save(me, hadahan())
    assert item["paid"] is False
    assert item["expires_at"] == "2026-11-22T08:00:00Z"
    listed = me.get("/v1/saved").json()
    assert listed["reports"][0]["expires_at"] == "2026-11-22T08:00:00Z"
    assert me.get(f"/v1/saved/{item['id']}").json()["expires_at"] == "2026-11-22T08:00:00Z"

    accounts.clock = lambda: saved_at + dt.timedelta(days=7)
    assert me.get("/v1/saved").json()["reports"] == []
    assert me.get(f"/v1/saved/{item['id']}").status_code == 404
    assert me.get("/v1/me").json() == {"kind": "guest", "saved": 0}


def test_a_failed_save_keeps_nothing(me: TestClient) -> None:
    settings = Settings(free_saved_limit=0)
    me.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    response = me.post("/v1/saved", json=hadahan())
    assert response.status_code == 409
    assert not any(c.startswith("sidera_saved=1") for c in response.headers.get_list("set-cookie"))
    assert me.get("/v1/me").json() == {"kind": "guest", "saved": 0}


def test_new_guests_are_rate_limited(client: TestClient) -> None:
    limit = saved.RateLimit(1)
    client.app.dependency_overrides[saved.guest_limit] = lambda: limit  # type: ignore[attr-defined]
    first = browser(client)
    save(first, hadahan())
    save(first, porondam())  # the same account: not a new guest
    assert browser(client).post("/v1/saved", json=hadahan()).status_code == 429
    # Google accounts are not guests: Supabase already limits who can make one.
    save(browser(client, anonymous=False), hadahan())


def test_an_unresolved_clock_change_is_refused(me: TestClient) -> None:
    london = {
        "date": "2025-10-26",
        "time": "01:30",
        "latitude": 51.5,
        "longitude": -0.12,
        "timezone": "Europe/London",
    }
    response = me.post("/v1/saved", json={"kind": "hadahan", "birth": london})
    assert response.status_code == 422
    assert "set-cookie" not in response.headers
    assert me.get("/v1/me").json()["saved"] == 0


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "forecast"},
        {"kind": "hadahan", "birth": NIMALI, "name": "x" * 61},
        {"kind": "porondam", "match": {"bride": {"nakshatra": "x", "pada": 9}}},
    ],
)
def test_bad_requests(me: TestClient, body: dict[str, Any]) -> None:
    assert me.post("/v1/saved", json=body).status_code == 422


def test_a_bad_token_is_refused_everywhere(client: TestClient) -> None:
    bad = bearer(token(lifetime=-3600))  # expired an hour ago
    for method, path in [
        ("GET", "/v1/me"),
        ("GET", "/v1/saved"),
        ("GET", f"/v1/saved/{uuid.uuid4()}"),
        ("POST", "/v1/saved"),
        ("DELETE", "/v1/me"),
    ]:
        body = hadahan() if method == "POST" else None
        response = client.request(method, path, headers=bad, json=body)
        assert response.status_code == 401, (method, path)
        assert response.headers["cache-control"] == "no-store"


def test_a_guest_who_links_google_keeps_their_reports(client: TestClient) -> None:
    user = str(uuid.uuid4())
    item = save(browser(client, user), hadahan())["id"]
    google = browser(client, user, anonymous=False)  # the same Supabase user, after linking
    assert google.get("/v1/me").json() == {"kind": "google", "saved": 1}
    assert google.get(f"/v1/saved/{item}").status_code == 200
    # An old guest token still in use somewhere does not turn the account back into a guest.
    assert browser(client, user).get("/v1/me").json()["kind"] == "google"


def test_without_supabase_nobody_can_sign_in(client: TestClient) -> None:
    client.app.dependency_overrides[deps.token_checker] = lambda: None  # type: ignore[attr-defined]
    assert client.get("/v1/me").json() == {"kind": None, "saved": 0}
    assert client.get("/v1/me", headers=bearer(token())).status_code == 503


def test_the_hint_is_https_only_off_a_developer_computer(me: TestClient) -> None:
    settings = Settings(environment="staging")
    me.app.dependency_overrides[get_settings] = lambda: settings  # type: ignore[attr-defined]
    response = me.post("/v1/saved", json=hadahan())
    hint = next(c for c in response.headers.get_list("set-cookie") if c.startswith("sidera_saved="))
    assert "Secure" in hint


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
