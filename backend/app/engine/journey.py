"""The life road: a hundred years of dasha periods, with how easy or hard each stretch is drawn.

Facts first: the dasha periods, Saturn's Erashtaka and Jupiter's returns to its birth sign are
dates from the ephemeris. The "quality" number that shapes the road is a rule set
(app/data/rules/journey_v1.yaml) that is provisional until an astrologer confirms it.

Every road runs to the same length, so nothing here says how long a life is.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml

from app.engine.chart import Chart
from app.engine.dasha import YEAR_DAYS, vimshottari
from app.engine.ephemeris import Ephemeris, julian_day
from app.engine.transits import SignChange
from app.engine.zodiac import RASHI, RASHI_LORD, Body, sign_index, whole_sign_house

RULES_DIR = Path(__file__).resolve().parents[1] / "data" / "rules"

Tone = Literal["good", "mixed", "careful"]

# Saturn and Jupiter stay in a sign for months. A thirty day step finds every stay that matters
# on a road a hundred years long, and passes over a backward step of a few days. Dates are
# good to a few hours, which is far finer than the road is drawn.
_STEP = timedelta(days=30)
_PRECISION = timedelta(hours=6)
_ERASHTAKA_HOUSES = (12, 1, 2)
MONTH_DAYS = YEAR_DAYS / 12


@lru_cache
def load_rules(version: str = "journey_v1") -> dict[str, Any]:
    with (RULES_DIR / f"{version}.yaml").open(encoding="utf-8") as handle:
        rules: dict[str, Any] = yaml.safe_load(handle)
    return rules


@dataclass(frozen=True)
class Span:
    start: datetime
    end: datetime


@dataclass(frozen=True)
class SubPeriod:
    lord: Body
    start: datetime
    end: datetime
    house: int  # the lord's house in the birth chart
    tone: Tone


@dataclass(frozen=True)
class MainPeriod:
    lord: Body
    start: datetime  # the true start, which is before birth for the first period
    end: datetime
    house: int
    tone: Tone
    subs: tuple[SubPeriod, ...]


@dataclass(frozen=True)
class Journey:
    birth: datetime
    end: datetime
    periods: tuple[MainPeriod, ...]
    erashtaka: tuple[Span, ...]
    guru_returns: tuple[Span, ...]
    quality: tuple[float, ...]  # one number a month from birth, -1 (hard) to 1 (easy)
    rule_set: str
    provisional: bool
    # The same seven and a half years counted from the rising sign (lagna erashtaka), for the
    # written reading. The road's quality follows the Moon's alone, as before.
    erashtaka_lagna: tuple[Span, ...] = ()


_SLOW = (Body.SATURN, Body.JUPITER)


def _signs(ephemeris: Ephemeris, moment: datetime) -> dict[Body, int]:
    """The signs of Saturn and Jupiter only, which is much quicker than every planet."""
    found = ephemeris.longitudes(julian_day(moment), _SLOW)
    return {body: sign_index(longitude) for body, longitude in found.items()}


def _crossing(
    ephemeris: Ephemeris, body: Body, before: datetime, after: datetime, old_sign: int
) -> datetime:
    """When the planet leaves old_sign between two moments, to within a few hours."""
    while after - before > _PRECISION:
        middle = before + (after - before) / 2
        if _signs(ephemeris, middle)[body] == old_sign:
            before = middle
        else:
            after = middle
    return after


@lru_cache(maxsize=256)
def _year_changes(ephemeris: Ephemeris, year: int) -> tuple[SignChange, ...]:
    """Saturn's and Jupiter's sign changes in one calendar year. The same for everyone."""
    moment = datetime(year, 1, 1, tzinfo=UTC)
    end = datetime(year + 1, 1, 1, tzinfo=UTC)
    changes: list[SignChange] = []
    signs = _signs(ephemeris, moment)
    while moment < end:
        following = min(moment + _STEP, end)
        next_signs = _signs(ephemeris, following)
        for body in _SLOW:
            if next_signs[body] != signs[body]:
                when = _crossing(ephemeris, body, moment, following, signs[body])
                changes.append(SignChange(body, when, signs[body], next_signs[body]))
        moment, signs = following, next_signs
    return tuple(sorted(changes, key=lambda change: change.moment))


def stays(
    ephemeris: Ephemeris, body: Body, start: datetime, end: datetime
) -> list[tuple[int, Span]]:
    """The signs one slow planet passes through from start to end, in order."""
    found: list[tuple[int, Span]] = []
    sign, since = _signs(ephemeris, start)[body], start
    for year in range(start.year, end.year + 1):
        for change in _year_changes(ephemeris, year):
            if change.body is not body or not start < change.moment < end:
                continue
            found.append((sign, Span(since, change.moment)))
            sign, since = change.to_sign, change.moment
    found.append((sign, Span(since, end)))
    return found


def _joined(spans: list[Span], gap: timedelta) -> list[Span]:
    """Spans in time order, with those closer together than the gap made one."""
    joined: list[Span] = []
    for span in spans:
        if joined and span.start - joined[-1].end <= gap:
            joined[-1] = Span(joined[-1].start, span.end)
        else:
            joined.append(span)
    return joined


def strength(chart: Chart, body: Body, rules: dict[str, Any]) -> float:
    """How a planet leans as a period lord in this chart: its nature, dignity and house."""
    placement = chart.planets[body]
    sign = RASHI[placement.point.sign]
    dignity, weights = rules["dignity"], rules["dignity"]["weights"]
    value = float(rules["nature"][body.value])
    if dignity["exalted"].get(body.value) == sign:
        value += weights["exalted"]
    elif dignity["debilitated"].get(body.value) == sign:
        value += weights["debilitated"]
    elif RASHI_LORD[placement.point.sign] is body:
        value += weights["own"]
    houses = rules["houses"]
    if placement.house in houses["good"]:
        value += houses["weights"]["good"]
    elif placement.house in houses["hard"]:
        value += houses["weights"]["hard"]
    return value


def _tone(value: float, rules: dict[str, Any]) -> Tone:
    if value >= rules["tone"]["good"]:
        return "good"
    return "careful" if value <= rules["tone"]["careful"] else "mixed"


def _inside(spans: tuple[Span, ...], moment: datetime) -> bool:
    return any(span.start <= moment < span.end for span in spans)


def life_journey(ephemeris: Ephemeris, chart: Chart, version: str = "journey_v1") -> Journey:
    rules = load_rules(version)
    weights = rules["weights"]
    birth = chart.utc
    end = birth + timedelta(days=rules["years"] * YEAR_DAYS)
    lean = {body: strength(chart, body, rules) for body in chart.planets}

    def blend(main: Body, sub: Body) -> float:
        return float(weights["main"] * lean[main] + weights["sub"] * lean[sub])

    timeline = vimshottari(chart.moon.longitude, birth, levels=2)
    periods = tuple(
        MainPeriod(
            lord=main.lord,
            start=main.start,
            end=main.end,
            house=chart.planets[main.lord].house,
            tone=_tone(lean[main.lord], rules),
            subs=tuple(
                SubPeriod(
                    lord=sub.lord,
                    start=sub.start,
                    end=sub.end,
                    house=chart.planets[sub.lord].house,
                    tone=_tone(blend(main.lord, sub.lord), rules),
                )
                for sub in main.children
                if sub.end > birth and sub.start < end
            ),
        )
        for main in timeline.periods
        if main.end > birth and main.start < end
    )

    join = rules["join_days"]
    saturn = list(stays(ephemeris, Body.SATURN, birth, end))

    def erashtaka_from(sign_from: int) -> tuple[Span, ...]:
        return tuple(
            _joined(
                [
                    span
                    for sign, span in saturn
                    if whole_sign_house(sign, sign_from) in _ERASHTAKA_HOUSES
                ],
                timedelta(days=join["erashtaka"]),
            )
        )

    erashtaka = erashtaka_from(chart.moon.sign)
    erashtaka_lagna = erashtaka_from(chart.lagna.sign)
    jupiter_sign = chart.planets[Body.JUPITER].point.sign
    guru_returns = tuple(
        span
        for span in _joined(
            [
                span
                for sign, span in stays(ephemeris, Body.JUPITER, birth, end)
                if sign == jupiter_sign
            ],
            timedelta(days=join["guru_return"]),
        )
        if span.start > birth  # the stay Jupiter was in at birth is not a return
    )

    quality: list[float] = []
    subs = [(main.lord, sub) for main in periods for sub in main.subs]
    at = 0
    for month in range(rules["years"] * 12 + 1):
        moment = birth + timedelta(days=month * MONTH_DAYS)
        while at < len(subs) - 1 and moment >= subs[at][1].end:
            at += 1
        main_lord, sub = subs[at]
        value = blend(main_lord, sub.lord)
        if _inside(erashtaka, moment):
            value += weights["erashtaka"]
        if _inside(guru_returns, moment):
            value += weights["guru_return"]
        quality.append(round(max(-1.0, min(1.0, value)), 2))

    return Journey(
        birth=birth,
        end=end,
        periods=periods,
        erashtaka=erashtaka,
        erashtaka_lagna=erashtaka_lagna,
        guru_returns=guru_returns,
        quality=tuple(quality),
        rule_set=rules["version"],
        provisional=bool(rules["provisional"]),
    )
