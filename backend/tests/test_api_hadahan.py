from fastapi.testclient import TestClient

KANDY = 1241622
BIRTH = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY, "as_of": "2026-11-11T00:00:00Z"}


def test_hadahan_full_result(client: TestClient) -> None:
    body = client.post("/v1/hadahan", json={**BIRTH, "lang": "en"}).json()
    assert body["status"] == "ok"
    chart = body["chart"]
    assert chart["lagna"]["sign"] == "simha"
    assert chart["moon"]["nakshatra"] == "jyeshtha"
    assert {p["body"] for p in chart["planets"]} == {
        "sun",
        "moon",
        "mars",
        "mercury",
        "jupiter",
        "venus",
        "saturn",
        "rahu",
        "ketu",
    }
    assert chart["method"]["ayanamsa"] == "lahiri"
    assert chart["time_check"]["reason"]
    assert body["dasha"]["periods"][0]["lord"] == "mercury"
    assert [p["lord"] for p in body["dasha"]["current"]] == ["sun", "jupiter", "sun"]
    assert body["kuja"]["present"] is True
    assert body["kuja"]["provisional"] is True
    assert body["kuja"]["reasons"][0] == "Mars is in the 12th house counted from the lagna."


def test_hadahan_in_sinhala(client: TestClient) -> None:
    body = client.post("/v1/hadahan", json={**BIRTH, "lang": "si"}).json()
    assert body["kuja"]["reasons"][0].startswith("ලග්නයේ සිට")


def test_ambiguous_time_returns_options_not_a_chart(client: TestClient) -> None:
    body = client.post(
        "/v1/hadahan",
        json={
            "date": "2025-10-26",
            "time": "01:30",
            "latitude": 51.5,
            "longitude": -0.12,
            "timezone": "Europe/London",
        },
    ).json()
    assert body["status"] == "ambiguous"
    assert body["chart"] is None
    assert len(body["time"]["options"]) == 2


def test_chart_with_coordinates(client: TestClient) -> None:
    body = client.post(
        "/v1/charts",
        json={
            "date": "2000-01-01",
            "time": "12:00",
            "latitude": -33.87,
            "longitude": 151.21,
            "timezone": "Australia/Sydney",
        },
    ).json()
    assert body["status"] == "ok"
    assert len(body["chart"]["planets"]) == 9


def test_errors(client: TestClient) -> None:
    base = {"date": "2000-01-01", "time": "12:00"}
    assert client.post("/v1/hadahan", json={**base, "place_id": 999999999}).status_code == 404
    assert (
        client.post(
            "/v1/hadahan", json={**base, "latitude": 95, "longitude": 0, "timezone": "UTC"}
        ).status_code
        == 422
    )
    assert client.post("/v1/hadahan", json={**base, "latitude": 7}).status_code == 422
    assert (
        client.post("/v1/hadahan", json={**base, "place_id": KANDY, "lang": "ta"}).status_code
        == 422
    )


def test_labels(client: TestClient) -> None:
    si = client.get("/v1/labels/si").json()
    assert si["planet"]["mars"]["name"] == "කුජ"
    assert client.get("/v1/labels/en").json()["rashi"]["simha"]["western"] == "Leo"
    assert client.get("/v1/labels/fr").status_code == 422
