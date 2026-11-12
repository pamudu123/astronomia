"""Where the planets are on any date, and when they move from one sign to the next."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.engine.ephemeris import Ephemeris, julian_day
from app.engine.zodiac import Body, sign_index

# The slow planets, whose sign changes shape a forecast.
SLOW_BODIES: tuple[Body, ...] = (Body.SATURN, Body.JUPITER, Body.RAHU, Body.KETU)

_STEP = timedelta(days=1)
_PRECISION = timedelta(minutes=1)


@dataclass(frozen=True)
class SignChange:
    body: Body
    moment: datetime  # UTC, to the minute
    from_sign: int
    to_sign: int


def signs_at(ephemeris: Ephemeris, moment: datetime) -> dict[Body, int]:
    """The sign (0 = Mesha) of every planet at a moment."""
    positions = ephemeris.positions(julian_day(moment))
    return {body: sign_index(position.longitude) for body, position in positions.items()}


def retrograde_at(ephemeris: Ephemeris, moment: datetime) -> dict[Body, bool]:
    positions = ephemeris.positions(julian_day(moment))
    return {body: position.speed < 0 for body, position in positions.items()}


def _crossing(
    ephemeris: Ephemeris, body: Body, before: datetime, after: datetime, old_sign: int
) -> datetime:
    """The moment between two times when the planet leaves old_sign, by halving the gap."""
    while after - before > _PRECISION:
        middle = before + (after - before) / 2
        if signs_at(ephemeris, middle)[body] == old_sign:
            before = middle
        else:
            after = middle
    return after.replace(second=0, microsecond=0)


def sign_changes(
    ephemeris: Ephemeris,
    start: datetime,
    end: datetime,
    bodies: tuple[Body, ...] = SLOW_BODIES,
) -> list[SignChange]:
    """Every sign change of the given planets from start (inclusive) to end, in time order.

    Checks once a day, which suits every planet but the Moon (it changes sign about every two
    and a half days, so it is still found). A planet that turns retrograde and steps back into
    its earlier sign is reported like any other change.
    """
    if start.tzinfo is None or end.tzinfo is None:
        raise ValueError("start and end must be timezone aware")
    start, end = start.astimezone(UTC), end.astimezone(UTC)

    changes: list[SignChange] = []
    moment = start
    signs = signs_at(ephemeris, moment)
    while moment < end:
        following = min(moment + _STEP, end)
        next_signs = signs_at(ephemeris, following)
        for body in bodies:
            if next_signs[body] != signs[body]:
                when = _crossing(ephemeris, body, moment, following, signs[body])
                changes.append(SignChange(body, when, signs[body], next_signs[body]))
        moment, signs = following, next_signs
    return sorted(changes, key=lambda change: change.moment)
