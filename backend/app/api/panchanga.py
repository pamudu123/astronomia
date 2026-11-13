"""The daily panchanga for any place and date (free).

A place and a date are not birth details, so this is a GET that browsers and caches may keep.
Every time is given in UTC and in the place's own time zone, with the offset.
"""

import datetime as dt
import zoneinfo
from typing import Annotated, Self

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, model_validator

from app.api.charts import EPHEMERIS
from app.api.deps import PlacesDb
from app.engine.panchanga import DayPanchanga, Place, Span, day_panchanga
from app.engine.timeconv import MAX_YEAR, MIN_YEAR
from app.explain.labels import Lang, labels
from app.geo.search import get_place

router = APIRouter(tags=["nakath"])

# The answer depends only on the place, the date and the rules.
CACHE = {"Cache-Control": "public, max-age=3600"}


class LocalTimeOut(BaseModel):
    utc: dt.datetime
    local: dt.datetime  # with the place's UTC offset
    clock: str  # "06:00", the local time as printed
    date: dt.date  # the local date


class PanchangaPartOut(BaseModel):
    key: str
    number: int  # as almanacs count: thithi 1 to 30, nakatha 1 to 27, yoga 1 to 27
    name: str
    start: LocalTimeOut
    end: LocalTimeOut


class LocalRangeOut(BaseModel):
    start: LocalTimeOut
    end: LocalTimeOut


class PanchangaPlaceOut(BaseModel):
    id: int | None
    name: str | None
    latitude: float
    longitude: float
    timezone: str


class PanchangaResponse(BaseModel):
    rule_set: str
    provisional: bool
    date: dt.date
    place: PanchangaPlaceOut
    offset: str  # "UTC+05:30" on that date
    timezone_note: str
    weekday: str
    weekday_name: str
    sunrise: LocalTimeOut | None  # None where the Sun does not rise that day
    sunset: LocalTimeOut | None
    next_sunrise: LocalTimeOut | None
    rahu_kalaya: LocalRangeOut | None
    thithi: list[PanchangaPartOut]  # every part from this sunrise to the next
    nakatha: list[PanchangaPartOut]
    yoga: list[PanchangaPartOut]
    karana: list[PanchangaPartOut]


class PanchangaQuery(BaseModel):
    date: dt.date
    place_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    timezone: str | None = None
    lang: Lang = "en"

    @model_validator(mode="after")
    def one_location(self) -> Self:
        manual = [self.latitude, self.longitude, self.timezone]
        if self.place_id is not None and any(v is not None for v in manual):
            raise ValueError("give either place_id or latitude, longitude and timezone")
        if self.place_id is None and any(v is None for v in manual):
            raise ValueError("give place_id, or all of latitude, longitude and timezone")
        return self


def offset_label(moment: dt.datetime) -> str:
    offset = moment.utcoffset() or dt.timedelta(0)
    minutes = int(offset.total_seconds() // 60)
    sign = "+" if minutes >= 0 else "-"
    return f"UTC{sign}{abs(minutes) // 60:02d}:{abs(minutes) % 60:02d}"


def time_out(moment: dt.datetime, zone: zoneinfo.ZoneInfo) -> LocalTimeOut:
    local = moment.astimezone(zone)
    return LocalTimeOut(utc=moment, local=local, clock=local.strftime("%H:%M"), date=local.date())


def _spans(
    spans: tuple[Span, ...], part: str, lang: Lang, zone: zoneinfo.ZoneInfo
) -> list[PanchangaPartOut]:
    names = labels(lang)["nakshatra" if part == "nakatha" else part]
    return [
        PanchangaPartOut(
            key=span.key,
            number=span.number,
            name=names[span.key],
            start=time_out(span.start, zone),
            end=time_out(span.end, zone),
        )
        for span in spans
    ]


def panchanga_out(
    result: DayPanchanga, lang: Lang, place_id: int | None = None, name: str | None = None
) -> PanchangaResponse:
    zone = zoneinfo.ZoneInfo(result.place.timezone)
    table = labels(lang)
    noon = dt.datetime.combine(result.day, dt.time(12), tzinfo=zone)
    offset = offset_label(noon)

    def maybe(moment: dt.datetime | None) -> LocalTimeOut | None:
        return None if moment is None else time_out(moment, zone)

    rahu = None
    if result.rahu_kalaya is not None:
        rahu = LocalRangeOut(
            start=time_out(result.rahu_kalaya[0], zone), end=time_out(result.rahu_kalaya[1], zone)
        )
    return PanchangaResponse(
        rule_set=result.rule_set,
        provisional=result.provisional,
        date=result.day,
        place=PanchangaPlaceOut(
            id=place_id,
            name=name,
            latitude=result.place.latitude,
            longitude=result.place.longitude,
            timezone=result.place.timezone,
        ),
        offset=offset,
        timezone_note=table["panchanga"]["timezone"].format(
            timezone=result.place.timezone, offset=offset
        ),
        weekday=result.weekday,
        weekday_name=table["weekday"][result.weekday],
        sunrise=maybe(result.sunrise),
        sunset=maybe(result.sunset),
        next_sunrise=maybe(result.next_sunrise),
        rahu_kalaya=rahu,
        thithi=_spans(result.thithi, "thithi", lang, zone),
        nakatha=_spans(result.nakatha, "nakatha", lang, zone),
        yoga=_spans(result.yoga, "yoga", lang, zone),
        karana=_spans(result.karana, "karana", lang, zone),
    )


def resolve_place(
    query: PanchangaQuery, db: PlacesDb, lang: Lang
) -> tuple[Place, int | None, str | None]:
    if query.place_id is not None:
        found = get_place(db, query.place_id)
        if found is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown place")
        name = found.name_si if lang == "si" and found.name_si else found.name
        return Place(found.latitude, found.longitude, found.timezone), found.id, name
    assert query.latitude is not None and query.longitude is not None
    assert query.timezone is not None
    try:
        zoneinfo.ZoneInfo(query.timezone)
    except (zoneinfo.ZoneInfoNotFoundError, ValueError) as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown time zone") from error
    return Place(query.latitude, query.longitude, query.timezone), None, None


@router.get("/v1/panchanga", response_model=PanchangaResponse)
def panchanga(
    query: Annotated[PanchangaQuery, Query()], response: Response, db: PlacesDb
) -> PanchangaResponse:
    """Sunrise, Rahu kalaya, thithi, nakatha, yoga and karana for the day beginning at sunrise."""
    if not MIN_YEAR <= query.date.year <= MAX_YEAR:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "year out of range")
    if query.latitude is not None and not -90 < query.latitude < 90:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "latitude out of range")
    if query.longitude is not None and not -180 <= query.longitude <= 180:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "longitude out of range")
    place, place_id, name = resolve_place(query, db, query.lang)
    result = day_panchanga(EPHEMERIS, query.date, place)
    response.headers.update(CACHE)
    return panchanga_out(result, query.lang, place_id, name)
