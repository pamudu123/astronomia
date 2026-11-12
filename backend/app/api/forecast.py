"""This month for you: the slow planets counted from the lagna (the free forecast)."""

import datetime as dt

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.birth import resolve_birth
from app.api.charts import EPHEMERIS, HadahanRequest
from app.api.deps import PlacesDb
from app.api.timeresolve import TimeResolveResponse
from app.engine.chart import compute_chart
from app.engine.forecast import MonthForecast, PlanetMonth, month_forecast
from app.engine.zodiac import RASHI, Body
from app.explain.labels import Lang, labels
from app.reports.format import format_date

router = APIRouter(tags=["forecast"])


class MoveOut(BaseModel):
    date: dt.date
    to_sign: str
    to_house: int
    text: str


class PlanetMonthOut(BaseModel):
    body: Body
    sign: str
    house: int
    retrograde: bool
    text: str  # where it is, counted from the lagna
    theme: str  # what the house it ends the month in is about
    moves: list[MoveOut]


class MonthOut(BaseModel):
    year: int
    month: int
    title: str  # "November 2026"
    start: dt.date
    end: dt.date  # the last day of the month


class ForecastOut(BaseModel):
    rule_set: str
    provisional: bool
    month: MonthOut
    planets: list[PlanetMonthOut]


class ForecastResponse(BaseModel):
    status: str
    time: TimeResolveResponse
    forecast: ForecastOut | None


def _planet(planet: PlanetMonth, lang: Lang) -> PlanetMonthOut:
    table = labels(lang)
    text, house, rashi = table["forecast"], table["house"], table["rashi"]
    line = text["starts" if planet.moves else "stays"].format(
        planet=table["planet"][planet.body.value]["name"],
        sign=rashi[RASHI[planet.sign]]["name"],
        house=house[planet.house - 1],
    )
    if planet.retrograde:
        line = f"{line} {text['retrograde']}"
    moves = [
        MoveOut(
            date=move.moment.date(),
            to_sign=RASHI[move.to_sign],
            to_house=move.to_house,
            text=text["moves"].format(
                date=format_date(move.moment.date(), lang),
                to_sign=rashi[RASHI[move.to_sign]]["name"],
                to_house=house[move.to_house - 1],
            ),
        )
        for move in planet.moves
    ]
    theme = text["theme"].format(
        house=house[planet.last_house - 1], theme=table["house_theme"][planet.last_house - 1]
    )
    return PlanetMonthOut(
        body=planet.body,
        sign=RASHI[planet.sign],
        house=planet.house,
        retrograde=planet.retrograde,
        text=line[0].upper() + line[1:] if lang == "en" else line,
        theme=theme,
        moves=moves,
    )


def forecast_out(result: MonthForecast, lang: Lang) -> ForecastOut:
    month = labels(lang)["month"][result.month - 1]
    title = f"{result.year} {month}" if lang == "si" else f"{month} {result.year}"
    return ForecastOut(
        rule_set=result.rule_set,
        provisional=result.provisional,
        month=MonthOut(
            year=result.year,
            month=result.month,
            title=title,
            start=result.start.date(),
            end=(result.end - dt.timedelta(days=1)).date(),
        ),
        planets=[_planet(planet, lang) for planet in result.planets],
    )


@router.post("/v1/forecast", response_model=ForecastResponse)
def forecast(body: HadahanRequest, db: PlacesDb) -> ForecastResponse:
    """The current month for one birth chart. Dates are UTC."""
    birth = resolve_birth(body, db)
    if birth.utc is None:
        return ForecastResponse(status=birth.time.status, time=birth.time, forecast=None)
    chart = compute_chart(EPHEMERIS, birth.utc, birth.latitude, birth.longitude)
    today = (body.as_of or dt.datetime.now(dt.UTC)).astimezone(dt.UTC).date()
    result = month_forecast(EPHEMERIS, chart.lagna.sign, today)
    return ForecastResponse(status="ok", time=birth.time, forecast=forecast_out(result, body.lang))
