"""Vimshottari dasha: the 120 year cycle of planetary periods, from the Moon's nakshatra.

Three levels: maha dasha (main period), antar dasha (sub period) and pratyantar dasha.
A year is taken as 365.25 days, the usual choice in software. This is a setting the
astrologer review may change.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from app.engine.zodiac import DEGREES_PER_NAKSHATRA, NAKSHATRA_LORD, Body, nakshatra_index

YEAR_DAYS = 365.25

# Order and length in years. The order repeats; the cycle totals 120 years.
SEQUENCE: tuple[tuple[Body, int], ...] = (
    (Body.KETU, 7),
    (Body.VENUS, 20),
    (Body.SUN, 6),
    (Body.MOON, 10),
    (Body.MARS, 7),
    (Body.RAHU, 18),
    (Body.JUPITER, 16),
    (Body.SATURN, 19),
    (Body.MERCURY, 17),
)
YEARS = dict(SEQUENCE)
TOTAL_YEARS = 120


@dataclass(frozen=True)
class Period:
    lord: Body
    start: datetime
    end: datetime
    children: tuple["Period", ...] = ()

    def contains(self, moment: datetime) -> bool:
        return self.start <= moment < self.end


@dataclass(frozen=True)
class DashaTimeline:
    birth: datetime
    balance_years: float  # years of the first main period left at birth
    periods: tuple[Period, ...]  # main periods, each with sub periods and their sub periods

    def current(self, moment: datetime) -> list[Period]:
        """The running main, sub and third level period, or fewer at the edges."""
        found: list[Period] = []
        level: tuple[Period, ...] = self.periods
        while level:
            match = next((p for p in level if p.contains(moment)), None)
            if match is None:
                break
            found.append(match)
            level = match.children
        return found


def _rotation(start_lord: Body) -> list[tuple[Body, int]]:
    index = next(i for i, (lord, _) in enumerate(SEQUENCE) if lord is start_lord)
    return [SEQUENCE[(index + i) % 9] for i in range(9)]


def _split(lord: Body, start: datetime, length: timedelta, depth: int) -> tuple[Period, ...]:
    """Divide a period among the nine lords, starting with its own lord, in proportion."""
    children = []
    cursor = start
    for sub_lord, years in _rotation(lord):
        part = length * (years / TOTAL_YEARS)
        grandchildren = _split(sub_lord, cursor, part, depth - 1) if depth > 1 else ()
        children.append(Period(sub_lord, cursor, cursor + part, grandchildren))
        cursor += part
    return tuple(children)


def vimshottari(moon_longitude: float, birth: datetime, levels: int = 3) -> DashaTimeline:
    if birth.tzinfo is None:
        raise ValueError("birth must be timezone aware")
    nakshatra = nakshatra_index(moon_longitude)
    first_lord = NAKSHATRA_LORD[nakshatra]
    passed = (moon_longitude % 360.0 - nakshatra * DEGREES_PER_NAKSHATRA) / DEGREES_PER_NAKSHATRA
    passed = min(max(passed, 0.0), 1.0)

    first_years = YEARS[first_lord]
    # The first main period began before birth: the Moon had already moved through
    # part of its nakshatra.
    start = birth - timedelta(days=passed * first_years * YEAR_DAYS)

    periods = []
    cursor = start
    for lord, years in _rotation(first_lord):
        length = timedelta(days=years * YEAR_DAYS)
        children = _split(lord, cursor, length, levels - 1) if levels > 1 else ()
        periods.append(Period(lord, cursor, cursor + length, children))
        cursor += length
    return DashaTimeline(
        birth=birth, balance_years=(1 - passed) * first_years, periods=tuple(periods)
    )
