"""The old horoscope search: draw known births from our own engine, then search backwards."""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.engine.chart import Chart, compute_chart
from app.engine.ephemeris import SwissEphemeris, julian_day
from app.engine.zodiac import BODIES, RASHI, Body
from app.kendara.search import Drawing, ImpossibleChart, Query, check_drawing, search
from app.kendara.table import FIRST_DAY, load

EPHEMERIS = SwissEphemeris()
COLOMBO = (6.9271, 79.8612)
GOLDEN = json.loads((Path(__file__).parent / "golden" / "charts.json").read_text())


def golden_births() -> list[tuple[str, datetime, float, float]]:
    births = []
    for chart in GOLDEN:
        given = chart["input"]
        local = datetime.fromisoformat(f"{given['date']}T{given['time']}")
        from zoneinfo import ZoneInfo

        utc = local.replace(tzinfo=ZoneInfo(given["timezone"])).astimezone(UTC)
        births.append((chart["name"], utc, given["latitude"], given["longitude"]))
    return births


# The golden charts, and births spread from 1900 to 2020.
BIRTHS = [
    *golden_births(),
    ("colombo_1902", datetime(1902, 2, 10, 4, 30, tzinfo=UTC), *COLOMBO),
    ("colombo_1911", datetime(1911, 6, 15, 3, 0, tzinfo=UTC), *COLOMBO),
    ("galle_1938", datetime(1938, 9, 21, 13, 15, tzinfo=UTC), 6.0535, 80.221),
    ("colombo_1952", datetime(1952, 11, 2, 22, 40, tzinfo=UTC), *COLOMBO),
    ("jaffna_1979", datetime(1979, 1, 8, 9, 50, tzinfo=UTC), 9.6615, 80.0255),
    ("london_2008", datetime(2008, 7, 4, 16, 20, tzinfo=UTC), 51.5074, -0.1278),
    ("colombo_2019", datetime(2019, 12, 26, 2, 10, tzinfo=UTC), *COLOMBO),
]
NOW = datetime(2026, 11, 13, tzinfo=UTC)


def drawings(chart: Chart) -> tuple[Drawing, Drawing]:
    rashi = Drawing(chart.lagna.sign, {b: chart.planets[b].point.sign for b in BODIES})
    navamsha = Drawing(
        chart.lagna.navamsha_sign, {b: chart.planets[b].point.navamsha_sign for b in BODIES}
    )
    return rashi, navamsha


@pytest.mark.parametrize(
    ("name", "utc", "latitude", "longitude"), BIRTHS, ids=[b[0] for b in BIRTHS]
)
def test_the_true_birth_is_found(
    name: str, utc: datetime, latitude: float, longitude: float
) -> None:
    chart = compute_chart(EPHEMERIS, utc, latitude, longitude)
    rashi, navamsha = drawings(chart)
    place = {"latitude": latitude, "longitude": longitude, "end": NOW}

    plain = search(EPHEMERIS, load(), Query(rashi, **place))  # type: ignore[arg-type]
    hits = [m for m in plain.matches if m.start <= utc <= m.end]
    assert len(hits) == 1, name
    assert hits[0].grade == "exact"
    assert not plain.cut_off
    # The Moon's star at the birth is among the stars listed for the window.
    assert chart.moon.nakshatra in {span.nakshatra for span in hits[0].stars}

    with_navamsha = search(EPHEMERIS, load(), Query(rashi, navamsha, **place))  # type: ignore[arg-type]
    narrow = [m for m in with_navamsha.matches if m.start <= utc <= m.end]
    assert len(narrow) == 1, name
    assert narrow[0].end - narrow[0].start < (hits[0].end - hits[0].start) / 3
    assert narrow[0].end - narrow[0].start <= timedelta(minutes=40)
    assert len(with_navamsha.matches) <= len(plain.matches)


def test_a_planet_near_the_edge_is_found_as_near() -> None:
    # On 1 March 1980 Saturn was at 1 degree of Kanya. A paper drawn with another ayanamsa
    # could show it in Simha, the sign before.
    utc = datetime(1980, 3, 1, 6, 0, tzinfo=UTC)
    chart = compute_chart(EPHEMERIS, utc, *COLOMBO)
    assert chart.planets[Body.SATURN].point.sign == RASHI.index("kanya")
    rashi, _ = drawings(chart)
    shifted = Drawing(rashi.lagna, {**rashi.planets, Body.SATURN: RASHI.index("simha")})
    result = search(EPHEMERIS, load(), Query(shifted, end=NOW))
    hits = [m for m in result.matches if m.start <= utc <= m.end]
    assert len(hits) == 1
    assert hits[0].grade == "near"
    assert Body.SATURN in hits[0].near


def test_narrowing_by_star_and_dates() -> None:
    _, utc, latitude, longitude = BIRTHS[0]
    chart = compute_chart(EPHEMERIS, utc, latitude, longitude)
    rashi, _ = drawings(chart)
    place = {"latitude": latitude, "longitude": longitude}
    by_star = search(
        EPHEMERIS,
        load(),
        Query(rashi, **place, end=NOW, nakshatra=chart.moon.nakshatra),  # type: ignore[arg-type]
    )
    assert any(m.start <= utc <= m.end for m in by_star.matches)
    assert all(span.nakshatra == chart.moon.nakshatra for m in by_star.matches for span in m.stars)
    one_year = search(
        EPHEMERIS,
        load(),
        Query(rashi, **place, start=utc - timedelta(days=200), end=utc + timedelta(days=200)),  # type: ignore[arg-type]
    )
    assert [m for m in one_year.matches if m.start <= utc <= m.end]
    # The Moon stays about 2.5 days in a sign, so the lagna fits once a day for up to 3 days.
    assert len(one_year.matches) <= 3
    assert one_year.matches[-1].end - one_year.matches[0].start < timedelta(days=3)


def test_impossible_drawings() -> None:
    ok = Drawing(0, {Body.SUN: 0, Body.MERCURY: 1, Body.VENUS: 2, Body.RAHU: 3, Body.KETU: 9})
    assert check_drawing(ok) == []
    assert check_drawing(Drawing(0, {Body.RAHU: 3, Body.KETU: 8})) == ["nodes_not_opposite"]
    assert check_drawing(Drawing(0, {Body.SUN: 0, Body.MERCURY: 2})) == ["mercury_far_from_sun"]
    assert check_drawing(Drawing(0, {Body.SUN: 0, Body.VENUS: 9})) == ["venus_far_from_sun"]
    with pytest.raises(ImpossibleChart):
        search(EPHEMERIS, load(), Query(Drawing(0, {Body.RAHU: 3, Body.KETU: 3})))


def test_the_table_matches_the_ephemeris() -> None:
    table = load()
    assert table.first_day == FIRST_DAY
    assert table.day_start(table.days - 1).year >= NOW.year + 5
    for day in (0, 1234, 20000, 33000, 45678):
        positions = EPHEMERIS.positions(julian_day(table.day_start(day)))
        for body in BODIES:
            expected = positions[body].longitude
            difference = (table.longitude(body, day) - expected + 180) % 360 - 180
            assert abs(difference) < 0.006, (day, body)


def test_utc_of_the_window_is_aware() -> None:
    _, utc, latitude, longitude = BIRTHS[0]
    rashi, _ = drawings(compute_chart(EPHEMERIS, utc, latitude, longitude))
    match = search(EPHEMERIS, load(), Query(rashi, end=NOW)).matches[0]
    assert match.start.tzinfo is not None
    assert match.start.utcoffset() == timedelta(0)
