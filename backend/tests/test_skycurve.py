"""The Sun and Moon curve against Swiss Ephemeris, and how little it asks of it."""

import random
from datetime import date, timedelta

from app.engine import panchanga as P
from app.engine import skycurve
from app.engine.ephemeris import SwissEphemeris

FIRST, LAST = 2415021, 2488434  # 1900 to 2100


def _apart(one: float, other: float) -> float:
    return abs((one - other + 180.0) % 360.0 - 180.0)


def test_the_curve_matches_the_ephemeris() -> None:
    ephemeris = SwissEphemeris()
    picker = random.Random(20261125)
    # The edges of a day too: two curves meet there.
    parts = [0.0, 1e-6, 0.5, 1 - 1e-6]
    for _ in range(150):
        day = picker.randrange(FIRST, LAST)
        for part in [*parts, picker.random()]:
            exact = ephemeris.sun_moon(day + part)
            curve = skycurve.sun_moon(ephemeris, day + part)
            assert _apart(exact[0], curve[0]) < 1e-6
            assert _apart(exact[1], curve[1]) < 1e-6


def test_the_moon_passing_360_degrees_is_smooth() -> None:
    ephemeris = SwissEphemeris()
    start = 2461346.0  # November 2026: the Moon passes 360 degrees once in these 28 days
    before = skycurve.sun_moon(ephemeris, start)[1]
    wraps = 0
    for hour in range(1, 28 * 24):
        moon = skycurve.sun_moon(ephemeris, start + hour / 24)[1]
        assert 0 <= moon < 360
        assert 0.4 < (moon - before) % 360 < 0.7
        wraps += moon < before
        before = moon
    assert wraps in (1, 2)


class _Counting(SwissEphemeris):
    calls = 0

    def sun_moon(self, jd_ut: float) -> tuple[float, float]:
        self.calls += 1
        return super().sun_moon(jd_ut)


def test_a_month_asks_for_few_exact_positions() -> None:
    """The litha took half a minute on a small server when every search step was exact."""
    ephemeris = _Counting()
    place = P.Place(6.93548, 79.84868, "Asia/Colombo")
    for offset in range(30):
        P.day_panchanga(ephemeris, date(2026, 11, 1) + timedelta(days=offset), place)
    assert 0 < ephemeris.calls < 500
