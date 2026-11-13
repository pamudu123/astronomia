"""Old horoscopes: from a kendara drawn on paper to the births that fit it."""

import datetime as dt
import zoneinfo
from typing import Annotated, Any, Literal, Self

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from app.api.charts import EPHEMERIS
from app.api.deps import PlacesDb
from app.api.panchanga import LocalTimeOut, offset_label, time_out
from app.engine.zodiac import NAKSHATRA, RASHI, Body
from app.explain.labels import Lang, labels
from app.geo.search import get_place
from app.kendara import search as engine
from app.kendara.table import load as load_table
from app.reports.format import format_date

router = APIRouter(tags=["kendara"])

COLOMBO = 1248991


def kendara_access() -> None:
    """Who may use the old horoscope search. Everyone, for now.

    The paid lock goes here: raise HTTPException(402) for a visitor without access.
    """


Access = Annotated[None, Depends(kendara_access)]


class DrawingIn(BaseModel):
    """One kendara as drawn: the lagna sign, and the house (1 = the lagna box) of each planet.
    A planet left out is not checked."""

    lagna: str
    houses: dict[Body, int]

    @model_validator(mode="after")
    def known(self) -> Self:
        if self.lagna not in RASHI:
            raise ValueError("unknown lagna sign")
        if any(not 1 <= house <= 12 for house in self.houses.values()):
            raise ValueError("houses are 1 to 12")
        return self

    def drawing(self) -> engine.Drawing:
        lagna = RASHI.index(self.lagna)
        return engine.Drawing(
            lagna, {body: (lagna + house - 1) % 12 for body, house in self.houses.items()}
        )


class KendaraRequest(BaseModel):
    rashi: DrawingIn
    navamsha: DrawingIn | None = None
    year_from: int | None = Field(default=None, ge=1900, le=2100)
    year_to: int | None = Field(default=None, ge=1900, le=2100)
    date: dt.date | None = None  # a known birth date, with no time
    nakshatra: str | None = None  # the birth star, when the paper shows it
    # The birth place: it sets the lagna. Colombo when not given.
    place_id: int | None = None
    latitude: float | None = Field(default=None, gt=-90, lt=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str | None = None
    as_of: dt.datetime | None = None  # the end of the search; now when not given (for tests)
    lang: Lang = "en"

    @model_validator(mode="after")
    def consistent(self) -> Self:
        manual = [self.latitude, self.longitude, self.timezone]
        if self.place_id is not None and any(v is not None for v in manual):
            raise ValueError("give either place_id or latitude, longitude and timezone")
        if any(v is not None for v in manual) and any(v is None for v in manual):
            raise ValueError("give all of latitude, longitude and timezone")
        if self.year_from and self.year_to and self.year_from > self.year_to:
            raise ValueError("year_from is after year_to")
        if self.nakshatra is not None and self.nakshatra not in NAKSHATRA:
            raise ValueError("unknown nakshatra")
        return self


class StarOut(BaseModel):
    nakshatra: str
    name: str
    pada: int
    start: LocalTimeOut
    end: LocalTimeOut


class KendaraMatchOut(BaseModel):
    start: LocalTimeOut
    end: LocalTimeOut
    minutes: int
    grade: Literal["exact", "near"]
    near: list[str]  # "lagna" or planet keys that only fit near the edge of their box
    near_text: str | None
    stars: list[StarOut]
    text: str  # when, in one line


class KendaraPlaceOut(BaseModel):
    id: int | None
    name: str | None
    timezone: str
    offset: str


class KendaraResponse(BaseModel):
    status: Literal["ok", "impossible"]
    problems: list[str] = []  # why the drawing cannot happen, in plain words
    rule_set: str
    provisional: bool
    place: KendaraPlaceOut
    first: dt.date
    last: dt.date
    matches: list[KendaraMatchOut] = []
    cut_off: bool = False
    note: str | None = None


def _place(
    body: KendaraRequest, db: Any, lang: Lang
) -> tuple[float, float, str, int | None, str | None]:
    if body.latitude is not None and body.longitude is not None and body.timezone is not None:
        try:
            zoneinfo.ZoneInfo(body.timezone)
        except (zoneinfo.ZoneInfoNotFoundError, ValueError) as error:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown time zone"
            ) from error
        return body.latitude, body.longitude, body.timezone, None, None
    found = get_place(db, body.place_id if body.place_id is not None else COLOMBO)
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown place")
    name = found.name_si if lang == "si" and found.name_si else found.name
    return found.latitude, found.longitude, found.timezone, found.id, name


def _bounds(body: KendaraRequest, zone: zoneinfo.ZoneInfo) -> tuple[dt.datetime, dt.datetime]:
    """The stretch of time to search, in UTC: a known date, or a year range, within 1900 to now."""
    now = (body.as_of or dt.datetime.now(dt.UTC)).astimezone(dt.UTC)
    if body.date is not None:
        first, last = body.date, body.date + dt.timedelta(days=1)
    else:
        first = dt.date(body.year_from or 1900, 1, 1)
        last = (
            dt.date(body.year_to + 1, 1, 1) if body.year_to else now.date() + dt.timedelta(days=1)
        )

    def utc(day: dt.date) -> dt.datetime:
        return dt.datetime.combine(day, dt.time(), zone).astimezone(dt.UTC)

    start = max(utc(first), dt.datetime(1900, 1, 1, tzinfo=dt.UTC))
    return start, min(utc(last), now)


def _when(start: dt.datetime, end: dt.datetime, lang: Lang) -> str:
    text = labels(lang)["kendara"]
    if start.date() == end.date():
        return str(text["window_day"]).format(
            date=format_date(start.date(), lang),
            start=start.strftime("%H:%M"),
            end=end.strftime("%H:%M"),
        )
    return str(text["window_days"]).format(
        start_date=format_date(start.date(), lang),
        start=start.strftime("%H:%M"),
        end_date=format_date(end.date(), lang),
        end=end.strftime("%H:%M"),
    )


def _near_text(near: tuple[Any, ...], lang: Lang) -> str | None:
    if not near:
        return None
    table = labels(lang)
    names = [
        table["kendara"]["lagna"] if item == "lagna" else table["planet"][str(item)]["name"]
        for item in near
    ]
    return str(table["kendara"]["near"]).format(names=", ".join(names))


def _match(match: engine.Match, zone: zoneinfo.ZoneInfo, lang: Lang) -> KendaraMatchOut:
    names = labels(lang)["nakshatra"]
    start, end = match.start.astimezone(zone), match.end.astimezone(zone)
    return KendaraMatchOut(
        start=time_out(match.start, zone),
        end=time_out(match.end, zone),
        minutes=int((match.end - match.start).total_seconds() // 60),
        grade=match.grade,
        near=[str(item) for item in match.near],
        near_text=_near_text(match.near, lang),
        stars=[
            StarOut(
                nakshatra=NAKSHATRA[span.nakshatra],
                name=names[NAKSHATRA[span.nakshatra]],
                pada=span.pada,
                start=time_out(span.start, zone),
                end=time_out(span.end, zone),
            )
            for span in match.stars
        ],
        text=_when(start, end, lang),
    )


@router.post("/v1/kendara/search", response_model=KendaraResponse)
def kendara_search(body: KendaraRequest, db: PlacesDb, _access: Access) -> KendaraResponse:
    """The births between 1900 and now that fit a kendara drawn on paper. The drawing travels
    in the body and is not stored."""
    lang = body.lang
    latitude, longitude, timezone, place_id, place_name = _place(body, db, lang)
    zone = zoneinfo.ZoneInfo(timezone)
    start, end = _bounds(body, zone)
    rules = engine.load_rules()
    rashi = body.rashi.drawing()
    navamsha = body.navamsha.drawing() if body.navamsha else None
    text = labels(lang)["kendara"]
    problems = engine.check_drawing(rashi)
    if navamsha is not None:
        problems += [
            f"navamsha_{code}"
            for code in engine.check_drawing(navamsha)
            if code == "nodes_not_opposite"
        ]
    response = KendaraResponse(
        status="ok",
        rule_set=rules["version"],
        provisional=bool(rules["provisional"]),
        place=KendaraPlaceOut(
            id=place_id,
            name=place_name,
            timezone=timezone,
            offset=offset_label(end.astimezone(zone)),
        ),
        first=start.astimezone(zone).date(),
        last=end.astimezone(zone).date(),
    )
    if problems:
        response.status = "impossible"
        response.problems = [str(text["problem"][code]) for code in problems]
        return response
    if start >= end:
        response.note = str(text["empty_range"])
        return response
    query = engine.Query(
        rashi=rashi,
        navamsha=navamsha,
        latitude=latitude,
        longitude=longitude,
        timezone=timezone,
        start=start,
        end=end,
        nakshatra=NAKSHATRA.index(body.nakshatra) if body.nakshatra else None,
    )
    result = engine.search(EPHEMERIS, load_table(), query, rules)
    response.matches = [_match(match, zone, lang) for match in result.matches]
    response.cut_off = result.cut_off
    if result.cut_off:
        response.note = str(text["cut_off"]).format(count=len(result.matches))
    elif not result.matches:
        response.note = str(text["none"])
    return response
