"""The yearly forecast by lagna. A paid feature, open to everyone for now (docs/07).

Every yearly endpoint depends on yearly_access(). That is the one place to add the paid
check later.
"""

import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from pydantic import BaseModel

from app.api.birth import resolve_birth
from app.api.changes import CACHE, ChangeOut, CountedOut, change_out, counted_out
from app.api.charts import EPHEMERIS, HadahanRequest
from app.api.deps import PlacesDb
from app.api.timeresolve import TimeResolveResponse
from app.engine.changes import SRI_LANKA, count_from
from app.engine.chart import compute_chart
from app.engine.transits import SLOW_BODIES
from app.engine.yearly import YEARS, Stay, YearForecast, year_forecast
from app.engine.zodiac import RASHI, Body
from app.explain.labels import Lang, labels
from app.reports.format import format_date

router = APIRouter(tags=["yearly"])


def yearly_access() -> None:
    """Who may see the yearly forecast. Everyone, for now.

    The paid lock goes here: raise HTTPException(402) for a visitor without access.
    """


Access = Annotated[None, Depends(yearly_access)]


class StayOut(BaseModel):
    sign: str
    house: int
    start: dt.date  # Sri Lanka dates
    end: dt.date  # the last day of the stay inside the year
    from_before: bool
    past_end: bool
    text: str
    theme: str


class YearPlanetOut(BaseModel):
    body: Body
    stays: list[StayOut]
    quiet: str | None  # "Rahu does not change sign this year."


class YearMonthOut(BaseModel):
    month: int
    name: str
    houses: dict[str, int]  # where each planet is when the month begins
    changes: list[str]  # ids of the changes inside the month


class KeyDateOut(BaseModel):
    change: ChangeOut
    counted: CountedOut


class YearOut(BaseModel):
    rule_set: str
    provisional: bool
    year: int
    sign: str
    sign_name: str
    planets: list[YearPlanetOut]
    months: list[YearMonthOut]
    key_dates: list[KeyDateOut]


class PersonalYearResponse(BaseModel):
    status: str
    time: TimeResolveResponse
    lagna: YearOut | None
    gochara: YearOut | None  # counted from the Moon sign


def _local_date(moment: dt.datetime) -> dt.date:
    return moment.astimezone(SRI_LANKA).date()


def _stay(stay: Stay, lang: Lang) -> StayOut:
    table = labels(lang)
    text, house = table["yearly"], table["house"]
    last = _local_date(stay.end - dt.timedelta(minutes=1))
    values = {
        "planet": table["planet"][stay.body.value]["name"],
        "sign": table["rashi"][RASHI[stay.sign]]["name"],
        "house": house[stay.house - 1],
        "from": format_date(_local_date(stay.start), lang),
        "to": format_date(last, lang),
    }
    if stay.from_before and stay.past_end:
        code = "all_year"
    elif stay.from_before:
        code = "until"
    elif stay.past_end:
        code = "from"
    else:
        code = "between"
    line = text[code].format(**values)
    theme = table["changes"]["theme"].format(
        house=house[stay.house - 1], theme=table["house_theme"][stay.house - 1]
    )
    return StayOut(
        sign=RASHI[stay.sign],
        house=stay.house,
        start=_local_date(stay.start),
        end=last,
        from_before=stay.from_before,
        past_end=stay.past_end,
        text=line[0].upper() + line[1:] if lang == "en" else line,
        theme=theme[0].upper() + theme[1:] if lang == "en" else theme,
    )


def year_out(result: YearForecast, lang: Lang, *, moon: bool = False) -> YearOut:
    table = labels(lang)
    planets = []
    for body in SLOW_BODIES:
        stays = [s for s in result.stays if s.body is body]
        quiet = None
        if len(stays) == 1:
            quiet = table["yearly"]["quiet"].format(planet=table["planet"][body.value]["name"])
        planets.append(YearPlanetOut(body=body, stays=[_stay(s, lang) for s in stays], quiet=quiet))
    months = []
    for month in range(1, 13):
        begins = dt.datetime(result.year, month, 1, tzinfo=SRI_LANKA)
        ends = (
            dt.datetime(result.year, month + 1, 1, tzinfo=SRI_LANKA) if month < 12 else result.end
        )
        months.append(
            YearMonthOut(
                month=month,
                name=table["month"][month - 1],
                houses={body.value: result.house_on(body, begins) for body in SLOW_BODIES},
                changes=[c.id for c in result.changes if begins <= c.moment < ends],
            )
        )
    return YearOut(
        rule_set=result.rule_set,
        provisional=result.provisional,
        year=result.year,
        sign=RASHI[result.sign],
        sign_name=table["rashi"][RASHI[result.sign]]["name"],
        planets=planets,
        months=months,
        key_dates=[
            KeyDateOut(
                change=change_out(change, lang),
                counted=counted_out(count_from(change, result.sign), lang, moon=moon),
            )
            for change in result.changes
        ],
    )


def _year_or_404(year: int) -> int:
    if year not in YEARS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no forecast for this year")
    return year


@router.get("/v1/yearly/{year}/{lagna}", response_model=YearOut)
def yearly(
    year: int,
    lagna: Annotated[str, Path(max_length=20)],
    response: Response,
    _: Access,
    lang: Annotated[Lang, Query()] = "en",
) -> YearOut:
    """The year for one lagna. The same houses hold for that Moon sign (gochara)."""
    _year_or_404(year)
    if lagna not in RASHI:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown lagna")
    response.headers.update(CACHE)
    return year_out(year_forecast(EPHEMERIS, RASHI.index(lagna), year), lang)


@router.post("/v1/yearly/{year}/personal", response_model=PersonalYearResponse)
def personal_yearly(
    year: int, body: HadahanRequest, db: PlacesDb, _: Access
) -> PersonalYearResponse:
    """The year for one birth chart: from the lagna, and from the Moon sign (gochara)."""
    _year_or_404(year)
    birth = resolve_birth(body, db)
    if birth.utc is None:
        return PersonalYearResponse(
            status=birth.time.status, time=birth.time, lagna=None, gochara=None
        )
    chart = compute_chart(EPHEMERIS, birth.utc, birth.latitude, birth.longitude)
    return PersonalYearResponse(
        status="ok",
        time=birth.time,
        lagna=year_out(year_forecast(EPHEMERIS, chart.lagna.sign, year), body.lang),
        gochara=year_out(year_forecast(EPHEMERIS, chart.moon.sign, year), body.lang, moon=True),
    )
