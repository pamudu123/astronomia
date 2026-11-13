"""The panchanga engine, checked against a Sri Lankan site and a published Indian panchanga.

Sources (docs/11-nakath-rules.md):
- porondam.lk's panchanga service, asked about 40 made-up moments and 10 change times on
  2026-11-13. Its answers are kept in golden/panchanga_observed.json.
- porondam.lk and lankahandahana.com Rahu kalaya for Colombo on 2026-11-13.
- drikpanchang.com day panchanga for Colombo (geoname 1248991), read on 2026-11-13.
"""

import itertools
import json
import time
import zoneinfo
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.engine import panchanga as P
from app.engine.ephemeris import SwissEphemeris, julian_day
from app.engine.zodiac import NAKSHATRA

EPHEMERIS = SwissEphemeris()
GOLDEN = json.loads(
    (Path(__file__).parent / "golden" / "panchanga_observed.json").read_text(encoding="utf-8")
)
COLOMBO = P.Place(6.9271, 79.8612, "Asia/Colombo")
SL = timezone(timedelta(hours=5, minutes=30))
ZONES = {5.5: "Asia/Colombo", 4.0: "Asia/Dubai", 8.0: "Asia/Singapore"}
# The site's day names: planet names, then the weekday in brackets.
SITE_DAYS = {
    "රිවි": "sunday",
    "සඳු": "monday",
    "කුජ": "tuesday",
    "බුද": "wednesday",
    "ගුරු": "thursday",
    "කිවි": "friday",
    "ශනි": "saturday",
}
MOVING = ["bava", "balava", "kaulava", "taitila", "gara", "vanija", "vishti"]
FIXED = {"shakuni": 8, "chatushpada": 9, "naga": 10, "kimstughna": 11}


def _number(text: str) -> int:
    return int(text.rsplit("-", 1)[1])


def _moment(sample: dict[str, object]) -> datetime:
    zone = timezone(timedelta(hours=float(sample["utc_offset_hours"])))  # type: ignore[arg-type]
    return datetime.fromisoformat(str(sample["local"])).replace(tzinfo=zone)


@pytest.mark.parametrize("sample", GOLDEN["samples"], ids=lambda s: s["local"])
def test_the_five_parts_match_porondam_lk(sample: dict[str, object]) -> None:
    moment = _moment(sample)
    sun, moon = EPHEMERIS.sun_moon(julian_day(moment))
    assert P.thithi_index(sun, moon) + 1 == _number(str(sample["thithi"]))
    assert P.yoga_index(sun, moon) + 1 == _number(str(sample["yoga"]))
    karana = P.karana_key(P.karana_index(sun, moon))
    expected = MOVING.index(karana) + 1 if karana in MOVING else FIXED[karana]
    assert expected == _number(str(sample["karana"]))
    place = P.Place(
        float(sample["latitude"]),  # type: ignore[arg-type]
        float(sample["longitude"]),  # type: ignore[arg-type]
        ZONES[float(sample["utc_offset_hours"])],  # type: ignore[arg-type]
    )
    day = P.sinhala_day(EPHEMERIS, moment, place)
    site_day = next(v for k, v in SITE_DAYS.items() if str(sample["astro_day"]).startswith(k))
    assert P.WEEKDAYS[day.weekday()] == site_day


def test_nakatha_names_line_up_with_the_site() -> None:
    """Each of our nakathas meets one site name only, so the two lists agree."""
    seen: dict[str, set[str]] = {}
    for sample in GOLDEN["samples"]:
        _sun, moon = EPHEMERIS.sun_moon(julian_day(_moment(sample)))
        seen.setdefault(NAKSHATRA[P.nakatha_index(moon)], set()).add(sample["nakatha"])
    assert all(len(names) == 1 for names in seen.values())
    assert len({next(iter(n)) for n in seen.values()}) == len(seen)


def test_sunrise_matches_the_site_to_the_minute() -> None:
    hits = 0
    for sample in GOLDEN["samples"]:
        moment = _moment(sample)
        zone = ZONES[float(sample["utc_offset_hours"])]
        place = P.Place(float(sample["latitude"]), float(sample["longitude"]), zone)
        local_day = moment.astimezone(zoneinfo.ZoneInfo(zone)).date()
        sunrise = P.day_panchanga(EPHEMERIS, local_day, place).sunrise
        assert sunrise is not None
        hits += sunrise.astimezone(moment.tzinfo).strftime("%H:%M") == sample["sunrise"]
    # 39 of 40 to the minute; the other is one minute off.
    assert hits >= 39


@pytest.mark.parametrize(
    "change", GOLDEN["changes"], ids=lambda c: f"{c['part']} {c['local_change']}"
)
def test_change_times_match_the_site(change: dict[str, object]) -> None:
    local = datetime.fromisoformat(str(change["local_change"])).replace(tzinfo=SL)
    spans = P.spans_between(
        EPHEMERIS, str(change["part"]), local - timedelta(hours=2), local + timedelta(hours=2)
    )
    ends = [span.end for span in spans[:-1]]
    closest = min(ends, key=lambda end: abs(end - local))
    assert abs(closest - local) <= timedelta(minutes=1)


def test_rahu_kalaya_matches_both_sri_lankan_sites() -> None:
    day = P.day_panchanga(EPHEMERIS, date(2026, 11, 13), COLOMBO)
    assert day.weekday == "friday"
    clock = [t.astimezone(SL).strftime("%H:%M") for t in day.rahu_kalaya or ()]
    assert clock == ["10:24", "11:52"]  # porondam.lk, sunrise 06:00, sunset 17:49
    # lankahandahana.com: the same rule from its sunrise of 05:59 and sunset of 17:50.
    rise = datetime(2026, 11, 13, 5, 59, tzinfo=SL)
    start, end = P.rahu_kalaya(rise, datetime(2026, 11, 13, 17, 50, tzinfo=SL), "friday")
    assert (start.strftime("%H:%M"), end.strftime("%H:%M")) == ("10:23", "11:51")


# drikpanchang.com, Colombo: changes it prints, and how far ours may differ.
DRIK = [
    ("thithi", "shukla_8", datetime(2026, 12, 17, 23, 25, tzinfo=SL)),
    ("nakatha", "purva_bhadrapada", datetime(2026, 12, 17, 15, 30, tzinfo=SL)),
    ("yoga", "siddhi", datetime(2026, 12, 17, 13, 22, tzinfo=SL)),
    ("thithi", "shukla_8", datetime(2027, 4, 14, 15, 23, tzinfo=SL)),
    ("nakatha", "punarvasu", datetime(2027, 4, 14, 10, 52, tzinfo=SL)),
    ("nakatha", "shravana", datetime(2027, 7, 20, 17, 31, tzinfo=SL)),
]


@pytest.mark.parametrize(("part", "key", "printed"), DRIK)
def test_change_times_are_close_to_drikpanchang(part: str, key: str, printed: datetime) -> None:
    spans = P.spans_between(EPHEMERIS, part, printed - timedelta(hours=3), printed)
    span = next(s for s in spans if s.key == key)
    assert abs(span.end - printed) <= timedelta(minutes=3)


def test_a_day_runs_from_sunrise_to_sunrise() -> None:
    day = P.day_panchanga(EPHEMERIS, date(2026, 12, 17), COLOMBO)
    assert day.sunrise is not None and day.next_sunrise is not None and day.sunset is not None
    assert day.sunrise < day.sunset < day.next_sunrise
    for part in (day.thithi, day.nakatha, day.yoga, day.karana):
        assert part[0].start <= day.sunrise < part[0].end
        assert part[-1].start < day.next_sunrise
        for before, after in itertools.pairwise(part):
            assert before.end == after.start
    assert [s.key for s in day.karana] == ["vishti", "bava", "balava"]


def test_before_sunrise_is_still_the_day_before() -> None:
    early = datetime(2026, 12, 17, 5, 0, tzinfo=SL)
    late = datetime(2026, 12, 17, 7, 0, tzinfo=SL)
    assert P.sinhala_day(EPHEMERIS, early, COLOMBO) == date(2026, 12, 16)
    assert P.sinhala_day(EPHEMERIS, late, COLOMBO) == date(2026, 12, 17)


def test_no_sunrise_near_the_pole() -> None:
    day = P.day_panchanga(
        EPHEMERIS, date(2026, 6, 21), P.Place(78.22, 15.65, "Arctic/Longyearbyen")
    )
    assert day.sunrise is None and day.rahu_kalaya is None
    assert day.thithi  # the five parts still hold


def test_karana_order() -> None:
    assert [P.karana_key(i) for i in (0, 1, 7, 8, 56, 57, 58, 59)] == [
        "kimstughna", "bava", "vishti", "bava", "vishti", "shakuni", "chatushpada", "naga",
    ]  # fmt: skip


def test_days_are_worked_out_once_and_quickly() -> None:
    place = P.Place(7.2906, 80.6337, "Asia/Colombo")
    started = time.perf_counter()
    for offset in range(60):
        P.day_panchanga(EPHEMERIS, date(2028, 1, 1) + timedelta(days=offset), place)
    assert time.perf_counter() - started < 5
    first = P.day_panchanga(EPHEMERIS, date(2028, 1, 1), place)
    assert P.day_panchanga(EPHEMERIS, date(2028, 1, 1), place) is first
