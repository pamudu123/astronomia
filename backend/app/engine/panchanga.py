"""The Sinhala panchanga: sunrise, the five parts of the day and Rahu kalaya, for any place.

The five parts are the weekday (counted from sunrise), thithi, nakatha (the Moon's star),
yoga and karana. Thithi and karana come from how far the Moon is ahead of the Sun, yoga
from the sum of their longitudes, nakatha from the Moon alone. Each one's start and end is
found to the minute by halving the gap, as transits.sign_changes() does for signs.

The rules are in app/data/rules/panchanga_v1.yaml and are provisional (docs/11).
"""

import math
import zoneinfo
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import swisseph as swe
import yaml

from app.engine.ephemeris import Ephemeris, julian_day
from app.engine.zodiac import DEGREES_PER_NAKSHATRA, NAKSHATRA, normalize

RULES_DIR = Path(__file__).resolve().parents[1] / "data" / "rules"
DEFAULT_RULES = "panchanga_v1"

WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")

_HOUR = 1 / 24
_PRECISION = 1 / 1440 / 4  # 15 seconds, so a time rounds to the right minute


@lru_cache
def load_rules(version: str = DEFAULT_RULES) -> dict[str, Any]:
    with (RULES_DIR / f"{version}.yaml").open(encoding="utf-8") as handle:
        rules: dict[str, Any] = yaml.safe_load(handle)
    return rules


# ---------- the five parts at one moment ----------


def thithi_index(sun: float, moon: float) -> int:
    """0 to 29. 0 to 14 are the bright half; 14 is the full moon, 29 the new moon."""
    degrees = float(load_rules()["thithi_degrees"])
    return math.floor(normalize(moon - sun) / degrees) % 30


def karana_index(sun: float, moon: float) -> int:
    """0 to 59, two for each thithi."""
    degrees = float(load_rules()["karana_degrees"])
    return math.floor(normalize(moon - sun) / degrees) % 60


def yoga_index(sun: float, moon: float) -> int:
    """0 to 26."""
    parts = int(load_rules()["yoga_parts"])
    return math.floor(normalize(sun + moon) / (360.0 / parts)) % parts


def nakatha_index(moon: float) -> int:
    return math.floor(normalize(moon) / DEGREES_PER_NAKSHATRA) % 27


THITHI_KEYS: tuple[str, ...] = tuple(
    [f"shukla_{n}" for n in range(1, 15)]
    + ["purnima"]
    + [f"krishna_{n}" for n in range(1, 15)]
    + ["amavasya"]
)
YOGA_KEYS: tuple[str, ...] = (
    "vishkambha", "priti", "ayushman", "saubhagya", "shobhana", "atiganda", "sukarma",
    "dhriti", "shula", "ganda", "vriddhi", "dhruva", "vyaghata", "harshana", "vajra",
    "siddhi", "vyatipata", "variyan", "parigha", "shiva", "siddha", "sadhya", "shubha",
    "shukla", "brahma", "indra", "vaidhriti",
)  # fmt: skip


def karana_key(index: int) -> str:
    rules = load_rules()
    if index == 0:
        return str(rules["karana_first"])
    if index >= 57:
        return str(rules["karana_last"][index - 57])
    return str(rules["karana_moving"][(index - 1) % 7])


# ---------- when each part begins and ends ----------


@dataclass(frozen=True)
class Span:
    """One thithi, nakatha, yoga or karana, with its start and end (UTC, to the minute)."""

    key: str
    number: int  # 1 based, as almanacs count
    start: datetime
    end: datetime


def _exact(jd: float) -> datetime:
    year, month, day, hours = swe.revjul(jd, swe.GREG_CAL)
    return datetime(year, month, day, tzinfo=UTC) + timedelta(hours=hours)


def _floor(moment: datetime) -> datetime:
    return moment.replace(second=0, microsecond=0)


def _ceil(moment: datetime) -> datetime:
    floored = _floor(moment)
    return floored if floored == moment else floored + timedelta(minutes=1)


def _change(jd: float) -> datetime:
    """A change to the minute, as Sri Lankan almanacs print it: the first whole minute
    at which the new part holds. porondam.lk agrees with this in every case checked."""
    return _ceil(_exact(jd))


def _sun_event(jd: float) -> datetime:
    """Sunrise and sunset with the seconds dropped, as porondam.lk and lankahandahana.com
    print them (39 of 40 sunrises checked)."""
    return _floor(_exact(jd))


def _edge(index_at: Callable[[float], int], inside: float, outside: float) -> float:
    """The boundary between a moment inside a part and one outside it, by halving the gap."""
    current = index_at(inside)
    while abs(outside - inside) > _PRECISION:
        middle = (inside + outside) / 2
        if index_at(middle) == current:
            inside = middle
        else:
            outside = middle
    return (inside + outside) / 2


def _span_at(index_at: Callable[[float], int], jd: float) -> tuple[int, float, float]:
    """The part holding jd: its index and the Julian days it starts and ends."""
    current = index_at(jd)
    before = jd - _HOUR
    while index_at(before) == current:
        before -= _HOUR
    after = jd + _HOUR
    while index_at(after) == current:
        after += _HOUR
    return current, _edge(index_at, jd, before), _edge(index_at, jd, after)


def spans_between(
    ephemeris: Ephemeris, part: str, start: datetime, end: datetime
) -> tuple[Span, ...]:
    """Every thithi, nakatha, yoga or karana that touches [start, end), in order."""

    def index_at(jd: float) -> int:
        sun, moon = ephemeris.sun_moon(jd)
        if part == "thithi":
            return thithi_index(sun, moon)
        if part == "karana":
            return karana_index(sun, moon)
        if part == "yoga":
            return yoga_index(sun, moon)
        if part == "nakatha":
            return nakatha_index(moon)
        raise ValueError(f"unknown part: {part}")

    def key(index: int) -> str:
        if part == "thithi":
            return THITHI_KEYS[index]
        if part == "karana":
            return karana_key(index)
        if part == "yoga":
            return YOGA_KEYS[index]
        return NAKSHATRA[index]

    spans: list[Span] = []
    jd, last = julian_day(start), julian_day(end)
    while jd < last:
        index, opens, closes = _span_at(index_at, jd)
        spans.append(Span(key(index), index + 1, _change(opens), _change(closes)))
        jd = closes + _PRECISION
    return tuple(spans)


# ---------- one day at one place ----------


@dataclass(frozen=True)
class Place:
    latitude: float
    longitude: float
    timezone: str


@dataclass(frozen=True)
class DayPanchanga:
    """The Sinhala day that begins at sunrise on `day` at one place."""

    day: date  # the civil date of that sunrise
    place: Place
    sunrise: datetime | None  # UTC; None where the Sun does not rise that day
    sunset: datetime | None
    next_sunrise: datetime | None
    weekday: str
    rahu_kalaya: tuple[datetime, datetime] | None
    thithi: tuple[Span, ...]  # every part touching sunrise to the next sunrise
    nakatha: tuple[Span, ...]
    yoga: tuple[Span, ...]
    karana: tuple[Span, ...]
    rule_set: str
    provisional: bool


def _local_midnight(day: date, timezone: str) -> datetime:
    return datetime.combine(day, time(0, 0), tzinfo=zoneinfo.ZoneInfo(timezone))


def _rise(ephemeris: Ephemeris, after: datetime, place: Place) -> datetime | None:
    jd = ephemeris.sunrise(julian_day(after), place.latitude, place.longitude)
    return None if jd is None else _sun_event(jd)


def rahu_kalaya(sunrise: datetime, sunset: datetime, weekday: str) -> tuple[datetime, datetime]:
    """Daylight in eight parts; the part for the weekday.

    Sri Lankan sites work in whole minutes: each part is the daylight minutes divided by
    eight and cut down to a whole minute, counted from sunrise (docs/11). The rule file can
    choose the exact split instead.
    """
    rules = load_rules()
    parts = int(rules["rahu_kalaya_parts"])
    part = int(rules["rahu_kalaya_part"][weekday])
    if rules["rahu_kalaya_minutes"] == "whole":
        minutes = int((sunset - sunrise).total_seconds() // 60) // parts
        length = timedelta(minutes=minutes)
    else:
        length = (sunset - sunrise) / parts
    start = sunrise + length * (part - 1)
    return _floor(start), _floor(start + length)


_DAYS: dict[tuple[int, date, Place], DayPanchanga] = {}
_DAYS_KEPT = 50_000  # two years of days for a few dozen places


def day_panchanga(ephemeris: Ephemeris, day: date, place: Place) -> DayPanchanga:
    """The panchanga for the day that begins at sunrise on this date. Worked out once."""
    cache_key = (id(ephemeris), day, place)
    if cache_key in _DAYS:
        return _DAYS[cache_key]
    if len(_DAYS) >= _DAYS_KEPT:
        _DAYS.clear()

    rules = load_rules()
    midnight = _local_midnight(day, place.timezone)
    sunrise = _rise(ephemeris, midnight, place)
    next_midnight = _local_midnight(day + timedelta(days=1), place.timezone)
    next_sunrise = _rise(ephemeris, next_midnight, place)
    sunset = None
    if sunrise is not None:
        jd = ephemeris.sunset(julian_day(sunrise), place.latitude, place.longitude)
        sunset = None if jd is None else _sun_event(jd)
    # Where the Sun does not rise (near the poles), the day runs midnight to midnight.
    opens = sunrise or midnight.astimezone(UTC)
    closes = next_sunrise or next_midnight.astimezone(UTC)
    weekday = WEEKDAYS[day.weekday()]
    result = DayPanchanga(
        day=day,
        place=place,
        sunrise=sunrise,
        sunset=sunset,
        next_sunrise=next_sunrise,
        weekday=weekday,
        rahu_kalaya=rahu_kalaya(sunrise, sunset, weekday) if sunrise and sunset else None,
        thithi=spans_between(ephemeris, "thithi", opens, closes),
        nakatha=spans_between(ephemeris, "nakatha", opens, closes),
        yoga=spans_between(ephemeris, "yoga", opens, closes),
        karana=spans_between(ephemeris, "karana", opens, closes),
        rule_set=str(rules["version"]),
        provisional=bool(rules["provisional"]),
    )
    _DAYS[cache_key] = result
    return result


def sinhala_day(ephemeris: Ephemeris, moment: datetime, place: Place) -> date:
    """The date whose sunrise opened the Sinhala day holding this moment."""
    local = moment.astimezone(zoneinfo.ZoneInfo(place.timezone))
    today = day_panchanga(ephemeris, local.date(), place)
    if today.sunrise is not None and moment < today.sunrise:
        return local.date() - timedelta(days=1)
    return local.date()
