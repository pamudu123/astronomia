"""Starting letters (akuru) for a baby's name (free).

A star page needs no birth details, so it is a GET that browsers and caches may keep.
The letters for a birth take the birth details in a POST body, never in the address.
The table is provisional: see docs/12-baby-rules.md.
"""

import zoneinfo
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, Response, status
from pydantic import BaseModel

from app.api.birth import resolve_birth
from app.api.charts import EPHEMERIS, HadahanRequest, TimeCheckOut, chart_out
from app.api.deps import PlacesDb
from app.api.panchanga import CACHE, offset_label
from app.api.timeresolve import TimeResolveResponse
from app.engine import names
from app.engine.chart import compute_chart
from app.engine.panchanga import WEEKDAYS, Place, sinhala_day
from app.engine.porondam import star_point
from app.engine.zodiac import DEGREES_PER_NAKSHATRA, DEGREES_PER_PADA, NAKSHATRA, RASHI
from app.explain.labels import Lang, labels

router = APIRouter(tags=["baby"])


class PadaLetterOut(BaseModel):
    pada: int
    letter: str  # Sinhala
    latin: str  # English transliteration
    others: list[str]  # what other sources give for this pada
    rashi: str  # the Moon sign this pada falls in
    rashi_name: str
    from_degree: float  # where the pada starts and ends inside that sign
    to_degree: float


class StarLettersOut(BaseModel):
    star: str
    star_name: str
    star_number: int
    padas: list[PadaLetterOut]


class StarLettersResponse(StarLettersOut):
    rule_set: str
    provisional: bool


class AllLettersResponse(BaseModel):
    rule_set: str
    provisional: bool
    stars: list[StarLettersOut]


class NearbyLetterOut(BaseModel):
    minutes: int
    direction: str  # "before" or "after" the given time
    star: str
    star_name: str
    pada: int
    letter: str
    latin: str
    text: str


class SignLettersOut(BaseModel):
    key: str
    name: str
    letters: list[str]


class BabyChartOut(BaseModel):
    star: str
    star_name: str
    star_number: int
    pada: int
    rashi: str
    rashi_name: str
    lagna: str
    lagna_name: str
    weekday: str  # counted from sunrise
    weekday_name: str
    day_note: str
    timezone: str
    offset: str
    time_check: TimeCheckOut


class BabyLettersResponse(BaseModel):
    status: str
    time: TimeResolveResponse
    rule_set: str
    provisional: bool
    chart: BabyChartOut | None
    letter: PadaLetterOut | None  # the letter for the birth's pada
    star_letters: StarLettersOut | None  # all four padas of the birth star
    nearby: list[NearbyLetterOut]  # a pada change within 15 minutes of the time
    lagna_letters: SignLettersOut | None  # used by some families as well
    weekday_letters: SignLettersOut | None


def pada_out(star: str, pada: int, lang: Lang) -> PadaLetterOut:
    row = names.letter_for(star, pada)
    point = star_point(star, pada)
    start = NAKSHATRA.index(star) * DEGREES_PER_NAKSHATRA + (pada - 1) * DEGREES_PER_PADA
    inside = start - point.sign * 30
    return PadaLetterOut(
        pada=pada,
        letter=row.letter,
        latin=row.latin,
        others=list(row.others),
        rashi=RASHI[point.sign],
        rashi_name=labels(lang)["rashi"][RASHI[point.sign]]["name"],
        from_degree=round(inside, 6),
        to_degree=round(inside + DEGREES_PER_PADA, 6),
    )


def star_out(star: str, lang: Lang) -> StarLettersOut:
    return StarLettersOut(
        star=star,
        star_name=labels(lang)["nakshatra"][star],
        star_number=NAKSHATRA.index(star) + 1,
        padas=[pada_out(star, pada, lang) for pada in range(1, 5)],
    )


def _rule_set() -> tuple[str, bool]:
    rules = names.load_rules()
    return str(rules["version"]), bool(rules["provisional"])


@router.get("/v1/baby/letters", response_model=AllLettersResponse)
def all_letters(response: Response, lang: Annotated[Lang, Query()] = "en") -> AllLettersResponse:
    """The starting letters for every star and pada."""
    version, provisional = _rule_set()
    response.headers.update(CACHE)
    return AllLettersResponse(
        rule_set=version, provisional=provisional, stars=[star_out(s, lang) for s in NAKSHATRA]
    )


@router.get("/v1/baby/letters/{star}", response_model=StarLettersResponse)
def letters_for_star(
    star: Annotated[str, Path()], response: Response, lang: Annotated[Lang, Query()] = "en"
) -> StarLettersResponse:
    """The four padas of one birth star, each with its starting letter and Moon sign."""
    if star not in NAKSHATRA:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown star")
    version, provisional = _rule_set()
    response.headers.update(CACHE)
    return StarLettersResponse(
        rule_set=version, provisional=provisional, **star_out(star, lang).model_dump()
    )


@router.post("/v1/baby/letters", response_model=BabyLettersResponse)
def letters_for_birth(body: HadahanRequest, db: PlacesDb) -> BabyLettersResponse:
    """The birth star, pada, Moon sign, lagna and weekday, and the letters they give."""
    version, provisional = _rule_set()
    birth = resolve_birth(body, db)
    if birth.utc is None:
        return BabyLettersResponse(
            status=birth.time.status,
            time=birth.time,
            rule_set=version,
            provisional=provisional,
            chart=None,
            letter=None,
            star_letters=None,
            nearby=[],
            lagna_letters=None,
            weekday_letters=None,
        )
    lang = body.lang
    table = labels(lang)
    text = table["baby"]
    timezone = body.timezone or (birth.place.timezone if birth.place else "UTC")
    zone = zoneinfo.ZoneInfo(timezone)
    result = compute_chart(EPHEMERIS, birth.utc, birth.latitude, birth.longitude)
    moon, lagna = result.moon, result.lagna
    star = NAKSHATRA[moon.nakshatra]
    day = sinhala_day(EPHEMERIS, birth.utc, Place(birth.latitude, birth.longitude, timezone))
    weekday = WEEKDAYS[day.weekday()]
    local = birth.utc.astimezone(zone)
    if day != local.date():
        day_note = text["day_before_sunrise"].format(weekday=table["weekday"][weekday])
    else:
        day_note = text["day_after_sunrise"].format(weekday=table["weekday"][weekday])

    nearby = []
    for near in names.nearby_padas(EPHEMERIS, birth.utc):
        row = names.letter_for(near.star, near.pada)
        nearby.append(
            NearbyLetterOut(
                minutes=near.minutes,
                direction=near.direction,
                star=near.star,
                star_name=table["nakshatra"][near.star],
                pada=near.pada,
                letter=row.letter,
                latin=row.latin,
                text=text[f"nearby_{near.direction}"].format(
                    minutes=near.minutes,
                    star=table["nakshatra"][near.star],
                    pada=near.pada,
                    letter=row.letter,
                ),
            )
        )

    return BabyLettersResponse(
        status="ok",
        time=birth.time,
        rule_set=version,
        provisional=provisional,
        chart=BabyChartOut(
            star=star,
            star_name=table["nakshatra"][star],
            star_number=moon.nakshatra + 1,
            pada=moon.pada,
            rashi=RASHI[moon.sign],
            rashi_name=table["rashi"][RASHI[moon.sign]]["name"],
            lagna=RASHI[lagna.sign],
            lagna_name=table["rashi"][RASHI[lagna.sign]]["name"],
            weekday=weekday,
            weekday_name=table["weekday"][weekday],
            day_note=day_note,
            timezone=timezone,
            offset=offset_label(local),
            time_check=chart_out(result, lang).time_check,
        ),
        letter=pada_out(star, moon.pada, lang),
        star_letters=star_out(star, lang),
        nearby=nearby,
        lagna_letters=SignLettersOut(
            key=RASHI[lagna.sign],
            name=table["rashi"][RASHI[lagna.sign]]["name"],
            letters=list(names.lagna_letters(lagna.sign)),
        ),
        weekday_letters=SignLettersOut(
            key=weekday,
            name=table["weekday"][weekday],
            letters=list(names.weekday_letters(weekday)),
        ),
    )
