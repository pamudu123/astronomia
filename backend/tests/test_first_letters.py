"""The first letters ceremony finder: its rules, the Sinhala columns, and every suggestion."""

import datetime as dt
import json
import zoneinfo
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.charts import EPHEMERIS
from app.api.first_letters import first_letters_access
from app.engine.ephemeris import julian_day
from app.engine.first_letters import _day, age_on, check, find_dates, load_rules
from app.engine.panchanga import Place, day_panchanga
from app.engine.wedding import moment_at, tara
from app.engine.zodiac import BODIES, NAKSHATRA, RASHI, sign_index

OBSERVED = json.loads(
    (Path(__file__).parent / "golden" / "first_letters_observed.json").read_text("utf-8")
)
COLOMBO = Place(6.9271, 79.8612, "Asia/Colombo")
ZONE = zoneinfo.ZoneInfo("Asia/Colombo")
GOOD = set(range(1, 10)) - {1, 3, 5, 7}


def _at(local: str) -> dt.datetime:
    return dt.datetime.fromisoformat(local).replace(tzinfo=ZONE).astimezone(dt.UTC)


def _good_stars(day_star: str) -> set[str]:
    index = NAKSHATRA.index(day_star)
    return {s for i, s in enumerate(NAKSHATRA) if tara(i, index) in GOOD}


def test_the_rules_are_provisional_and_known() -> None:
    rules = load_rules()
    assert rules["provisional"] is True
    assert set(rules["nakatha"]) <= set(NAKSHATRA)
    assert set(rules["lagna"]) == {"mithuna", "kanya", "dhanu", "meena"}
    assert rules["avoid_tara"] == [1, 3, 5, 7]
    assert rules["search_months"] == [1, 3, 6]


def test_divaina_15_july_2026_passes_every_rule() -> None:
    column = OBSERVED["columns"][0]
    when = _at(column["local"])
    moment = moment_at(EPHEMERIS, when, COLOMBO)
    assert (moment.nakatha, RASHI[moment.lagna]) == (column["nakatha"], column["lagna"])
    # The column's list is exactly the stars with a good tara.
    assert _good_stars(moment.nakatha) == set(column["suits"])
    day = _day(EPHEMERIS, dt.date(2026, 7, 15), COLOMBO)
    assert day is not None
    for star in NAKSHATRA:
        passes = check(moment, when, day, NAKSHATRA.index(star)) is not None
        assert passes == (star in column["suits"]), star


def test_divaina_16_july_2026_uses_a_star_outside_our_list() -> None:
    """Its tara list fits Ashlesha, the day's star. Ashlesha is not in porondam.lk's twelve."""
    column = OBSERVED["columns"][1]
    moment = moment_at(EPHEMERIS, _at(column["local"]), COLOMBO)
    assert moment.nakatha == column["nakatha"] == "ashlesha"
    assert _good_stars(moment.nakatha) == set(column["suits"])
    assert "ashlesha" not in load_rules()["nakatha"]
    # The column says Mithuna lagna. With the Lahiri ayanamsa it is Kataka by 06:22.
    assert RASHI[moment.lagna] == "kataka"


def test_divaina_23_march_2026_moon_sign() -> None:
    """The Moon is exalted in Vrishabha, as the column says. Its list fits Mrigashira, not the
    day's Krittika, so the list itself is not used as a check."""
    column = OBSERVED["columns"][2]
    moment = moment_at(EPHEMERIS, _at(column["local"]), COLOMBO)
    assert RASHI[moment.moon_sign] == column["moon_sign"]
    assert moment.nakatha == "krittika"
    assert _good_stars("mrigashira") == set(column["suits"])


def test_lankadeepa_1_october_2018_matches_and_fails_on_the_panchanga() -> None:
    column = OBSERVED["columns"][3]
    when = _at(column["local"])
    moment = moment_at(EPHEMERIS, when, COLOMBO)
    assert (moment.nakatha, RASHI[moment.moon_sign], RASHI[moment.lagna]) == (
        column["nakatha"],
        column["moon_sign"],
        column["lagna"],
    )
    assert set(NAKSHATRA) - _good_stars(moment.nakatha) == set(column["does_not_suit"])
    # The column admits the panchanga is not pure that day: the karana is Vishti.
    assert column["panchanga_pure"] is False
    assert moment.karana == "vishti"
    day = _day(EPHEMERIS, dt.date(2018, 10, 1), COLOMBO)
    assert day is not None
    assert check(moment, when, day, NAKSHATRA.index("rohini")) is None


def _passes_independently(when: dt.datetime, star: int, place: Place) -> bool:
    """Every rule, worked out again from the sky without the finder's helpers."""
    rules = load_rules()
    local = when.astimezone(zoneinfo.ZoneInfo(place.timezone))
    panchanga = day_panchanga(EPHEMERIS, local.date(), place)
    assert panchanga.sunrise and panchanga.sunset
    if not panchanga.sunrise <= when < panchanga.sunset:
        return False
    if panchanga.rahu_kalaya and panchanga.rahu_kalaya[0] <= when < panchanga.rahu_kalaya[1]:
        return False
    moment = moment_at(EPHEMERIS, when, place)
    positions = EPHEMERIS.positions(julian_day(when))
    eighth = (moment.lagna + 7) % 12
    return (
        panchanga.weekday not in rules["avoid_weekday"]
        and moment.nakatha in rules["nakatha"]
        and moment.thithi not in rules["avoid_thithi"]
        and moment.karana != "vishti"
        and tara(star, NAKSHATRA.index(moment.nakatha)) not in rules["avoid_tara"]
        and RASHI[moment.lagna] in rules["lagna"]
        and all(sign_index(positions[b].longitude) != eighth for b in BODIES)
    )


@pytest.mark.parametrize(
    ("star", "place"),
    [
        ("ashwini", COLOMBO),
        ("purva_ashadha", COLOMBO),
        ("rohini", Place(51.5074, -0.1278, "Europe/London")),
    ],
)
def test_every_suggestion_passes_at_its_start_middle_and_end(star: str, place: Place) -> None:
    found = find_dates(EPHEMERIS, place, dt.date(2026, 12, 1), 92, NAKSHATRA.index(star))
    assert found
    for item in found:
        assert item.end - item.start >= dt.timedelta(minutes=15)
        last = item.end - dt.timedelta(minutes=1)
        for when in (item.start, item.start + (last - item.start) / 2, last):
            assert _passes_independently(when, NAKSHATRA.index(star), place), (item, when)
    # One suggestion a week at most, in date order.
    weeks = [item.day.isocalendar()[:2] for item in found]
    assert len(weeks) == len(set(weeks))
    assert [i.day for i in found] == sorted(i.day for i in found)


def test_age() -> None:
    assert age_on(dt.date(2023, 5, 10), dt.date(2026, 7, 8)) == (3, 1)
    assert age_on(dt.date(2023, 5, 10), dt.date(2026, 5, 9)) == (2, 11)
    assert age_on(dt.date(2023, 5, 10), dt.date(2026, 5, 10)) == (3, 0)


def test_too_long_a_search_is_refused() -> None:
    with pytest.raises(ValueError):
        find_dates(EPHEMERIS, COLOMBO, dt.date(2026, 1, 1), 400, 0)


KANDY = 1241622
CHILD = {"date": "2023-05-10", "time": "08:15", "place_id": KANDY}


def test_the_finder_for_a_child(client: TestClient) -> None:
    body = client.post(
        "/v1/first-letters",
        json={"child": CHILD, "months": 1, "as_of": "2026-07-01", "lang": "en"},
    ).json()
    assert body["status"] == "ok"
    assert (body["rule_set"], body["provisional"]) == ("first_letters_si_v1", True)
    assert body["child"] == {"star": "purva_ashadha", "star_name": "Purva Ashadha", "mode": "full"}
    assert (body["first"], body["last"]) == ("2026-07-01", "2026-07-31")
    assert body["place"]["name"] == "Colombo" and body["place"]["offset"] == "UTC+05:30"
    (item,) = body["suggestions"]
    assert (item["date"], item["start"]["clock"], item["end"]["clock"]) == (
        "2026-07-08",
        "10:44",
        "12:12",
    )
    assert item["age"] == "The child will be 3 years and 1 month old."
    assert "Revati is one of the nakathas for first letters." in item["passes"]
    assert "The Moon is waning. The bright half is preferred." in item["cautions"]
    assert body["age_note"] is None


def test_the_finder_with_a_birth_star_in_sinhala(client: TestClient) -> None:
    body = client.post(
        "/v1/first-letters",
        json={
            "child": {"nakshatra": "ashwini", "pada": 1},
            "months": 1,
            "as_of": "2026-07-01",
            "lang": "si",
        },
    ).json()
    assert body["child"]["mode"] == "quick"
    days = [item["date"] for item in body["suggestions"]]
    assert "2026-07-15" in days
    pushya = body["suggestions"][days.index("2026-07-15")]
    assert pushya["nakatha"] == "පුෂ"
    assert pushya["age"] is None
    assert pushya["passes"][0] == "පුෂ අකුරු කියවීමට සුබ නැකතකි."


def test_an_age_outside_the_usual_range_gets_a_note(client: TestClient) -> None:
    body = client.post(
        "/v1/first-letters",
        json={
            "child": {"nakshatra": "ashwini", "pada": 1},
            "birth_date": "2026-01-01",
            "months": 1,
            "as_of": "2026-07-01",
        },
    ).json()
    assert body["age_note"] == "Most sources give an age between 2 and 5 for the first letters."


def test_a_place_abroad(client: TestClient) -> None:
    body = client.post(
        "/v1/first-letters",
        json={
            "child": {"nakshatra": "rohini", "pada": 2},
            "latitude": 51.5074,
            "longitude": -0.1278,
            "timezone": "Europe/London",
            "months": 3,
            "as_of": "2026-12-01",
        },
    ).json()
    assert body["place"]["timezone"] == "Europe/London"
    assert body["place"]["offset"] == "UTC+00:00"
    assert body["suggestions"]
    # Winter in London: the local clock is UTC.
    assert all(i["start"]["local"][:16] == i["start"]["utc"][:16] for i in body["suggestions"])


def test_bad_requests(client: TestClient) -> None:
    child = {"nakshatra": "ashwini", "pada": 1}
    assert client.post("/v1/first-letters", json={"child": child, "months": 12}).status_code == 422
    assert (
        client.post(
            "/v1/first-letters", json={"child": {"nakshatra": "pluto", "pada": 1}}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/v1/first-letters", json={"child": child, "place_id": KANDY, "timezone": "UTC"}
        ).status_code
        == 422
    )


def test_locking_the_finder_leaves_the_letters_open(client: TestClient) -> None:
    def locked() -> None:
        raise HTTPException(402, "paid feature")

    client.app.dependency_overrides[first_letters_access] = locked  # type: ignore[attr-defined]
    child = {"nakshatra": "ashwini", "pada": 1}
    assert client.post("/v1/first-letters", json={"child": child}).status_code == 402
    assert client.get("/v1/baby/letters/ashwini").status_code == 200
    assert client.get("/v1/baby/names", params={"letters": "අ"}).status_code == 200
