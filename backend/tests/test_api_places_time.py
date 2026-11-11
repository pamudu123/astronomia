from fastapi.testclient import TestClient


def test_place_search(client: TestClient) -> None:
    body = client.get("/v1/places", params={"q": "kandy", "limit": 3}).json()
    kandy = body["places"][0]
    assert kandy["name"] == "Kandy"
    assert kandy["name_si"] == "මහනුවර"
    assert kandy["timezone"] == "Asia/Colombo"
    assert len(body["places"]) <= 3


def test_place_search_needs_two_letters(client: TestClient) -> None:
    assert client.get("/v1/places", params={"q": "k"}).status_code == 422


def test_resolve_time_by_place(client: TestClient) -> None:
    place_id = client.get("/v1/places", params={"q": "kandy"}).json()["places"][0]["id"]
    body = client.post(
        "/v1/time/resolve", json={"date": "1996-06-01", "time": "10:00", "place_id": place_id}
    ).json()
    assert body["status"] == "ok"
    assert body["offset_seconds"] == 23400
    assert body["offset_label"] == "UTC+06:30"
    assert body["utc"].startswith("1996-06-01T03:30:00")


def test_resolve_time_by_timezone_reports_ambiguous(client: TestClient) -> None:
    body = client.post(
        "/v1/time/resolve",
        json={"date": "2025-10-26", "time": "01:30", "timezone": "Europe/London"},
    ).json()
    assert body["status"] == "ambiguous"
    assert body["utc"] is None
    assert [o["offset_label"] for o in body["options"]] == ["UTC+01:00", "UTC+00:00"]


def test_resolve_time_with_fold(client: TestClient) -> None:
    body = client.post(
        "/v1/time/resolve",
        json={"date": "2025-10-26", "time": "01:30", "timezone": "Europe/London", "fold": 1},
    ).json()
    assert body["status"] == "ok"
    assert body["clock_change"] == "ambiguous"
    assert body["offset_label"] == "UTC+00:00"


def test_resolve_time_errors(client: TestClient) -> None:
    url = "/v1/time/resolve"
    base = {"date": "2000-01-01", "time": "12:00"}
    assert client.post(url, json={**base, "timezone": "Mars/Olympus"}).status_code == 422
    assert client.post(url, json={**base, "place_id": 999999999}).status_code == 404
    assert client.post(url, json=base).status_code == 422
    both = {**base, "timezone": "Asia/Colombo", "place_id": 1}
    assert client.post(url, json=both).status_code == 422
    bad_date = {"date": "2000-02-30", "time": "12:00", "timezone": "Asia/Colombo"}
    assert client.post(url, json=bad_date).status_code == 422
    old = {"date": "1700-01-01", "time": "12:00", "timezone": "Asia/Colombo"}
    assert client.post(url, json=old).status_code == 422
