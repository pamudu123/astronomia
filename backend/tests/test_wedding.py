"""Wedding nakath finder: every suggestion is checked again, rule by rule, independently."""

import time as clock
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api import wedding as wedding_api
from app.engine import panchanga as P
from app.engine.ephemeris import SwissEphemeris, julian_day
from app.engine.wedding import Person, _combust, find_dates, load_rules, tara
from app.engine.zodiac import NAKSHATRA, RASHI, Body, sign_index, whole_sign_house

EPHEMERIS = SwissEphemeris()
COLOMBO = P.Place(6.9271, 79.8612, "Asia/Colombo")
SL = timezone(timedelta(hours=5, minutes=30))
BRIDE = Person(NAKSHATRA.index("rohini"), RASHI.index("vrishabha"))
GROOM = Person(NAKSHATRA.index("hasta"), RASHI.index("kanya"))
CEREMONIES = ("engagement", "poruwa", "homecoming")


@pytest.fixture(scope="module")
def year_of_dates() -> dict[str, list]:  # type: ignore[type-arg]
    return find_dates(EPHEMERIS, COLOMBO, date(2027, 1, 1), 365, CEREMONIES, BRIDE, GROOM)


def _rules_hold(ceremony: str, when: datetime) -> None:
    """Every hard rule, worked out again from the sky at this moment."""
    rules = load_rules()
    common, own = rules["common"], rules["ceremonies"][ceremony]
    sun, moon = EPHEMERIS.sun_moon(julian_day(when))
    star = P.nakatha_index(moon)
    assert NAKSHATRA[star] in own["nakatha"]
    pada = int(moon // (360 / 108)) % 4 + 1
    assert pada not in own["avoid_padas"].get(NAKSHATRA[star], [])
    assert P.thithi_index(sun, moon) + 1 not in common["avoid_thithi"]
    assert P.karana_key(P.karana_index(sun, moon)) != "vishti"
    for person in (BRIDE, GROOM):
        assert tara(person.star, star) not in (3, 5, 7)
        assert whole_sign_house(sign_index(moon), person.moon_sign) not in (6, 8, 12)
    day = P.day_panchanga(EPHEMERIS, when.astimezone(SL).date(), COLOMBO)
    assert day.sunrise is not None and day.sunset is not None and day.rahu_kalaya is not None
    assert day.sunrise <= when < day.sunset
    assert not day.rahu_kalaya[0] <= when < day.rahu_kalaya[1]
    assert day.weekday not in own["avoid_weekday"]
    assert not _combust(EPHEMERIS, when)
    if own["seventh_house_free"]:
        jd = julian_day(when)
        lagna = sign_index(EPHEMERIS.ascendant(jd, COLOMBO.latitude, COLOMBO.longitude))
        positions = EPHEMERIS.positions(jd)
        for body in (Body.SUN, Body.MARS, Body.SATURN, Body.RAHU, Body.KETU):
            assert sign_index(positions[body].longitude) != (lagna + 6) % 12, body


@pytest.mark.parametrize("ceremony", CEREMONIES)
def test_every_suggestion_passes_every_rule(ceremony: str, year_of_dates: dict) -> None:  # type: ignore[type-arg]
    suggestions = year_of_dates[ceremony]
    assert len(suggestions) == load_rules()["suggestions"]
    for item in suggestions:
        assert item.end - item.start >= timedelta(minutes=20)
        middle = item.start + (item.end - item.start) / 2
        for when in (item.start, middle, item.end - timedelta(minutes=1)):
            _rules_hold(ceremony, when)


def test_suggestions_are_spread_and_in_order(year_of_dates: dict) -> None:  # type: ignore[type-arg]
    for suggestions in year_of_dates.values():
        days = [item.day for item in suggestions]
        assert days == sorted(days)
        weeks = [day.isocalendar()[:2] for day in days]
        assert len(weeks) == len(set(weeks))
        assert all(date(2027, 1, 1) <= day <= date(2027, 12, 31) for day in days)


def test_window_edges_are_to_the_minute(year_of_dates: dict) -> None:  # type: ignore[type-arg]
    for suggestions in year_of_dates.values():
        for item in suggestions:
            assert item.start.second == 0 and item.end.second == 0


def test_tara_counts_in_nines() -> None:
    rohini = NAKSHATRA.index("rohini")
    assert tara(rohini, rohini) == 1  # janma
    assert tara(rohini, rohini + 2) == 3  # vipat
    assert tara(rohini, (rohini + 9) % 27) == 1
    assert tara(rohini, (rohini - 1) % 27) == 9


def test_combust_days_are_left_out() -> None:
    # Venus passes behind the Sun (superior conjunction) in late October 2027.
    combust = [
        d
        for d in range(0, 60)
        if _combust(EPHEMERIS, datetime(2027, 9, 15, 6, tzinfo=SL) + timedelta(days=d))
    ]
    assert combust, "expected a combust stretch"


def test_two_years_are_fast_enough() -> None:
    started = clock.perf_counter()
    found = find_dates(EPHEMERIS, COLOMBO, date(2028, 1, 1), 731, CEREMONIES, BRIDE, GROOM)
    assert clock.perf_counter() - started < 20
    assert all(found[c] for c in CEREMONIES)


def test_range_limit() -> None:
    with pytest.raises(ValueError, match="too long"):
        find_dates(EPHEMERIS, COLOMBO, date(2027, 1, 1), 800, ("poruwa",), BRIDE, GROOM)


# ---------- the endpoint ----------

BODY = {
    "bride": {"nakshatra": "rohini", "pada": 2},
    "groom": {"date": "1995-04-19", "time": "14:35", "place_id": 1241622},
    "months": 3,
    "as_of": "2027-01-01",
    "ceremonies": ["poruwa"],
}


def test_the_finder_in_english(client: TestClient) -> None:
    response = client.post("/v1/wedding-nakath", json={**BODY, "lang": "en"})
    assert response.status_code == 200
    assert "1995" not in str(response.url)
    body = response.json()
    assert body["status"] == "ok" and body["provisional"] is True
    assert (body["first"], body["last"]) == ("2027-01-01", "2027-03-31")
    assert body["place"]["name"] == "Colombo"
    (ceremony,) = body["ceremonies"]
    assert ceremony["name"] == "Poruwa ceremony"
    first = ceremony["suggestions"][0]
    assert first["start"]["local"].endswith("+05:30")
    assert any(line.startswith("The lagna is") for line in first["passes"])
    assert any("Rahu kalaya" in line for line in first["passes"])
    assert "astrologer" in body["note"]


def test_the_finder_in_sinhala(client: TestClient) -> None:
    body = client.post("/v1/wedding-nakath", json={**BODY, "lang": "si"}).json()
    assert body["ceremonies"][0]["name"] == "පෝරුව චාරිත්‍රය"
    assert body["ceremonies"][0]["suggestions"][0]["passes"][0].startswith("චන්ද්‍රයා")


def test_a_place_abroad_by_coordinates(client: TestClient) -> None:
    body = client.post(
        "/v1/wedding-nakath",
        json={**BODY, "latitude": 51.5074, "longitude": -0.1278, "timezone": "Europe/London"},
    ).json()
    assert body["place"]["timezone"] == "Europe/London"
    local = body["ceremonies"][0]["suggestions"][0]["start"]["local"]
    assert local.endswith(("Z", "+00:00", "+01:00"))  # London, winter or summer


def test_a_clock_change_birth_asks_which_one(client: TestClient) -> None:
    groom = {
        "date": "2025-10-26",
        "time": "01:30",
        "latitude": 51.5,
        "longitude": -0.12,
        "timezone": "Europe/London",
    }
    body = client.post("/v1/wedding-nakath", json={**BODY, "groom": groom}).json()
    assert (body["status"], body["waiting_for"]) == ("ambiguous", "groom")


def test_bad_input(client: TestClient) -> None:
    def post(**extra: object) -> int:
        return client.post("/v1/wedding-nakath", json={**BODY, **extra}).status_code

    assert post(months=5) == 422
    assert post(ceremonies=[]) == 422
    assert post(ceremonies=["party"]) == 422
    assert post(place_id=1, latitude=1.0) == 422
    assert post(place_id=999999999) == 404


def test_the_access_check_covers_the_finder(client: TestClient) -> None:
    """The paid lock is added in wedding_access(); locking it locks the finder only."""

    def locked() -> None:
        raise HTTPException(402, "paid")

    client.app.dependency_overrides[wedding_api.wedding_access] = locked  # type: ignore[attr-defined]
    assert client.post("/v1/wedding-nakath", json=BODY).status_code == 402
    assert (
        client.get("/v1/panchanga", params={"date": "2027-01-01", "place_id": 1248991}).status_code
        == 200
    )
    assert client.get("/v1/avurudu/2027").status_code == 200
