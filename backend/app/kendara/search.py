"""From a kendara drawn on paper back to the births that fit it.

Two passes:

1. Days, from the planet table. A day is kept when every planet, between 00:00 UTC that day and
   the next, passes through its sign (widened by the edge margin). Fast: no ephemeris calls.
2. Minutes, from the ephemeris. Each run of kept days is stepped through every few minutes at the
   birth place, checking every planet, the lagna and, when given, the navamsha boxes. The edges of
   each window are then found to the minute.

A window where everything sits inside its sign is "exact". A window where one or more planets
only fit within the edge margin is "near", and names them: older horoscopes may use another
ayanamsa or the true node (docs/13-old-horoscopes.md).
"""

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml

from app.engine.ephemeris import Ephemeris, julian_day
from app.engine.zodiac import (
    Body,
    nakshatra_index,
    navamsha_sign_index,
    normalize,
    pada,
    sign_index,
)
from app.kendara.table import PlanetTable

RULES_DIR = Path(__file__).resolve().parents[1] / "data" / "rules"
RULE_SET = "kendara_v1"

# The search order for pass 1: the slow planets rule out most days first.
_DAY_ORDER = (
    Body.SATURN,
    Body.RAHU,
    Body.KETU,
    Body.JUPITER,
    Body.MARS,
    Body.SUN,
    Body.VENUS,
    Body.MERCURY,
    Body.MOON,
)

Grade = Literal["exact", "near"]
EXACT, NEAR, OUT = 0, 1, 2


@lru_cache
def load_rules(version: str = RULE_SET) -> dict[str, Any]:
    with (RULES_DIR / f"{version}.yaml").open(encoding="utf-8") as handle:
        rules: dict[str, Any] = yaml.safe_load(handle)
    return rules


@dataclass(frozen=True)
class Drawing:
    """One kendara: the lagna sign and each planet's sign (0 = Mesha). Planets left out are
    not checked."""

    lagna: int
    planets: dict[Body, int]


@dataclass(frozen=True)
class Query:
    rashi: Drawing
    navamsha: Drawing | None = None
    latitude: float = 6.9271  # Colombo
    longitude: float = 79.8612
    timezone: str = "Asia/Colombo"
    start: datetime = datetime(1900, 1, 1, tzinfo=UTC)
    end: datetime = field(default_factory=lambda: datetime.now(UTC))
    nakshatra: int | None = None  # keep only the part of a window with this birth star


@dataclass(frozen=True)
class StarSpan:
    nakshatra: int
    pada: int
    start: datetime
    end: datetime


@dataclass(frozen=True)
class Match:
    start: datetime  # UTC
    end: datetime
    grade: Grade
    near: tuple[Body | Literal["lagna"], ...]  # what only fits within the margin
    stars: tuple[StarSpan, ...]


@dataclass(frozen=True)
class Result:
    matches: list[Match]
    cut_off: bool  # more matches exist than were returned, or the time limit was reached
    candidate_days: int


class ImpossibleChart(ValueError):
    """The drawing cannot happen in the sky. `problems` holds a code for each reason."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


def _sign_distance(a: int, b: int) -> int:
    difference = (a - b) % 12
    return min(difference, 12 - difference)


def check_drawing(drawing: Drawing) -> list[str]:
    """Codes for anything the sky cannot show. Empty when the drawing is possible."""
    planets = drawing.planets
    sun = planets.get(Body.SUN)
    problems = []
    if (
        Body.RAHU in planets
        and Body.KETU in planets
        and (planets[Body.RAHU] - planets[Body.KETU]) % 12 != 6
    ):
        problems.append("nodes_not_opposite")
    # Mercury is never more than 28 degrees from the Sun, and Venus never more than 47.
    if (
        sun is not None
        and Body.MERCURY in planets
        and _sign_distance(sun, planets[Body.MERCURY]) > 1
    ):
        problems.append("mercury_far_from_sun")
    if sun is not None and Body.VENUS in planets and _sign_distance(sun, planets[Body.VENUS]) > 2:
        problems.append("venus_far_from_sun")
    return problems


# ---------- pass 1: days ----------


def _arc_meets(start: float, step: float, low: float, width: float) -> bool:
    """Whether the arc from `start` moving `step` degrees meets the range [low, low + width]."""
    offset = (start - low) % 360.0
    a, b = sorted((offset, offset + step))
    return any(a <= width + shift and b >= shift for shift in (-360.0, 0.0, 360.0))


def candidate_days(table: PlanetTable, query: Query, margin: float) -> list[int]:
    """Day numbers where every planet could be in its sign at some moment of the day."""
    first = max(0, table.day_number(query.start.astimezone(UTC).date()) - 1)
    last = min(table.days - 2, table.day_number(query.end.astimezone(UTC).date()) + 1)
    checks = [
        (table.longitudes[body], sign * 30.0 - margin, 30.0 + 2 * margin)
        for body in _DAY_ORDER
        if (sign := query.rashi.planets.get(body)) is not None
    ]
    days = []
    for day in range(first, last + 1):
        for column, low, width in checks:
            now, after = column[day] / 100, column[day + 1] / 100
            step = (after - now + 180.0) % 360.0 - 180.0
            if not _arc_meets(now, step, low, width):
                break
        else:
            days.append(day)
    return days


def _runs(days: list[int]) -> list[tuple[int, int]]:
    """Consecutive days joined: (first day, last day)."""
    runs: list[tuple[int, int]] = []
    for day in days:
        if runs and day == runs[-1][1] + 1:
            runs[-1] = (runs[-1][0], day)
        else:
            runs.append((day, day))
    return runs


# ---------- pass 2: minutes ----------


def _status(longitude: float, target: int, margin: float, part: Callable[[float], int]) -> int:
    """EXACT when the point is in the target box, NEAR when it is within the margin of it."""
    if part(longitude) == target:
        return EXACT
    if (
        part(normalize(longitude - margin)) == target
        or part(normalize(longitude + margin)) == target
    ):
        return NEAR
    return OUT


@dataclass(frozen=True)
class _Moment:
    worst: int  # the worst status of anything checked
    near: tuple[Body | Literal["lagna"], ...]
    moon: float


def _moment(ephemeris: Ephemeris, query: Query, at: datetime, rules: dict[str, Any]) -> _Moment:
    jd = julian_day(at)
    positions = ephemeris.positions(jd)
    ascendant = ephemeris.ascendant(jd, query.latitude, query.longitude)
    margin, navamsha_margin = rules["sign_margin"], rules["navamsha_margin"]
    statuses: list[tuple[Body | Literal["lagna"], int]] = [
        ("lagna", _status(ascendant, query.rashi.lagna, margin, sign_index))
    ]
    for body, sign in query.rashi.planets.items():
        statuses.append((body, _status(positions[body].longitude, sign, margin, sign_index)))
    if query.navamsha is not None:
        navamsha = query.navamsha
        statuses.append(
            ("lagna", _status(ascendant, navamsha.lagna, navamsha_margin, navamsha_sign_index))
        )
        for body, sign in navamsha.planets.items():
            longitude = positions[body].longitude
            statuses.append((body, _status(longitude, sign, navamsha_margin, navamsha_sign_index)))
    worst = max(status for _, status in statuses)
    near = tuple(dict.fromkeys(name for name, status in statuses if status == NEAR))
    return _Moment(worst, near, positions[Body.MOON].longitude)


def _edge(inside: datetime, outside: datetime, keep: Callable[[datetime], bool]) -> datetime:
    """The last moment still kept, between a kept moment and one that is not, to the minute."""
    while abs(outside - inside) > timedelta(minutes=1):
        middle = inside + (outside - inside) / 2
        if keep(middle):
            inside = middle
        else:
            outside = middle
    return inside.replace(second=0, microsecond=0)


def _star_spans(
    ephemeris: Ephemeris, start: datetime, end: datetime, step: timedelta
) -> list[StarSpan]:
    """The Moon's star and pada through a window, each with when it holds."""

    def star_at(at: datetime) -> tuple[int, int]:
        moon = ephemeris.positions(julian_day(at))[Body.MOON].longitude
        return nakshatra_index(moon), pada(moon)

    spans: list[StarSpan] = []
    current, since, at = star_at(start), start, start
    while at < end:
        following = min(at + step, end)
        star = star_at(following)
        if star != current:
            change = _edge(at, following, lambda t, c=current: star_at(t) == c)  # type: ignore[misc]
            change += timedelta(minutes=1)
            spans.append(StarSpan(current[0], current[1], since, change))
            current, since = star, change
        at = following
    spans.append(StarSpan(current[0], current[1], since, end))
    return spans


def search(
    ephemeris: Ephemeris,
    table: PlanetTable,
    query: Query,
    rules: dict[str, Any] | None = None,
) -> Result:
    """Every window from query.start to query.end where the drawing fits, oldest first."""
    rules = rules or load_rules()
    problems = check_drawing(query.rashi)
    if problems:
        raise ImpossibleChart(problems)
    step = timedelta(minutes=rules["step_minutes"])
    deadline = time.monotonic() + rules["time_limit_seconds"]
    limit = rules["max_matches"]
    days = candidate_days(table, query, rules["sign_margin"])

    def status_at(at: datetime) -> _Moment:
        return _moment(ephemeris, query, at, rules)

    found: list[Match] = []
    cut_off = False
    for first, last in _runs(days):
        if time.monotonic() > deadline or len(found) > limit:
            cut_off = True
            break
        lower = max(table.day_start(first), query.start)
        upper = min(table.day_start(last + 1), query.end)
        # Step through the run, collecting stretches of moments that fit.
        stretch: list[tuple[datetime, _Moment]] = []
        at = lower
        while at <= upper:
            moment = status_at(at)
            if moment.worst <= NEAR:
                stretch.append((at, moment))
            elif stretch:
                found.extend(_windows(stretch, step, status_at, lower, upper))
                stretch = []
            at += step
        if stretch:
            found.extend(_windows(stretch, step, status_at, lower, upper))

    matches = []
    for match in found:
        stars = _star_spans(ephemeris, match.start, match.end, step)
        if query.nakshatra is not None:
            stars = [span for span in stars if span.nakshatra == query.nakshatra]
            if not stars:
                continue
            match = Match(stars[0].start, stars[-1].end, match.grade, match.near, ())
        matches.append(Match(match.start, match.end, match.grade, match.near, tuple(stars)))
    matches.sort(key=lambda m: m.start)
    if len(matches) > limit:
        matches, cut_off = matches[:limit], True
    return Result(matches, cut_off, len(days))


def _windows(
    stretch: list[tuple[datetime, _Moment]],
    step: timedelta,
    status_at: Callable[[datetime], _Moment],
    lower: datetime,
    upper: datetime,
) -> list[Match]:
    """One stretch of fitting moments, one step apart, as windows with edges to the minute.

    Each run of exact moments is an exact window. A stretch with no exact moment at all is one
    near window, naming what only fits within the margin."""

    def window(
        first: datetime, last: datetime, keep: Callable[[datetime], bool]
    ) -> tuple[datetime, datetime]:
        start = first if first <= lower else _edge(first, max(first - step, lower), keep)
        end = last if last >= upper else _edge(last, min(last + step, upper), keep)
        return start, end

    exact_runs: list[list[datetime]] = []
    previous = None
    for at, moment in stretch:
        if moment.worst == EXACT:
            if previous is not None and at - previous == step and exact_runs:
                exact_runs[-1].append(at)
            else:
                exact_runs.append([at])
            previous = at
        else:
            previous = None
    if exact_runs:
        windows = []
        for run in exact_runs:
            start, end = window(run[0], run[-1], lambda t: status_at(t).worst == EXACT)
            windows.append(Match(start, end, "exact", (), ()))
        return windows
    middle = stretch[len(stretch) // 2][1]
    start, end = window(stretch[0][0], stretch[-1][0], lambda t: status_at(t).worst <= NEAR)
    return [Match(start, end, "near", middle.near, ())]
