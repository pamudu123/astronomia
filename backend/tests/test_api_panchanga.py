from fastapi.testclient import TestClient

COLOMBO = 1248991


def test_a_day_in_colombo(client: TestClient) -> None:
    response = client.get(
        "/v1/panchanga", params={"date": "2026-12-17", "place_id": COLOMBO, "lang": "en"}
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=3600"
    body = response.json()
    assert body["provisional"] is True
    assert body["rule_set"] == "panchanga_v1"
    assert body["place"]["name"] == "Colombo"
    assert body["offset"] == "UTC+05:30"
    assert body["timezone_note"] == "Times are in Asia/Colombo (UTC+05:30)."
    assert (body["weekday"], body["weekday_name"]) == ("thursday", "Thursday")
    assert body["sunrise"]["clock"] == "06:14"
    assert body["sunrise"]["local"] == "2026-12-17T06:14:00+05:30"
    assert body["sunrise"]["utc"] == "2026-12-17T00:44:00Z"
    assert [body["rahu_kalaya"]["start"]["clock"], body["rahu_kalaya"]["end"]["clock"]] == [
        "13:34",
        "15:02",
    ]
    thithi = body["thithi"][0]
    assert (thithi["key"], thithi["number"], thithi["name"]) == (
        "shukla_8",
        8,
        "Bright 8 (Ashtami)",
    )
    assert thithi["end"]["clock"] == "23:27"
    assert body["nakatha"][0]["name"] == "Purva Bhadrapada"
    assert [k["key"] for k in body["karana"]] == ["vishti", "bava", "balava"]


def test_sinhala_names(client: TestClient) -> None:
    body = client.get(
        "/v1/panchanga", params={"date": "2026-12-17", "place_id": COLOMBO, "lang": "si"}
    ).json()
    assert body["place"]["name"] == "කොළඹ"
    assert body["weekday_name"] == "බ්‍රහස්පතින්දා"
    assert body["thithi"][0]["name"] == "පුර අටවක"
    assert body["yoga"][0]["name"] == "සිද්ධි"


def test_your_own_time_zone_with_summer_time(client: TestClient) -> None:
    body = client.get(
        "/v1/panchanga",
        params={
            "date": "2027-04-14",
            "latitude": 51.5074,
            "longitude": -0.1278,
            "timezone": "Europe/London",
        },
    ).json()
    assert body["offset"] == "UTC+01:00"
    assert body["place"]["id"] is None
    # Punarvasu ends at 10:53 in Sri Lanka, which is 06:23 in London in April.
    assert body["nakatha"][0]["end"]["local"] == "2027-04-14T06:23:00+01:00"


def test_no_sunrise_is_not_an_error(client: TestClient) -> None:
    body = client.get(
        "/v1/panchanga",
        params={
            "date": "2026-06-21",
            "latitude": 78.22,
            "longitude": 15.65,
            "timezone": "Arctic/Longyearbyen",
        },
    ).json()
    assert body["sunrise"] is None and body["rahu_kalaya"] is None
    assert body["thithi"]


def test_bad_input(client: TestClient) -> None:
    def get(**params: object) -> int:
        return client.get("/v1/panchanga", params=params).status_code  # type: ignore[arg-type]

    assert get(date="2026-12-17") == 422
    assert get(date="2026-12-17", place_id=COLOMBO, latitude=1) == 422
    assert get(date="2026-12-17", latitude=1, longitude=1, timezone="Mars/Olympus") == 422
    assert get(date="2026-12-17", latitude=91, longitude=1, timezone="UTC") == 422
    assert get(date="2026-12-17", place_id=999999999) == 404
    assert get(date="1700-01-01", place_id=COLOMBO) == 422
