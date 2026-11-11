"""Porondam (marriage matching) endpoint."""

from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.api.birth import BirthInput, resolve_birth
from app.api.charts import EPHEMERIS, KujaOut, kuja_out
from app.api.deps import PlacesDb
from app.api.timeresolve import TimeResolveResponse
from app.engine.chart import Chart, Point, compute_chart
from app.engine.kuja import kuja_dosha
from app.engine.porondam import FactorResult, match, star_point
from app.engine.zodiac import NAKSHATRA, RASHI
from app.explain.labels import Lang, reason

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
    code = f"{result.id}_{'pass' if result.passed else 'fail'}"
    return FactorOut(
        id=result.id,
        hard=result.hard,
        passed=result.passed,
        facts=result.facts,
        reason=reason(lang, code, result.facts, section="porondam_reason"),
    )


def _person(
    person: FullPerson | QuickPerson, db: PlacesDb, role: Role
) -> tuple[Point, Chart | None, PersonOut] | PorondamResponse:
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
        return moon, None, out
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
    return chart.moon, chart, out


@router.post("/v1/porondam", response_model=PorondamResponse)
def porondam(body: PorondamRequest, db: PlacesDb) -> PorondamResponse:
    """Match two people. Each is either full birth details or a birth star and pada."""
    people = {}
    for role in ("bride", "groom"):
        found = _person(getattr(body, role), db, role)
        if isinstance(found, PorondamResponse):
            return found
        people[role] = found
    (b_moon, b_chart, b_out), (g_moon, g_chart, g_out) = people["bride"], people["groom"]

    result = match(b_moon, g_moon)
    lang = body.lang
    match_out = MatchOut(
        rule_set=result.rule_set,
        provisional=result.provisional,
        score=ScoreOut(passed=result.passed, total=len(result.scored)),
        hard_checks=[_factor_out(f, lang) for f in result.hard_checks],
        factors=[_factor_out(f, lang) for f in result.scored],
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
    return PorondamResponse(status="ok", bride=b_out, groom=g_out, match=match_out, kuja=kuja)
