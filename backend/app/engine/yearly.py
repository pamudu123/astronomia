"""The yearly forecast: where the slow planets stay over one year, counted from one sign.

A paid feature (docs/07). The engine is the same for everyone. The access check lives in
app/api/yearly.py, so it can be added in one place.
"""

from dataclasses import dataclass
from datetime import datetime

from app.engine.changes import SRI_LANKA, Change, all_changes
from app.engine.ephemeris import Ephemeris
from app.engine.transits import SLOW_BODIES, signs_at
from app.engine.zodiac import Body, whole_sign_house

RULE_SET = "yearly_v1"
# House themes are waiting for an astrologer's confirmation.
PROVISIONAL = True
# The years with a forecast. Each needs its changes inside the change list.
YEARS = (2027,)


@dataclass(frozen=True)
class Stay:
    body: Body
    sign: int
    house: int
    start: datetime  # clipped to the year
    end: datetime
    from_before: bool  # it was already there when the year began
    past_end: bool  # it is still there when the year ends


@dataclass(frozen=True)
class YearForecast:
    year: int
    sign: int  # the lagna, or the Moon sign for gochara
    start: datetime
    end: datetime  # the first moment of the next year
    stays: tuple[Stay, ...]  # by planet, then in time order
    changes: tuple[Change, ...]  # every change inside the year
    rule_set: str = RULE_SET
    provisional: bool = PROVISIONAL

    def house_on(self, body: Body, moment: datetime) -> int:
        """The house this planet is in at a moment inside the year."""
        for stay in self.stays:
            if stay.body is body and stay.start <= moment < stay.end:
                return stay.house
        raise ValueError("moment outside the year")


def year_bounds(year: int) -> tuple[datetime, datetime]:
    """The year in Sri Lanka time, as the change pages print it."""
    return datetime(year, 1, 1, tzinfo=SRI_LANKA), datetime(year + 1, 1, 1, tzinfo=SRI_LANKA)


def year_forecast(ephemeris: Ephemeris, sign: int, year: int) -> YearForecast:
    if year not in YEARS:
        raise ValueError(f"no forecast for {year}")
    start, end = year_bounds(year)
    changes = tuple(c for c in all_changes(ephemeris) if start <= c.moment < end)
    first = signs_at(ephemeris, start)

    stays: list[Stay] = []
    for body in SLOW_BODIES:
        current, since = first[body], start
        for change in changes:
            for move in change.moves:
                if move.body is body:
                    stays.append(
                        Stay(
                            body,
                            current,
                            whole_sign_house(current, sign),
                            since,
                            change.moment,
                            since == start,
                            False,
                        )
                    )
                    current, since = move.to_sign, change.moment
        stays.append(
            Stay(body, current, whole_sign_house(current, sign), since, end, since == start, True)
        )
    return YearForecast(year, sign, start, end, tuple(stays), changes)
