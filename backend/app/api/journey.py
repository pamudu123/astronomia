"""The life road: a hundred years of periods for one birth chart, for the hadahan page."""

import datetime as dt
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.birth import resolve_birth
from app.api.charts import EPHEMERIS, HadahanRequest
from app.api.deps import PlacesDb
from app.api.porondam import FullPerson, PorondamRequest, QuickPerson, Role
from app.api.timeresolve import TimeResolveResponse
from app.engine.chart import Chart, compute_chart
from app.engine.dasha import YEAR_DAYS, YEARS
from app.engine.journey import MONTH_DAYS, Journey, Tone, life_journey
from app.engine.zodiac import NAKSHATRA, RASHI, Body
from app.explain.labels import Lang, labels
from app.reports.format import format_date

router = APIRouter(tags=["journey"])

StopKind = Literal["birth", "period", "erashtaka_start", "erashtaka_end", "guru_return", "onward"]
# Travel stops this many years before the road's end, where it has faded into light.
ONWARD_YEARS_BEFORE_END = 4


class SubPeriodOut(BaseModel):
    lord: Body
    start: dt.datetime
    end: dt.datetime
    house: int
    theme: str  # what the lord's house is about
    tone: Tone


class MainPeriodOut(BaseModel):
    lord: Body
    start: dt.datetime
    end: dt.datetime
    house: int
    theme: str
    tone: Tone
    sub: list[SubPeriodOut]


class SpanOut(BaseModel):
    start: dt.datetime
    end: dt.datetime


class StopOut(BaseModel):
    kind: StopKind
    at: dt.datetime
    tone: Tone
    lord: Body | None = None
    title: str
    text: str
    helps: str | None = None


class QualityOut(BaseModel):
    step_days: float
    values: list[float]  # from birth, -1 (hard going) to 1 (clear road)


class JourneyOut(BaseModel):
    rule_set: str
    provisional: bool
    birth: dt.datetime
    end: dt.datetime
    now: dt.datetime
    periods: list[MainPeriodOut]
    erashtaka: list[SpanOut]
    guru_returns: list[SpanOut]
    stops: list[StopOut]
    quality: QualityOut


class JourneyResponse(BaseModel):
    status: str
    time: TimeResolveResponse
    journey: JourneyOut | None


def _stops(journey: Journey, chart: Chart, lang: Lang) -> list[StopOut]:
    table = labels(lang)
    text, planet, house, themes = (
        table["journey"],
        table["planet"],
        table["house"],
        table["house_theme"],
    )

    def day(moment: dt.datetime) -> str:
        return format_date(moment.date(), lang)

    first = journey.periods[0]
    stops = [
        StopOut(
            kind="birth",
            at=journey.birth,
            tone=first.tone,
            lord=first.lord,
            title=text["birth_title"],
            text=text["birth_text"].format(
                star=table["nakshatra"][NAKSHATRA[chart.moon.nakshatra]],
                planet=planet[first.lord.value]["name"],
            ),
        )
    ]
    for period in journey.periods[1:]:
        name = planet[period.lord.value]["name"]
        stops.append(
            StopOut(
                kind="period",
                at=period.start,
                tone=period.tone,
                lord=period.lord,
                title=text["period_title"].format(planet=name),
                text=text["period_text"].format(
                    planet=name,
                    years=YEARS[period.lord],
                    house=house[period.house - 1],
                    theme=themes[period.house - 1],
                ),
            )
        )
    for span in journey.erashtaka:
        if span.start > journey.birth:
            stops.append(
                StopOut(
                    kind="erashtaka_start",
                    at=span.start,
                    tone="careful",
                    lord=Body.SATURN,
                    title=text["erashtaka_start_title"],
                    text=text["erashtaka_start_text"].format(to=day(span.end)),
                    helps=text["erashtaka_start_helps"],
                )
            )
        if span.end < journey.end:
            stops.append(
                StopOut(
                    kind="erashtaka_end",
                    at=span.end,
                    tone="good",
                    lord=Body.SATURN,
                    title=text["erashtaka_end_title"],
                    text=text["erashtaka_end_text"],
                )
            )
    sign = table["rashi"][RASHI[chart.planets[Body.JUPITER].point.sign]]["name"]
    for span in journey.guru_returns:
        stops.append(
            StopOut(
                kind="guru_return",
                at=span.start,
                tone="good",
                lord=Body.JUPITER,
                title=text["guru_return_title"].format(sign=sign),
                text=text["guru_return_text"].format(to=day(span.end)),
            )
        )
    onward = journey.end - dt.timedelta(days=ONWARD_YEARS_BEFORE_END * YEAR_DAYS)
    stops = [stop for stop in stops if stop.at < onward]
    stops.append(
        StopOut(
            kind="onward",
            at=onward,
            tone="good",
            title=text["onward_title"],
            text=text["onward_text"],
        )
    )
    return sorted(stops, key=lambda stop: stop.at)


def journey_out(journey: Journey, chart: Chart, now: dt.datetime, lang: Lang) -> JourneyOut:
    themes = labels(lang)["house_theme"]
    return JourneyOut(
        rule_set=journey.rule_set,
        provisional=journey.provisional,
        birth=journey.birth,
        end=journey.end,
        now=now,
        periods=[
            MainPeriodOut(
                lord=main.lord,
                start=main.start,
                end=main.end,
                house=main.house,
                theme=themes[main.house - 1],
                tone=main.tone,
                sub=[
                    SubPeriodOut(
                        lord=sub.lord,
                        start=sub.start,
                        end=sub.end,
                        house=sub.house,
                        theme=themes[sub.house - 1],
                        tone=sub.tone,
                    )
                    for sub in main.subs
                ],
            )
            for main in journey.periods
        ],
        erashtaka=[SpanOut(start=s.start, end=s.end) for s in journey.erashtaka],
        guru_returns=[SpanOut(start=s.start, end=s.end) for s in journey.guru_returns],
        stops=_stops(journey, chart, lang),
        quality=QualityOut(step_days=MONTH_DAYS, values=list(journey.quality)),
    )


@router.post("/v1/journey", response_model=JourneyResponse)
def journey(body: HadahanRequest, db: PlacesDb) -> JourneyResponse:
    """The life road for one birth chart: a hundred years, whatever the chart. Dates are UTC."""
    birth = resolve_birth(body, db)
    if birth.utc is None:
        return JourneyResponse(status=birth.time.status, time=birth.time, journey=None)
    chart = compute_chart(EPHEMERIS, birth.utc, birth.latitude, birth.longitude)
    now = body.as_of or dt.datetime.now(dt.UTC)
    result = life_journey(EPHEMERIS, chart)
    return JourneyResponse(
        status="ok", time=birth.time, journey=journey_out(result, chart, now, body.lang)
    )


# ---------- the couple's road ----------


class CoupleJourneyRequest(PorondamRequest):
    as_of: dt.datetime | None = None  # "today"; for tests


class CoupleJourneyResponse(BaseModel):
    # "needs_birth" when either person gave a birth star only: dasha periods need the birth time.
    status: str
    waiting_for: Role | None = None  # whose birth time needs a clock change choice
    time: TimeResolveResponse | None = None
    bride: JourneyOut | None = None
    groom: JourneyOut | None = None


@router.post("/v1/journey/couple", response_model=CoupleJourneyResponse)
def couple_journey(body: CoupleJourneyRequest, db: PlacesDb) -> CoupleJourneyResponse:
    """A life road for each of two people, for the porondam page to draw side by side.

    Each road is the one /v1/journey gives for that person alone. Dates are UTC."""
    people: dict[Role, FullPerson | QuickPerson] = {"bride": body.bride, "groom": body.groom}
    if any(isinstance(person, QuickPerson) for person in people.values()):
        return CoupleJourneyResponse(status="needs_birth")
    now = body.as_of or dt.datetime.now(dt.UTC)
    roads: dict[Role, JourneyOut] = {}
    for role, person in people.items():
        assert isinstance(person, FullPerson)
        birth = resolve_birth(person, db)
        if birth.utc is None:
            return CoupleJourneyResponse(
                status=birth.time.status, waiting_for=role, time=birth.time
            )
        chart = compute_chart(EPHEMERIS, birth.utc, birth.latitude, birth.longitude)
        roads[role] = journey_out(life_journey(EPHEMERIS, chart), chart, now, body.lang)
    return CoupleJourneyResponse(status="ok", bride=roads["bride"], groom=roads["groom"])
