"""Birth chart (hadahan) endpoints."""

import datetime as dt
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Path
from pydantic import BaseModel

from app.api.birth import BirthInput, resolve_birth
from app.api.deps import PlacesDb
from app.api.timeresolve import TimeResolveResponse
from app.engine.chart import Chart, Point, compute_chart
from app.engine.dasha import DashaTimeline, Period, vimshottari
from app.engine.ephemeris import SwissEphemeris
from app.engine.kuja import KujaResult, kuja_dosha
from app.engine.zodiac import NAKSHATRA, RASHI, Body
from app.explain.labels import Lang, labels, reason

router = APIRouter(tags=["hadahan"])
EPHEMERIS = SwissEphemeris()


# ---------- response models ----------


class PointOut(BaseModel):
    longitude: float
    sign: str
    sign_number: int
    degree: float
    nakshatra: str
    nakshatra_number: int
    pada: int
    navamsha_sign: str

    @classmethod
    def of(cls, point: Point) -> "PointOut":
        return cls(
            longitude=round(point.longitude, 6),
            sign=RASHI[point.sign],
            sign_number=point.sign + 1,
            degree=round(point.degree, 6),
            nakshatra=NAKSHATRA[point.nakshatra],
            nakshatra_number=point.nakshatra + 1,
            pada=point.pada,
            navamsha_sign=RASHI[point.navamsha_sign],
        )


class PlanetOut(PointOut):
    body: Body
    house: int
    navamsha_house: int
    retrograde: bool


class TimeCheckOut(BaseModel):
    stable: bool
    lagna_changes_within: int | None
    nakshatra_changes_within: int | None
    pada_changes_within: int | None
    reason: str


class MethodOut(BaseModel):
    ayanamsa: str
    ayanamsa_degrees: float
    node: str
    house_system: str
    ephemeris: str


class ChartOut(BaseModel):
    utc: dt.datetime
    latitude: float
    longitude: float
    lagna: PointOut
    moon: PointOut
    planets: list[PlanetOut]
    time_check: TimeCheckOut
    method: MethodOut


class PeriodOut(BaseModel):
    lord: Body
    start: dt.datetime
    end: dt.datetime
    sub: list["PeriodOut"] = []


class DashaOut(BaseModel):
    system: Literal["vimshottari"] = "vimshottari"
    balance_years: float
    periods: list[PeriodOut]
    current: list[PeriodOut]


class KujaPointOut(BaseModel):
    point: str
    house: int
    counts: bool


class CancellationOut(BaseModel):
    id: str
    applies: bool
    facts: dict[str, str | int]
    reason: str


class KujaOut(BaseModel):
    rule_set: str
    provisional: bool
    present: bool
    strength: int
    reduced: bool
    points: list[KujaPointOut]
    cancellations: list[CancellationOut]
    reasons: list[str]


class ChartResponse(BaseModel):
    status: str
    time: TimeResolveResponse
    chart: ChartOut | None


class HadahanResponse(ChartResponse):
    dasha: DashaOut | None
    kuja: KujaOut | None


class HadahanRequest(BirthInput):
    lang: Lang = "en"
    as_of: dt.datetime | None = None  # "now" for the current dasha; for tests


# ---------- building responses ----------


def chart_out(chart: Chart, lang: Lang) -> ChartOut:
    check = chart.time_check
    if check.lagna_changes_within is not None:
        text = reason(lang, "time_lagna", {"minutes": check.lagna_changes_within})
    elif check.nakshatra_changes_within is not None:
        text = reason(lang, "time_nakshatra", {"minutes": check.nakshatra_changes_within})
    else:
        text = reason(lang, "time_stable")
    return ChartOut(
        utc=chart.utc,
        latitude=chart.latitude,
        longitude=chart.longitude,
        lagna=PointOut.of(chart.lagna),
        moon=PointOut.of(chart.moon),
        planets=[
            PlanetOut(
                **PointOut.of(p.point).model_dump(),
                body=p.body,
                house=p.house,
                navamsha_house=p.navamsha_house,
                retrograde=p.retrograde,
            )
            for p in chart.planets.values()
        ],
        time_check=TimeCheckOut(
            stable=check.stable,
            lagna_changes_within=check.lagna_changes_within,
            nakshatra_changes_within=check.nakshatra_changes_within,
            pada_changes_within=check.pada_changes_within,
            reason=text,
        ),
        method=MethodOut(
            ayanamsa=chart.method.ayanamsa,
            ayanamsa_degrees=round(chart.method.ayanamsa_degrees, 6),
            node=chart.method.node,
            house_system=chart.method.house_system,
            ephemeris=chart.method.ephemeris,
        ),
    )


def _period(period: Period, depth: int) -> PeriodOut:
    sub = [_period(p, depth - 1) for p in period.children] if depth > 1 else []
    return PeriodOut(lord=period.lord, start=period.start, end=period.end, sub=sub)


def dasha_out(timeline: DashaTimeline, now: dt.datetime) -> DashaOut:
    current = timeline.current(now)
    current_sub = current[1] if len(current) > 1 else None
    periods = []
    for main in timeline.periods:
        subs = [
            _period(sub, 2 if sub is current_sub else 1)  # third level only where we are now
            for sub in main.children
        ]
        periods.append(PeriodOut(lord=main.lord, start=main.start, end=main.end, sub=subs))
    return DashaOut(
        balance_years=round(timeline.balance_years, 4),
        periods=periods,
        current=[_period(p, 1) for p in current],
    )


def kuja_out(result: KujaResult, lang: Lang) -> KujaOut:
    reasons = [
        reason(lang, "kuja_present", {"house": p.house, "point": p.point})
        for p in result.points
        if p.counts
    ]
    if not result.present:
        reasons = [reason(lang, "kuja_absent")]
    elif result.reduced:
        reasons.append(reason(lang, "kuja_reduced"))
    cancellations = []
    for c in result.cancellations:
        code = f"kuja_cancel_{c.id}" if c.applies else f"kuja_not_{c.id}"
        cancellations.append(
            CancellationOut(
                id=c.id, applies=c.applies, facts=c.facts, reason=reason(lang, code, c.facts)
            )
        )
    return KujaOut(
        rule_set=result.rule_set,
        provisional=result.provisional,
        present=result.present,
        strength=result.strength,
        reduced=result.reduced,
        points=[KujaPointOut(point=p.point, house=p.house, counts=p.counts) for p in result.points],
        cancellations=cancellations,
        reasons=reasons,
    )


# ---------- endpoints ----------


@router.post("/v1/charts", response_model=ChartResponse)
def chart(body: HadahanRequest, db: PlacesDb) -> ChartResponse:
    birth = resolve_birth(body, db)
    if birth.utc is None:
        return ChartResponse(status=birth.time.status, time=birth.time, chart=None)
    result = compute_chart(EPHEMERIS, birth.utc, birth.latitude, birth.longitude)
    return ChartResponse(status="ok", time=birth.time, chart=chart_out(result, body.lang))


@router.post("/v1/hadahan", response_model=HadahanResponse)
def hadahan(body: HadahanRequest, db: PlacesDb) -> HadahanResponse:
    """The full birth chart page: chart, vimshottari dasha and Kuja dosha."""
    birth = resolve_birth(body, db)
    if birth.utc is None:
        return HadahanResponse(
            status=birth.time.status, time=birth.time, chart=None, dasha=None, kuja=None
        )
    result = compute_chart(EPHEMERIS, birth.utc, birth.latitude, birth.longitude)
    now = body.as_of or dt.datetime.now(dt.UTC)
    timeline = vimshottari(result.moon.longitude, result.utc)
    return HadahanResponse(
        status="ok",
        time=birth.time,
        chart=chart_out(result, body.lang),
        dasha=dasha_out(timeline, now),
        kuja=kuja_out(kuja_dosha(result), body.lang),
    )


@router.get("/v1/labels/{lang}", tags=["meta"])
def get_labels(lang: Annotated[Lang, Path()]) -> dict[str, Any]:
    """Names used by the hadahan and porondam pages, in one language."""
    table = labels(lang)
    keys = (
        "rashi",
        "nakshatra",
        "planet",
        "point",
        "kuja_rule",
        "house",
        "gana",
        "yoni",
        "nadi",
        "rajju",
        "porondam_factor",
    )
    return {key: table[key] for key in keys}
