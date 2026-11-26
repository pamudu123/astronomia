from fastapi.testclient import TestClient

COLOMBO = 1248991


def test_a_day_in_colombo(client: TestClient) -> None:
    response = client.get(
        "/v1/panchanga", params={"date": "2026-12-17", "place_id": COLOMBO, "lang": "en"}
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=3600"
    body = response.json()
    assert body["provisional"] is False
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


def test_a_month_in_colombo(client: TestClient) -> None:
    response = client.get(
        "/v1/panchanga/month",
        params={"year": 2026, "month": 12, "place_id": COLOMBO, "lang": "en"},
    )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=3600"
    body = response.json()
    assert (body["year"], body["month"], body["place"]["name"]) == (2026, 12, "Colombo")
    assert body["offset"] == "UTC+05:30"
    assert "official Sri Lankan calendar" in body["poya_note"]
    days = body["days"]
    assert len(days) == 31
    assert days[0]["date"] == "2026-12-01"
    assert days[-1]["date"] == "2026-12-31"
    # Each day matches the one day answer.
    one = client.get(
        "/v1/panchanga", params={"date": "2026-12-17", "place_id": COLOMBO, "lang": "en"}
    ).json()
    day = days[16]
    assert day["date"] == "2026-12-17"
    assert day["sunrise"] == one["sunrise"]
    assert day["rahu_kalaya"] == one["rahu_kalaya"]
    assert day["thithi"] == one["thithi"][0]
    assert day["nakatha"] == one["nakatha"][0]


def test_one_poya_a_month_on_the_full_moon(client: TestClient) -> None:
    for month in range(1, 13):
        days = client.get(
            "/v1/panchanga/month", params={"year": 2027, "month": month, "place_id": COLOMBO}
        ).json()["days"]
        poya = [d for d in days if d["poya"]]
        assert 1 <= len(poya) <= 2, month  # a blue moon month has two
        for day in poya:
            moment = day["full_moon"]
            assert moment is not None
            # The full moon falls between this sunrise and the next.
            assert moment["local"] >= day["sunrise"]["local"]
        assert all(d["full_moon"] is None for d in days if not d["poya"])


def test_month_in_sinhala_and_bad_queries(client: TestClient) -> None:
    body = client.get(
        "/v1/panchanga/month",
        params={"year": 2026, "month": 12, "place_id": COLOMBO, "lang": "si"},
    ).json()
    assert body["place"]["name"] == "කොළඹ"
    assert body["days"][16]["thithi"]["name"] == "පුර අටවක"
    assert "පොහොය" in body["poya_note"]
    bad: list[dict[str, int | str]] = [
        {"year": 2026, "month": 13, "place_id": COLOMBO},
        {"year": 1000, "month": 1, "place_id": COLOMBO},
        {"year": 2026, "month": 1},
        {"year": 2026, "month": 1, "place_id": COLOMBO, "timezone": "Asia/Colombo"},
    ]
    for params in bad:
        assert client.get("/v1/panchanga/month", params=params).status_code == 422, params
