"""First letters ceremony (akuru kiyaweema): good dates and times for a child's first letters.

Free for now. The access check is in app/api/first_letters.py, so a paid check can go there.

Each day in the search range is dropped first when it cannot pass (an avoided weekday, or no
usable nakatha in daylight). The daylight of the days left is scanned in steps: a moment passes
when every rule holds for the child's birth star. Steps that pass with the same nakatha, thithi
and lagna make a window, whose edges are then found to the minute. Each day gives at most one
window: the best one.

The rules are in rules/first_letters_si_v1.yaml and are provisional (docs/11, section 7).
"""

import zoneinfo
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.engine.ephemeris import Ephemeris, julian_day
from app.engine.panchanga import Place, day_panchanga, nakatha_index
from app.engine.wedding import Moment, moment_at, tara
from app.engine.zodiac import BODIES, NAKSHATRA, RASHI, Body, sign_index

RULES_DIR = Path(__file__).resolve().parents[1] / "data" / "rules"
DEFAULT_RULES = "first_letters_si_v1"


@lru_cache
def load_rules(version: str = DEFAULT_RULES) -> dict[str, Any]:
    with (RULES_DIR / f"{version}.yaml").open(encoding="utf-8") as handle:
        rules: dict[str, Any] = yaml.safe_load(handle)
    return rules


@dataclass(frozen=True)
class Suggestion:
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
    tara: int  # 1 to 9, from the child's birth star
    rahu_kalaya: tuple[datetime, datetime] | None
    cautions: tuple[str, ...]  # weaker points, by code
    score: float


@dataclass(frozen=True)
class _Day:
    day: date
    weekday: str
    sunrise: datetime
    sunset: datetime
    rahu: tuple[datetime, datetime] | None
    noon: datetime  # local noon: mornings end here
    occupied: frozenset[int]  # signs holding a planet other than the Moon, that day


def _day(ephemeris: Ephemeris, day: date, place: Place) -> _Day | None:
    found = day_panchanga(ephemeris, day, place)
    if found.sunrise is None or found.sunset is None:
        return None
    zone = zoneinfo.ZoneInfo(place.timezone)
    until = time.fromisoformat(str(load_rules()["morning_until"]))
    occupied: set[int] = set()
    # The planets other than the Moon move at most a couple of degrees a day. A planet that
    # changes sign during the day counts in both signs.
    for when in (found.sunrise, found.sunset):
        positions = ephemeris.positions(julian_day(when))
        occupied |= {sign_index(positions[b].longitude) for b in BODIES if b != Body.MOON}
    return _Day(
        day=day,
        weekday=found.weekday,
        sunrise=found.sunrise,
        sunset=found.sunset,
        rahu=found.rahu_kalaya,
        noon=datetime.combine(day, until, tzinfo=zone),
        occupied=frozenset(occupied),
    )


def check(moment: Moment, when: datetime, day: _Day, star: int) -> tuple[str, ...] | None:
    """None when the moment fails a rule; otherwise its weaker points (cautions)."""
    rules = load_rules()
    if day.weekday in rules["avoid_weekday"]:
        return None
    if moment.nakatha not in rules["nakatha"]:
        return None
    if moment.thithi in rules["avoid_thithi"] or moment.karana in rules["avoid_karana"]:
        return None
    if tara(star, NAKSHATRA.index(moment.nakatha)) in rules["avoid_tara"]:
        return None
    if RASHI[moment.lagna] not in rules["lagna"]:
        return None
    eighth = (moment.lagna + 7) % 12
    if rules["eighth_house_empty"] and (eighth in day.occupied or eighth == moment.moon_sign):
        return None
    if rules["avoid_rahu_kalaya"] and day.rahu and day.rahu[0] <= when < day.rahu[1]:
        return None
    cautions = []
    if day.weekday in rules["weak_weekday"]:
        cautions.append("weekday_weak")
    if moment.thithi in rules["weak_thithi"]:
        cautions.append("thithi_weak")
    if moment.yoga in rules["weak_yoga"]:
        cautions.append("yoga_weak")
    if rules["prefer_bright_half"] and moment.thithi > 15:
        cautions.append("dark_half")
    return tuple(cautions)


def _key(moment: Moment, cautions: tuple[str, ...]) -> tuple[object, ...]:
    """Steps with the same key belong to one window."""
    return (moment.nakatha, moment.pada, moment.thithi, moment.lagna, moment.moon_sign, cautions)


def _edge(holds: Callable[[datetime], bool], inside: datetime, outside: datetime) -> datetime:
    """The last whole minute inside the window, between a step in and one out."""
    while abs(outside - inside) > timedelta(minutes=1):
        middle = (inside + (outside - inside) / 2).replace(second=0, microsecond=0)
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
    day: _Day,
    star: int,
    steps: list[tuple[datetime, Moment]],
) -> Suggestion | None:
    rules = load_rules()
    windows: list[tuple[int, int, tuple[object, ...], tuple[str, ...]]] = []
    run: tuple[int, tuple[object, ...], tuple[str, ...]] | None = None
    for index, (when, moment) in enumerate(steps):
        cautions = check(moment, when, day, star)
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

        def holds(when: datetime, key: tuple[object, ...] = key) -> bool:
            if not day.sunrise <= when < day.sunset:
                return False
            moment = moment_at(ephemeris, when, place)
            found = check(moment, when, day, star)
            return found is not None and _key(moment, found) == key

        start, end = steps[first][0], steps[last][0]
        if first > 0:
            start = _edge(holds, start, steps[first - 1][0])
        end = _edge(holds, end, steps[last + 1][0] if last < len(steps) - 1 else day.sunset)
        end = min(end + timedelta(minutes=1), day.sunset)  # to the end of its last minute
        minutes = (end - start).total_seconds() / 60
        if minutes < rules["min_window_minutes"]:
            continue
        moment = steps[first][1]
        morning = 1 if start < day.noon else 0
        score = 10 - 2 * len(cautions) + morning + min(minutes, 120) / 120
        candidate = Suggestion(
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
            tara=tara(star, NAKSHATRA.index(moment.nakatha)),
            rahu_kalaya=day.rahu,
            cautions=cautions,
            score=score,
        )
        if best is None or candidate.score > best.score:
            best = candidate
    return best


def _may_pass(ephemeris: Ephemeris, day: _Day, star: int) -> bool:
    """A cheap check before the step by step scan: the weekday, and a usable star in daylight."""
    rules = load_rules()
    if day.weekday in rules["avoid_weekday"]:
        return False
    for when in (day.sunrise, day.sunrise + (day.sunset - day.sunrise) / 2, day.sunset):
        _, moon = ephemeris.sun_moon(julian_day(when))
        found = nakatha_index(moon)
        if NAKSHATRA[found] in rules["nakatha"] and tara(star, found) not in rules["avoid_tara"]:
            return True
    return False


def find_dates(
    ephemeris: Ephemeris, place: Place, first: date, days: int, star: int
) -> list[Suggestion]:
    """Good dates and times from `first` for `days` days, for a child born in `star` (0 to 26)."""
    rules = load_rules()
    if days > 31 * max(rules["search_months"]):
        raise ValueError("search range too long")
    step = timedelta(minutes=int(rules["step_minutes"]))
    found: list[Suggestion] = []
    for offset in range(days):
        day = _day(ephemeris, first + timedelta(days=offset), place)
        if day is None or not _may_pass(ephemeris, day, star):
            continue
        steps = []
        when = day.sunrise
        while when < day.sunset:
            steps.append((when, moment_at(ephemeris, when, place)))
            when += step
        best = _best_window(ephemeris, place, day, star, steps)
        if best is not None:
            found.append(best)
    return _spread(found)


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


def age_on(birth: date, day: date) -> tuple[int, int]:
    """Whole years and months from the birth date to the day."""
    months = (day.year - birth.year) * 12 + day.month - birth.month - (day.day < birth.day)
    return months // 12, months % 12
