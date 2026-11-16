"""The life road: a hundred years of periods, Erashtaka and Jupiter's returns."""

import itertools
from datetime import UTC, datetime, timedelta

from app.engine.chart import compute_chart
from app.engine.ephemeris import SwissEphemeris
from app.engine.journey import life_journey, load_rules, stays, strength
from app.engine.zodiac import RASHI, Body, whole_sign_house

EPHEMERIS = SwissEphemeris()
# 19 April 1995, 14:35 in Kandy.
BIRTH = datetime(1995, 4, 19, 9, 5, tzinfo=UTC)
CHART = compute_chart(EPHEMERIS, BIRTH, 7.2906, 80.6337)
JOURNEY = life_journey(EPHEMERIS, CHART)


def test_every_road_is_a_hundred_years() -> None:
    assert JOURNEY.birth == BIRTH
    assert round((JOURNEY.end - BIRTH).days / 365.25) == 100
    assert len(JOURNEY.quality) == 1201
    assert all(-1 <= value <= 1 for value in JOURNEY.quality)


def test_periods_cover_the_road_without_gaps() -> None:
    periods = JOURNEY.periods
    assert periods[0].start <= BIRTH < periods[0].end
    assert periods[-1].end >= JOURNEY.end
    for before, after in itertools.pairwise(periods):
        assert before.end == after.start
    subs = [sub for main in periods for sub in main.subs]
    assert subs[0].start <= BIRTH < subs[0].end
    for before, after in itertools.pairwise(subs):
        assert before.end == after.start


def test_saturn_stays_match_the_almanac() -> None:
    start, end = datetime(2025, 1, 1, tzinfo=UTC), datetime(2026, 1, 1, tzinfo=UTC)
    found = stays(EPHEMERIS, Body.SATURN, start, end)
    assert [RASHI[sign] for sign, _ in found] == ["kumbha", "meena"]
    # Saturn entered Meena on 29 March 2025; the road's dates are good to a few hours.
    assert abs(found[1][1].start - datetime(2025, 3, 29, 16, tzinfo=UTC)) < timedelta(days=1)


def test_erashtaka_is_saturn_around_the_moon_sign() -> None:
    spans = JOURNEY.erashtaka
    # About seven and a half years, about every thirty years.
    assert len(spans) == 3
    for span in spans:
        middle = span.start + (span.end - span.start) / 2
        sign = stays(EPHEMERIS, Body.SATURN, middle, middle + timedelta(days=1))[0][0]
        assert whole_sign_house(sign, CHART.moon.sign) in (12, 1, 2)
    whole = [s for s in spans if s.start > BIRTH and s.end < JOURNEY.end]
    assert all(6.5 < (s.end - s.start).days / 365.25 < 9.5 for s in whole)


def test_jupiter_returns_about_every_twelve_years() -> None:
    returns = JOURNEY.guru_returns
    assert 7 <= len(returns) <= 9
    assert all(span.start > BIRTH for span in returns)
    gaps = [(b.start - a.start).days / 365.25 for a, b in itertools.pairwise(returns)]
    assert all(11 < gap < 13 for gap in gaps)


def test_strength_follows_the_rules() -> None:
    rules = load_rules()
    jupiter, rahu = strength(CHART, Body.JUPITER, rules), strength(CHART, Body.RAHU, rules)
    assert jupiter > rahu
    assert rules["provisional"] is True and JOURNEY.provisional is True
