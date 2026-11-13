from fastapi.testclient import TestClient

COLOMBO = 1248991


def test_a_star_page(client: TestClient) -> None:
    response = client.get("/v1/baby/letters/ardra", params={"lang": "en"})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=3600"
    body = response.json()
    assert (body["rule_set"], body["provisional"]) == ("name_letters_si_v1", True)
    assert (body["star"], body["star_name"], body["star_number"]) == ("ardra", "Ardra", 6)
    assert [p["letter"] for p in body["padas"]] == ["කු", "ඝ", "ඞ", "ඡ"]
    assert [p["latin"] for p in body["padas"]] == ["Ku", "Gha", "Nga", "Chha"]
    assert body["padas"][3]["others"] == ["ච", "ජ"]
    assert {p["rashi"] for p in body["padas"]} == {"mithuna"}
    assert (body["padas"][0]["from_degree"], body["padas"][0]["to_degree"]) == (
        6.666667,
        10.0,
    )


def test_a_star_that_spans_two_signs(client: TestClient) -> None:
    body = client.get("/v1/baby/letters/krittika", params={"lang": "si"}).json()
    assert body["star_name"] == "කැති"
    assert [p["rashi"] for p in body["padas"]] == ["mesha", "vrishabha", "vrishabha", "vrishabha"]
    assert body["padas"][1]["rashi_name"] == "වෘෂභ"


def test_an_unknown_star(client: TestClient) -> None:
    assert client.get("/v1/baby/letters/pluto").status_code == 404


def test_all_stars(client: TestClient) -> None:
    body = client.get("/v1/baby/letters").json()
    assert len(body["stars"]) == 27
    assert body["stars"][26]["padas"][3]["letter"] == "චි"


def test_letters_for_a_birth(client: TestClient) -> None:
    response = client.post(
        "/v1/baby/letters",
        json={"date": "2024-01-18", "time": "11:50", "place_id": COLOMBO, "lang": "en"},
    )
    assert response.status_code == 200
    body = response.json()
    chart = body["chart"]
    assert (chart["star"], chart["pada"], chart["rashi"]) == ("ashwini", 2, "mesha")
    assert (chart["weekday"], chart["timezone"], chart["offset"]) == (
        "thursday",
        "Asia/Colombo",
        "UTC+05:30",
    )
    assert chart["day_note"] == "Born after sunrise, so the day is Thursday."
    assert chart["time_check"]["lagna_changes_within"] == 5
    assert (body["letter"]["letter"], body["letter"]["latin"]) == ("චෙ", "Che")
    assert len(body["star_letters"]["padas"]) == 4
    assert body["nearby"] == []
    assert body["lagna_letters"]["key"] == chart["lagna"]
    assert body["weekday_letters"]["letters"] == ["ත", "ථ", "ද", "ධ", "න"]


def test_a_birth_before_sunrise_belongs_to_the_day_before(client: TestClient) -> None:
    body = client.post(
        "/v1/baby/letters",
        json={"date": "2024-01-18", "time": "05:50", "place_id": COLOMBO, "lang": "si"},
    ).json()
    assert body["chart"]["weekday"] == "wednesday"
    assert body["chart"]["day_note"].startswith("හිරු උදාවට පෙර")
    assert body["weekday_letters"]["key"] == "wednesday"


def test_a_birth_near_a_pada_change(client: TestClient) -> None:
    body = client.post(
        "/v1/baby/letters",
        json={"date": "2024-01-18", "time": "15:10", "place_id": COLOMBO, "lang": "en"},
    ).json()
    assert body["letter"]["letter"] == "චෙ"
    (near,) = body["nearby"]
    assert (near["minutes"], near["direction"], near["pada"], near["letter"]) == (
        3,
        "after",
        3,
        "චො",
    )
    assert near["text"] == (
        "3 minutes later the Moon is in Ashwini pada 3, which gives the letter චො."
    )


def test_coordinates_and_a_time_zone(client: TestClient) -> None:
    body = client.post(
        "/v1/baby/letters",
        json={
            "date": "2024-01-18",
            "time": "06:20",
            "latitude": 51.5,
            "longitude": -0.12,
            "timezone": "Europe/London",
        },
    ).json()
    assert body["status"] == "ok"
    assert (body["chart"]["timezone"], body["chart"]["offset"]) == ("Europe/London", "UTC+00:00")


def test_a_time_that_does_not_exist(client: TestClient) -> None:
    body = client.post(
        "/v1/baby/letters",
        json={
            "date": "2024-03-31",
            "time": "01:30",
            "latitude": 51.5,
            "longitude": -0.12,
            "timezone": "Europe/London",
        },
    ).json()
    assert body["status"] != "ok"
    assert body["chart"] is None and body["letter"] is None


def test_birth_details_are_not_accepted_in_the_address(client: TestClient) -> None:
    response = client.get("/v1/baby/letters", params={"date": "2024-01-18", "time": "11:50"})
    assert "chart" not in response.json()
