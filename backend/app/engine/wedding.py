"""Wedding nakath finder: good dates and times for the engagement, the poruwa and the homecoming.

A paid feature (docs/07), open to everyone for now. The access check is in app/api/wedding.py.

For each day in the search range, the day is first dropped when it cannot pass (an avoided
weekday, no usable nakatha in daylight, Venus or Jupiter combust). The daylight of the days
left is scanned in steps; a moment passes when every rule holds for both people. Steps that
pass with the same nakatha, thithi and lagna make a window, whose edges are then found to
the minute. Each day gives at most one window per ceremony: the best one.

The rules are in rules/wedding_si_v1.yaml and are provisional (docs/11).
"""

import math
import zoneinfo
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.engine.ephemeris import Ephemeris, julian_day
from app.engine.panchanga import (
    WEEKDAYS,
    YOGA_KEYS,
    Place,
    karana_index,
    karana_key,
    nakatha_index,
    rahu_kalaya,
    thithi_index,
    yoga_index,
)
from app.engine.zodiac import DEGREES_PER_PADA, NAKSHATRA, Body, sign_index, whole_sign_house

RULES_DIR = Path(__file__).resolve().parents[1] / "data" / "rules"
DEFAULT_RULES = "wedding_si_v1"
CEREMONIES = ("engagement", "poruwa", "homecoming")
TARA_NAMES = (
    "janma", "sampat", "vipat", "kshema", "pratyari", "sadhaka", "naidhana", "mitra",
    "parama_mitra",
)  # fmt: skip


@lru_cache
def load_rules(version: str = DEFAULT_RULES) -> dict[str, Any]:
    with (RULES_DIR / f"{version}.yaml").open(encoding="utf-8") as handle:
        rules: dict[str, Any] = yaml.safe_load(handle)
    return rules


@dataclass(frozen=True)
class Person:
    """What the rules need from a person: the birth star (0 to 26) and Moon sign (0 to 11)."""

    star: int
    moon_sign: int


def tara(birth_star: int, day_star: int) -> int:
    """1 to 9: the day's star counted from the birth star, in nines."""
    return (day_star - birth_star) % 27 % 9 + 1


@dataclass(frozen=True)
class Moment:
    """Everything the rules look at, at one moment."""

    thithi: int  # 1 to 30
    nakatha: str
    pada: int
    karana: str
    yoga: str
    moon_sign: int
    lagna: int


@dataclass(frozen=True)
class Suggestion:
    ceremony: str
    day: date
    start: datetime  # UTC, to the minute
    end: datetime
    weekday: str
    thithi: int
    nakatha: str
    pada: int
    karana: str
    yoga: str
    lagna: int
    moon_sign: int
    taras: tuple[int, int]  # bride, groom
    moon_houses: tuple[int, int]  # the Moon's sign counted from each person's Moon sign
    rahu_kalaya: tuple[datetime, datetime] | None
    seventh_house_free: bool  # checked for this ceremony
    cautions: tuple[str, ...]  # weaker points, by code
    score: float


@dataclass(frozen=True)
class _Day:
    day: date
    weekday: str
    sunrise: datetime
    sunset: datetime
    rahu: tuple[datetime, datetime]
    malefic_signs: frozenset[int]


def _moment(ephemeris: Ephemeris, when: datetime, place: Place) -> Moment:
    jd = julian_day(when)
    sun, moon = ephemeris.sun_moon(jd)
    return Moment(
        thithi=thithi_index(sun, moon) + 1,
        nakatha=NAKSHATRA[nakatha_index(moon)],
        pada=math.floor(moon / DEGREES_PER_PADA) % 4 + 1,
        karana=karana_key(karana_index(sun, moon)),
        yoga=YOGA_KEYS[yoga_index(sun, moon)],
        moon_sign=sign_index(moon),
        lagna=sign_index(ephemeris.ascendant(jd, place.latitude, place.longitude)),
    )


def _combust(ephemeris: Ephemeris, when: datetime) -> bool:
    orbs = load_rules()["common"]["combust_degrees"]
    positions = ephemeris.positions(julian_day(when))
    sun = positions[Body.SUN].longitude

    def distance(body: Body) -> float:
        gap = abs(positions[body].longitude - sun) % 360
        return min(gap, 360 - gap)

    venus = positions[Body.VENUS]
    venus_orb = float(orbs["venus_retrograde"] if venus.speed < 0 else orbs["venus"])
    return distance(Body.VENUS) < venus_orb or distance(Body.JUPITER) < float(orbs["jupiter"])


def _sun_event(ephemeris: Ephemeris, when: datetime, place: Place, rise: bool) -> datetime | None:
    method = ephemeris.sunrise if rise else ephemeris.sunset
    jd = method(julian_day(when), place.latitude, place.longitude)
    if jd is None:
        return None
    from app.engine.panchanga import _exact, _floor  # the panchanga's minute rules

    return _floor(_exact(jd))


def _day(ephemeris: Ephemeris, day: date, place: Place) -> _Day | None:
    """The day's daylight, Rahu kalaya and where the malefics are, or None near the poles."""
    zone = zoneinfo.ZoneInfo(place.timezone)
    midnight = datetime.combine(day, time(0, 0), tzinfo=zone)
    sunrise = _sun_event(ephemeris, midnight, place, rise=True)
    if sunrise is None:
        return None
    sunset = _sun_event(ephemeris, sunrise, place, rise=False)
    if sunset is None:
        return None
    weekday = WEEKDAYS[day.weekday()]
    noon = sunrise + (sunset - sunrise) / 2
    positions = ephemeris.positions(julian_day(noon))
    malefics = frozenset(sign_index(positions[Body(b)].longitude) for b in load_rules()["malefics"])
    return _Day(day, weekday, sunrise, sunset, rahu_kalaya(sunrise, sunset, weekday), malefics)


def _check(
    ceremony: str, moment: Moment, when: datetime, day: _Day, bride: Person, groom: Person
) -> tuple[str, ...] | None:
    """None when the moment fails a rule; otherwise its weaker points (cautions)."""
    rules = load_rules()
    common, own = rules["common"], rules["ceremonies"][ceremony]
    if moment.nakatha not in own["nakatha"]:
        return None
    if moment.pada in own["avoid_padas"].get(moment.nakatha, []):
        return None
    if moment.thithi in common["avoid_thithi"] or moment.karana in common["avoid_karana"]:
        return None
    if common["avoid_rahu_kalaya"] and day.rahu[0] <= when < day.rahu[1]:
        return None
    star = NAKSHATRA.index(moment.nakatha)
    for person in (bride, groom):
        if tara(person.star, star) in common["avoid_tara"]:
            return None
        if whole_sign_house(moment.moon_sign, person.moon_sign) in common["avoid_moon_house"]:
            return None
    if own["seventh_house_free"] and (moment.lagna + 6) % 12 in day.malefic_signs:
        return None
    cautions = []
    if day.weekday in own["weak_weekday"]:
        cautions.append("weekday_weak")
    if moment.thithi in common["weak_thithi"]:
        cautions.append("thithi_weak")
    if moment.yoga in common["weak_yoga"]:
        cautions.append("yoga_weak")
    if any(tara(p.star, star) in common["weak_tara"] for p in (bride, groom)):
        cautions.append("tara_janma")
    if own["prefer_bright_half"] and moment.thithi > 15:
        cautions.append("dark_half")
    return tuple(cautions)


def _key(moment: Moment, cautions: tuple[str, ...]) -> tuple[object, ...]:
    """Steps with the same key belong to one window."""
    return (moment.nakatha, moment.pada, moment.thithi, moment.lagna, moment.moon_sign, cautions)


def _edge(
    ephemeris: Ephemeris,
    place: Place,
    ceremony: str,
    day: _Day,
    people: tuple[Person, Person],
    key: tuple[object, ...],
    inside: datetime,
    outside: datetime,
) -> datetime:
    """The first (or last) whole minute inside the window, between a step in and one out."""

    def holds(when: datetime) -> bool:
        moment = _moment(ephemeris, when, place)
        cautions = _check(ceremony, moment, when, day, *people)
        return cautions is not None and _key(moment, cautions) == key

    while abs(outside - inside) > timedelta(minutes=1):
        middle = inside + (outside - inside) / 2
        middle = middle.replace(second=0, microsecond=0)
        if middle in (inside, outside):
            break
        if holds(middle):
            inside = middle
        else:
            outside = middle
    return inside


def _best_window(
    ephemeris: Ephemeris,
    place: Place,
    ceremony: str,
    day: _Day,
    bride: Person,
    groom: Person,
    steps: list[tuple[datetime, Moment]],
) -> Suggestion | None:
    rules = load_rules()
    windows: list[tuple[int, int, tuple[object, ...], tuple[str, ...]]] = []
    run: tuple[int, tuple[object, ...], tuple[str, ...]] | None = None
    for index, (when, moment) in enumerate(steps):
        cautions = _check(ceremony, moment, when, day, bride, groom)
        key = None if cautions is None else _key(moment, cautions)
        if run is not None and key != run[1]:
            windows.append((run[0], index - 1, run[1], run[2]))
            run = None
        if key is not None and cautions is not None and run is None:
            run = (index, key, cautions)
    if run is not None:
        windows.append((run[0], len(steps) - 1, run[1], run[2]))

    best: Suggestion | None = None
    for first, last, key, cautions in windows:
        start, end = steps[first][0], steps[last][0]
        if first > 0:
            start = _edge(
                ephemeris, place, ceremony, day, (bride, groom), key, start, steps[first - 1][0]
            )
        if last < len(steps) - 1:
            end = _edge(
                ephemeris, place, ceremony, day, (bride, groom), key, end, steps[last + 1][0]
            )
        end = min(
            end + timedelta(minutes=1), day.sunset
        )  # the window runs to the end of its last minute
        minutes = (end - start).total_seconds() / 60
        if minutes < rules["min_window_minutes"]:
            continue
        moment = steps[first][1]
        star = NAKSHATRA.index(moment.nakatha)
        score = 10 - 2 * len(cautions) + min(minutes, 120) / 60
        candidate = Suggestion(
            ceremony=ceremony,
            day=day.day,
            start=start,
            end=end,
            weekday=day.weekday,
            thithi=moment.thithi,
            nakatha=moment.nakatha,
            pada=moment.pada,
            karana=moment.karana,
            yoga=moment.yoga,
            lagna=moment.lagna,
            moon_sign=moment.moon_sign,
            taras=(tara(bride.star, star), tara(groom.star, star)),
            moon_houses=(
                whole_sign_house(moment.moon_sign, bride.moon_sign),
                whole_sign_house(moment.moon_sign, groom.moon_sign),
            ),
            rahu_kalaya=day.rahu,
            seventh_house_free=bool(rules["ceremonies"][ceremony]["seventh_house_free"]),
            cautions=cautions,
            score=score,
        )
        if best is None or candidate.score > best.score:
            best = candidate
    return best


def _may_pass(ephemeris: Ephemeris, day: _Day, ceremonies: tuple[str, ...]) -> tuple[str, ...]:
    """The ceremonies this day could pass, by cheap checks, before the step by step scan."""
    rules = load_rules()["ceremonies"]
    open_ = [c for c in ceremonies if day.weekday not in rules[c]["avoid_weekday"]]
    if not open_:
        return ()
    stars = set()
    for when in (day.sunrise, day.sunrise + (day.sunset - day.sunrise) / 2, day.sunset):
        _, moon = ephemeris.sun_moon(julian_day(when))
        stars.add(NAKSHATRA[nakatha_index(moon)])
    open_ = [c for c in open_ if stars & set(rules[c]["nakatha"])]
    if not open_ or _combust(ephemeris, day.sunrise):
        return ()
    return tuple(open_)


def find_dates(
    ephemeris: Ephemeris,
    place: Place,
    first: date,
    days: int,
    ceremonies: tuple[str, ...],
    bride: Person,
    groom: Person,
) -> dict[str, list[Suggestion]]:
    """The best dates and times for each ceremony, from `first` for `days` days."""
    rules = load_rules()
    if days > 31 * max(rules["search_months"]):
        raise ValueError("search range too long")
    step = timedelta(minutes=int(rules["step_minutes"]))
    found: dict[str, list[Suggestion]] = {c: [] for c in ceremonies}
    for offset in range(days):
        day = _day(ephemeris, first + timedelta(days=offset), place)
        if day is None:
            continue
        chosen = _may_pass(ephemeris, day, ceremonies)
        if not chosen:
            continue
        steps = []
        when = day.sunrise
        while when < day.sunset:
            steps.append((when, _moment(ephemeris, when, place)))
            when += step
        for ceremony in chosen:
            best = _best_window(ephemeris, place, ceremony, day, bride, groom, steps)
            if best is not None:
                found[ceremony].append(best)
    return {ceremony: _spread(found[ceremony]) for ceremony in ceremonies}


def _spread(candidates: list[Suggestion]) -> list[Suggestion]:
    """The best day in each week, then the best of those, in date order."""
    weekly: dict[tuple[int, int], Suggestion] = {}
    for suggestion in candidates:
        week = suggestion.day.isocalendar()[:2]
        kept = weekly.get(week)
        if kept is None or suggestion.score > kept.score:
            weekly[week] = suggestion
    count = int(load_rules()["suggestions"])
    best = sorted(weekly.values(), key=lambda s: (-s.score, s.day))[:count]
    return sorted(best, key=lambda s: s.day)


def to_utc(day: date, zone: str) -> datetime:
    return datetime.combine(day, time(0, 0), tzinfo=zoneinfo.ZoneInfo(zone)).astimezone(UTC)
