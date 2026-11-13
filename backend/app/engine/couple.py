"""The years ahead for a couple: each person's Saturn periods and dasha periods, side by side.

Facts only: dates, planets and houses. How to read them is for the astrologer, so nothing
here judges a period as good or bad.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime
from functools import lru_cache
from typing import Literal

from app.engine.dasha import Period, vimshottari
from app.engine.ephemeris import Ephemeris
from app.engine.transits import sign_changes, signs_at
from app.engine.zodiac import Body, whole_sign_house

RULE_SET = "couple_v1"
# Which Saturn houses to show, and how to read any of this, wait for the astrologer.
PROVISIONAL = True

YEARS = 10

SaturnKind = Literal["erashtaka", "ashtama"]
# Saturn's house counted from the Moon sign. 12, 1 and 2 together are the seven and a half
# years called Erashtaka (Sade Sati); the 8th is shown apart.
KIND_OF_HOUSE: dict[int, SaturnKind] = {
    12: "erashtaka",
    1: "erashtaka",
    2: "erashtaka",
    8: "ashtama",
}


@dataclass(frozen=True)
class Stay:
    """Saturn in one sign, for the part of that stay inside the window."""

    sign: int
    start: datetime
    end: datetime


@dataclass(frozen=True)
class Span:
    start: datetime
    end: datetime
    from_before: bool = False  # already running when the window opens
    continues: bool = False  # still running when the window closes


@dataclass(frozen=True)
class SaturnPeriod(Span):
    kind: SaturnKind = "erashtaka"


def window(day: date, years: int = YEARS) -> tuple[datetime, datetime]:
    """From the start of this day (UTC) to the same date some years on."""
    start = datetime(day.year, day.month, day.day, tzinfo=UTC)
    try:
        end = start.replace(year=start.year + years)
    except ValueError:  # 29 February
        end = start.replace(year=start.year + years, day=28)
    return start, end


@lru_cache(maxsize=8)
def saturn_stays(ephemeris: Ephemeris, day: date, years: int = YEARS) -> tuple[Stay, ...]:
    """Saturn's signs over the window, in order. The same for everyone, so it is kept."""
    start, end = window(day, years)
    stays: list[Stay] = []
    sign, since = signs_at(ephemeris, start)[Body.SATURN], start
    for change in sign_changes(ephemeris, start, end, bodies=(Body.SATURN,)):
        stays.append(Stay(sign, since, change.moment))
        sign, since = change.to_sign, change.moment
    stays.append(Stay(sign, since, end))
    return tuple(stays)


def saturn_periods(stays: tuple[Stay, ...], moon_sign: int) -> list[SaturnPeriod]:
    """The stretches of the window where Saturn is in a counted house from this Moon sign.

    Stays that follow one another with the same kind are one period, so Erashtaka runs
    through the 12th, 1st and 2nd without a break.
    """
    if not stays:
        return []
    opens, closes = stays[0].start, stays[-1].end
    periods: list[SaturnPeriod] = []
    for stay in stays:
        kind = KIND_OF_HOUSE.get(whole_sign_house(stay.sign, moon_sign))
        if kind is None:
            continue
        last = periods[-1] if periods else None
        if last and last.kind == kind and last.end == stay.start:
            periods[-1] = SaturnPeriod(last.start, stay.end, last.from_before, kind=kind)
        else:
            periods.append(SaturnPeriod(stay.start, stay.end, stay.start == opens, kind=kind))
    return [
        SaturnPeriod(p.start, p.end, p.from_before, p.end == closes, kind=p.kind) for p in periods
    ]


def overlaps(first: list[SaturnPeriod], second: list[SaturnPeriod]) -> list[Span]:
    """Where a period of one person and a period of the other run at the same time."""
    found: list[Span] = []
    for a in first:
        for b in second:
            start, end = max(a.start, b.start), min(a.end, b.end)
            if start < end:
                found.append(
                    Span(
                        start,
                        end,
                        from_before=a.from_before and b.from_before,
                        continues=a.continues and b.continues,
                    )
                )
    found.sort(key=lambda span: span.start)
    merged: list[Span] = []
    for span in found:
        last = merged[-1] if merged else None
        if last and span.start <= last.end:
            merged[-1] = Span(
                last.start,
                max(last.end, span.end),
                last.from_before,
                last.continues or span.continues,
            )
        else:
            merged.append(span)
    return merged


def dasha_periods(
    moon_longitude: float, birth: datetime, start: datetime, end: datetime
) -> list[Period]:
    """The main dasha periods that touch the window, each with its sub periods that do.

    Dates are the true ones: a period that began before the window keeps its real start.
    """
    timeline = vimshottari(moon_longitude, birth, levels=2)
    return [
        Period(
            main.lord,
            main.start,
            main.end,
            tuple(sub for sub in main.children if sub.start < end and sub.end > start),
        )
        for main in timeline.periods
        if main.start < end and main.end > start
    ]
