"""The slow planets over one month, set against one person's lagna."""

import calendar
from dataclasses import dataclass
from datetime import UTC, date, datetime

from app.engine.ephemeris import Ephemeris
from app.engine.transits import SLOW_BODIES, retrograde_at, sign_changes, signs_at
from app.engine.zodiac import Body, whole_sign_house

RULE_SET = "forecast_v1"
# House themes and the choice of planets are waiting for an astrologer's confirmation.
PROVISIONAL = True


@dataclass(frozen=True)
class Move:
    moment: datetime
    to_sign: int
    to_house: int


@dataclass(frozen=True)
class PlanetMonth:
    body: Body
    sign: int  # where it is when the month begins
    house: int  # counted from the lagna
    retrograde: bool
    moves: tuple[Move, ...]

    @property
    def last_house(self) -> int:
        """The house it is in when the month ends."""
        return self.moves[-1].to_house if self.moves else self.house


@dataclass(frozen=True)
class MonthForecast:
    year: int
    month: int
    start: datetime
    end: datetime  # the first moment of the next month
    planets: tuple[PlanetMonth, ...]
    rule_set: str = RULE_SET
    provisional: bool = PROVISIONAL


def month_bounds(day: date) -> tuple[datetime, datetime]:
    """The first moment of the month holding this day, and of the month after, in UTC."""
    start = datetime(day.year, day.month, 1, tzinfo=UTC)
    days = calendar.monthrange(day.year, day.month)[1]
    following = date.fromordinal(start.date().toordinal() + days)
    return start, datetime(following.year, following.month, 1, tzinfo=UTC)


def month_forecast(ephemeris: Ephemeris, lagna_sign: int, day: date) -> MonthForecast:
    """Where Saturn, Jupiter, Rahu and Ketu are in the month holding this day."""
    start, end = month_bounds(day)
    signs = signs_at(ephemeris, start)
    retrograde = retrograde_at(ephemeris, start)
    changes = sign_changes(ephemeris, start, end)

    planets = []
    for body in SLOW_BODIES:
        moves = tuple(
            Move(c.moment, c.to_sign, whole_sign_house(c.to_sign, lagna_sign))
            for c in changes
            if c.body is body
        )
        planets.append(
            PlanetMonth(
                body=body,
                sign=signs[body],
                house=whole_sign_house(signs[body], lagna_sign),
                # The nodes always move backwards, so "retrograde" says nothing about them.
                retrograde=retrograde[body] and body not in (Body.RAHU, Body.KETU),
                moves=moves,
            )
        )
    return MonthForecast(day.year, day.month, start, end, tuple(planets))
