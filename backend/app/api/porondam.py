"""Porondam (marriage matching) endpoint."""

import datetime as dt
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.birth import BirthInput, resolve_birth
from app.api.charts import EPHEMERIS, KujaOut, kuja_out
from app.api.deps import PlacesDb
from app.api.timeresolve import TimeResolveResponse
from app.engine import couple
from app.engine.chart import Chart, Point, compute_chart
from app.engine.kuja import kuja_dosha
from app.engine.porondam import FactorResult, match, star_matches, star_point
from app.engine.zodiac import NAKSHATRA, RASHI, Body
from app.explain.labels import Lang, labels, reason
from app.reports.format import format_date

router = APIRouter(tags=["porondam"])

Role = Literal["bride", "groom"]


class FullPerson(BirthInput):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(default="", max_length=60)


class QuickPerson(BaseModel):
    """Birth star only: the pada fixes the Moon sign. Lagna based checks are not possible."""

    model_config = ConfigDict(extra="forbid")
    name: str = Field(default="", max_length=60)
    nakshatra: str
    pada: int = Field(ge=1, le=4)


class PorondamRequest(BaseModel):
    bride: FullPerson | QuickPerson
    groom: FullPerson | QuickPerson
    lang: Lang = "en"


class PersonOut(BaseModel):
    name: str
    mode: Literal["full", "quick"]
    nakshatra: str
    pada: int
    rashi: str
    lagna: str | None
    offset_label: str | None


class FactorOut(BaseModel):
    id: str
    hard: bool
    passed: bool
    # False when the match lacks what the factor needs (the birth weekdays need full birth
    # details). It is then not counted, and passed means nothing.
    checked: bool = True
    facts: dict[str, str | int]
    reason: str


class ScoreOut(BaseModel):
    passed: int
    total: int


class KujaPairOut(BaseModel):
    bride: KujaOut
    groom: KujaOut
    comparison: Literal["both", "neither", "bride_only", "groom_only"]
    reason: str


class MatchOut(BaseModel):
    rule_set: str
    provisional: bool
    score: ScoreOut
    hard_checks: list[FactorOut]
    factors: list[FactorOut]
    summary: str
    summary_text: str
    same_star: bool
    same_star_text: str | None


class PorondamResponse(BaseModel):
    status: str
    waiting_for: Role | None = None  # whose birth time needs a clock change choice
    time: TimeResolveResponse | None = None
    bride: PersonOut | None = None
    groom: PersonOut | None = None
    match: MatchOut | None = None
    kuja: KujaPairOut | None = None


def _factor_out(result: FactorResult, lang: Lang) -> FactorOut:
    outcome = "pass" if result.passed else "fail"
    code = f"{result.id}_{outcome if result.checked else 'unchecked'}"
    return FactorOut(
        id=result.id,
        hard=result.hard,
        passed=result.passed,
        checked=result.checked,
        facts=result.facts,
        reason=reason(lang, code, result.facts, section="porondam_reason"),
    )


def _person(
    person: FullPerson | QuickPerson, db: Path, role: Role
) -> tuple[Point, Chart | None, PersonOut, int | None] | PorondamResponse:
    """The Moon, the chart, what the page shows, and the birth weekday (0 = Monday).

    The weekday is the one on the local birth date. A birth star only match has none."""
    if isinstance(person, QuickPerson):
        if person.nakshatra not in NAKSHATRA:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown nakshatra")
        moon = star_point(person.nakshatra, person.pada)
        out = PersonOut(
            name=person.name,
            mode="quick",
            nakshatra=person.nakshatra,
            pada=person.pada,
            rashi=RASHI[moon.sign],
            lagna=None,
            offset_label=None,
        )
        return moon, None, out, None
    birth = resolve_birth(person, db)
    if birth.utc is None:
        return PorondamResponse(status=birth.time.status, waiting_for=role, time=birth.time)
    chart = compute_chart(EPHEMERIS, birth.utc, birth.latitude, birth.longitude)
    out = PersonOut(
        name=person.name,
        mode="full",
        nakshatra=NAKSHATRA[chart.moon.nakshatra],
        pada=chart.moon.pada,
        rashi=RASHI[chart.moon.sign],
        lagna=RASHI[chart.lagna.sign],
        offset_label=birth.time.offset_label,
    )
    return chart.moon, chart, out, person.date.weekday()


@dataclass(frozen=True)
class PorondamBuild:
    """The page's response, plus each person's chart (None for a birth star only match)."""

    response: PorondamResponse
    charts: dict[Role, Chart | None]


def build_porondam(body: PorondamRequest, db: Path) -> PorondamBuild:
    """Match two people. Each is either full birth details or a birth star and pada."""
    people = {}
    for role in ("bride", "groom"):
        found = _person(getattr(body, role), db, role)
        if isinstance(found, PorondamResponse):
            return PorondamBuild(found, {"bride": None, "groom": None})
        people[role] = found
    (b_moon, b_chart, b_out, b_day), (g_moon, g_chart, g_out, g_day) = (
        people["bride"],
        people["groom"],
    )

    weekdays = (b_day, g_day) if b_day is not None and g_day is not None else None
    lagnas = (b_chart.lagna.sign, g_chart.lagna.sign) if b_chart and g_chart else None
    result = match(b_moon, g_moon, weekdays=weekdays, lagnas=lagnas)
    lang = body.lang
    match_out = MatchOut(
        rule_set=result.rule_set,
        provisional=result.provisional,
        score=ScoreOut(passed=result.passed, total=len(result.scored)),
        hard_checks=[_factor_out(f, lang) for f in result.hard_checks],
        # Every factor that is not an essential check, counted or not; the score counts only
        # the checked ones.
        factors=[_factor_out(f, lang) for f in result.factors if not f.hard],
        summary=result.summary,
        summary_text=reason(lang, f"summary_{result.summary}", section="porondam_reason"),
        same_star=result.same_star,
        same_star_text=reason(lang, "same_star", section="porondam_reason")
        if result.same_star
        else None,
    )

    kuja = None
    if b_chart is not None and g_chart is not None:
        b_kuja, g_kuja = kuja_dosha(b_chart), kuja_dosha(g_chart)
        comparison: Literal["both", "neither", "bride_only", "groom_only"] = (
            "both"
            if b_kuja.present and g_kuja.present
            else "neither"
            if not b_kuja.present and not g_kuja.present
            else "bride_only"
            if b_kuja.present
            else "groom_only"
        )
        kuja = KujaPairOut(
            bride=kuja_out(b_kuja, lang),
            groom=kuja_out(g_kuja, lang),
            comparison=comparison,
            reason=reason(lang, f"kuja_{comparison}", section="porondam_reason"),
        )
    response = PorondamResponse(status="ok", bride=b_out, groom=g_out, match=match_out, kuja=kuja)
    return PorondamBuild(response, {"bride": b_chart, "groom": g_chart})


@router.post("/v1/porondam", response_model=PorondamResponse)
def porondam(body: PorondamRequest, db: PlacesDb) -> PorondamResponse:
    """Match two people. Each is either full birth details or a birth star and pada."""
    return build_porondam(body, db).response


class CheckOut(BaseModel):
    id: str
    name: str
    passed: bool


class StarMatchOut(BaseModel):
    nakshatra: str
    name: str
    rashi: str
    rashi_name: str
    padas: list[int]
    score: ScoreOut
    essential_pass: bool
    hard_checks: list[CheckOut]
    summary: str
    same_star: bool


class StarMatchesResponse(BaseModel):
    nakshatra: str
    name: str
    pada: int
    rashi: str
    rashi_name: str
    role: Role
    rule_set: str
    provisional: bool
    matches: list[StarMatchOut]


# The answer depends only on the star and the rule set, so browsers and caches may keep it.
STAR_CACHE = {"Cache-Control": "public, max-age=3600"}


@router.get("/v1/porondam/stars/{nakshatra}", response_model=StarMatchesResponse)
def porondam_stars(
    nakshatra: str,
    response: Response,
    pada: Annotated[int, Query(ge=1, le=4)] = 1,
    role: Annotated[Role, Query()] = "bride",
    lang: Annotated[Lang, Query()] = "en",
) -> StarMatchesResponse:
    """All 27 birth stars as partners for one star, best first. No birth details needed."""
    if nakshatra not in NAKSHATRA:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown nakshatra")
    names = labels(lang)
    found = star_matches(nakshatra, pada, role)
    own_sign = RASHI[star_point(nakshatra, pada).sign]
    response.headers.update(STAR_CACHE)
    return StarMatchesResponse(
        nakshatra=nakshatra,
        name=names["nakshatra"][nakshatra],
        pada=pada,
        rashi=own_sign,
        rashi_name=names["rashi"][own_sign]["name"],
        role=role,
        rule_set=found[0].result.rule_set,
        provisional=found[0].result.provisional,
        matches=[
            StarMatchOut(
                nakshatra=NAKSHATRA[m.nakshatra],
                name=names["nakshatra"][NAKSHATRA[m.nakshatra]],
                rashi=RASHI[m.sign],
                rashi_name=names["rashi"][RASHI[m.sign]]["name"],
                padas=list(m.padas),
                score=ScoreOut(passed=m.result.passed, total=len(m.result.scored)),
                essential_pass=m.essential_pass,
                hard_checks=[
                    CheckOut(id=f.id, name=names["porondam_factor"][f.id]["name"], passed=f.passed)
                    for f in m.result.hard_checks
                ],
                summary=m.result.summary,
                same_star=m.result.same_star,
            )
            for m in found
        ],
    )


# ---------- years ahead for the couple ----------


class TimelineRequest(PorondamRequest):
    as_of: dt.datetime | None = None  # "today"; for tests


class SpanOut(BaseModel):
    start: dt.date
    end: dt.date
    from_before: bool  # already running when the window opens
    continues: bool  # still running when the window closes
    text: str


class SaturnOut(SpanOut):
    kind: couple.SaturnKind


class DashaSubOut(BaseModel):
    lord: Body
    start: dt.date
    end: dt.date


class DashaMainOut(DashaSubOut):
    sub: list[DashaSubOut]


class PersonTimelineOut(BaseModel):
    mode: Literal["full", "quick"]
    saturn: list[SaturnOut]
    # None for a birth star only person: dasha needs the exact position of the Moon.
    dasha: list[DashaMainOut] | None
    dasha_now: str | None


class TimelineOut(BaseModel):
    rule_set: str
    provisional: bool
    start: dt.date
    end: dt.date
    bride: PersonTimelineOut
    groom: PersonTimelineOut
    overlaps: list[SpanOut]


class TimelineResponse(BaseModel):
    status: str
    waiting_for: Role | None = None
    time: TimeResolveResponse | None = None
    timeline: TimelineOut | None = None


def _span_text(span: couple.Span, name: str, lang: Lang) -> str:
    shape = (
        "all"
        if span.from_before and span.continues
        else "until"
        if span.from_before
        else "from"
        if span.continues
        else "between"
    )
    table = labels(lang)
    text: str = table["couple"][f"{name}_{shape}"].format(
        planet=table["planet"]["saturn"]["name"],
        **{"from": format_date(span.start.date(), lang), "to": format_date(span.end.date(), lang)},
    )
    return text


def _span_out(span: couple.Span, name: str, lang: Lang) -> SpanOut:
    return SpanOut(
        start=span.start.date(),
        end=span.end.date(),
        from_before=span.from_before,
        continues=span.continues,
        text=_span_text(span, name, lang),
    )


def _person_timeline(
    moon: Point,
    chart: Chart | None,
    saturn: list[couple.SaturnPeriod],
    start: dt.datetime,
    end: dt.datetime,
    lang: Lang,
) -> PersonTimelineOut:
    saturn_out = [
        SaturnOut(**_span_out(period, period.kind, lang).model_dump(), kind=period.kind)
        for period in saturn
    ]
    if chart is None:
        return PersonTimelineOut(mode="quick", saturn=saturn_out, dasha=None, dasha_now=None)
    mains = couple.dasha_periods(moon.longitude, chart.utc, start, end)
    planet = labels(lang)["planet"]
    main_now = next((m for m in mains if m.contains(start)), None)
    sub_now = next((s for s in main_now.children if s.contains(start)), None) if main_now else None
    dasha_now = None
    if main_now and sub_now:
        dasha_now = labels(lang)["couple"]["dasha_now"].format(
            main=planet[main_now.lord.value]["name"],
            main_to=format_date(main_now.end.date(), lang),
            sub=planet[sub_now.lord.value]["name"],
            sub_to=format_date(sub_now.end.date(), lang),
        )
    return PersonTimelineOut(
        mode="full",
        saturn=saturn_out,
        dasha=[
            DashaMainOut(
                lord=main.lord,
                start=main.start.date(),
                end=main.end.date(),
                sub=[
                    DashaSubOut(lord=sub.lord, start=sub.start.date(), end=sub.end.date())
                    for sub in main.children
                ],
            )
            for main in mains
        ],
        dasha_now=dasha_now,
    )


@router.post("/v1/porondam/timeline", response_model=TimelineResponse)
def porondam_timeline(body: TimelineRequest, db: PlacesDb) -> TimelineResponse:
    """The next ten years for a couple: Saturn periods from each Moon sign, dasha periods,
    and where the Saturn periods overlap. Facts only. Dates are UTC."""
    people = {}
    for role in ("bride", "groom"):
        found = _person(getattr(body, role), db, role)
        if isinstance(found, PorondamResponse):
            return TimelineResponse(status=found.status, waiting_for=role, time=found.time)
        people[role] = found
    today = (body.as_of or dt.datetime.now(dt.UTC)).astimezone(dt.UTC).date()
    start, end = couple.window(today)
    stays = couple.saturn_stays(EPHEMERIS, today)
    saturn = {role: couple.saturn_periods(stays, people[role][0].sign) for role in people}
    lang = body.lang
    return TimelineResponse(
        status="ok",
        timeline=TimelineOut(
            rule_set=couple.RULE_SET,
            provisional=couple.PROVISIONAL,
            start=start.date(),
            end=end.date(),
            bride=_person_timeline(
                people["bride"][0], people["bride"][1], saturn["bride"], start, end, lang
            ),
            groom=_person_timeline(
                people["groom"][0], people["groom"][1], saturn["groom"], start, end, lang
            ),
            overlaps=[
                _span_out(span, "overlap", lang)
                for span in couple.overlaps(saturn["bride"], saturn["groom"])
            ],
        ),
    )
