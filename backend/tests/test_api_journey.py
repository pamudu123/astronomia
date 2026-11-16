from fastapi.testclient import TestClient

KANDY = 1241622
BIRTH = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY}


def journey(client: TestClient, lang: str = "en") -> dict:
    body = client.post(
        "/v1/journey", json={**BIRTH, "lang": lang, "as_of": "2026-11-12T00:00:00Z"}
    ).json()
    assert body["status"] == "ok"
    return body["journey"]


def test_the_road_in_english(client: TestClient) -> None:
    road = journey(client)
    assert road["rule_set"] == "journey_v1"
    assert road["provisional"] is True
    assert road["birth"].startswith("1995-04-19")
    assert road["end"].startswith("2095-04-")
    assert road["now"].startswith("2026-11-12")
    assert len(road["quality"]["values"]) == 1201
    assert {p["tone"] for p in road["periods"]} <= {"good", "mixed", "careful"}
    first = road["periods"][0]
    assert first["sub"] and first["theme"]


def test_stops_are_in_order_and_end_with_onward(client: TestClient) -> None:
    stops = journey(client)["stops"]
    assert [s["at"] for s in stops] == sorted(s["at"] for s in stops)
    assert stops[0]["kind"] == "birth" and stops[0]["title"] == "The road begins"
    assert stops[-1]["kind"] == "onward"
    assert stops[-1]["at"].startswith("2091-04-")
    kinds = {s["kind"] for s in stops}
    assert {"period", "erashtaka_start", "erashtaka_end", "guru_return"} <= kinds
    start = next(s for s in stops if s["kind"] == "erashtaka_start")
    assert start["tone"] == "careful" and start["helps"]


def test_the_road_in_sinhala(client: TestClient) -> None:
    stops = journey(client, "si")["stops"]
    assert stops[0]["title"] == "ගමන ආරම්භ වේ"


def test_an_unknown_place_is_not_found(client: TestClient) -> None:
    body = {"date": "1995-04-19", "time": "14:35", "place_id": 999999999}
    assert client.post("/v1/journey", json=body).status_code == 404
