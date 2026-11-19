from typing import Any

from fastapi.testclient import TestClient

KANDY = 1241622
BIRTH = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY}


def journey(client: TestClient, lang: str = "en") -> dict[str, Any]:
    body = client.post(
        "/v1/journey", json={**BIRTH, "lang": lang, "as_of": "2026-11-12T00:00:00Z"}
    ).json()
    assert body["status"] == "ok"
    road: dict[str, Any] = body["journey"]
    return road


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


GROOM = {"date": "1992-08-03", "time": "06:10", "place_id": KANDY}


def test_a_couple_gets_a_road_each(client: TestClient) -> None:
    body = client.post(
        "/v1/journey/couple",
        json={"bride": BIRTH, "groom": GROOM, "as_of": "2026-11-12T00:00:00Z"},
    ).json()
    assert body["status"] == "ok"
    assert body["bride"] == journey(client)
    assert body["groom"]["birth"].startswith("1992-08-03")
    assert body["groom"]["stops"][-1]["kind"] == "onward"


def test_a_birth_star_only_person_has_no_road(client: TestClient) -> None:
    quick = {"nakshatra": "rohini", "pada": 1}
    body = client.post("/v1/journey/couple", json={"bride": BIRTH, "groom": quick}).json()
    assert body == {
        "status": "needs_birth",
        "waiting_for": None,
        "time": None,
        "bride": None,
        "groom": None,
    }


def test_erashtaka_is_also_counted_from_the_rising_sign(client: TestClient) -> None:
    """For the written reading's Saturn periods (docs/17). The road still uses the Moon's."""
    road = journey(client)
    moon, lagna = road["erashtaka"], road["erashtaka_lagna"]
    assert moon and lagna
    # Simha rising, Vrischika Moon: the two counts give different stretches.
    assert [s["start"] for s in moon] != [s["start"] for s in lagna]
    for span in lagna:
        assert span["start"] < span["end"]
