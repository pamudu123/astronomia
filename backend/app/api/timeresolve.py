"""Turn a local birth time and place into UTC."""

import datetime as dt
from typing import Literal, Self

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from app.api.deps import PlacesDb
from app.engine.timeconv import (
    TimeConversionError,
    TimeOption,
    TimeResolution,
    TimeStatus,
    format_offset,
    resolve_local_time,
)
from app.geo.search import get_place

router = APIRouter(tags=["time"])


class TimeResolveRequest(BaseModel):
    """Birth details travel in the request body, never in the URL."""

    date: dt.date
    time: dt.time
    place_id: int | None = Field(default=None, description="A place id from /v1/places")
    timezone: str | None = Field(default=None, description="An IANA time zone, e.g. Asia/Colombo")
    fold: Literal[0, 1] | None = Field(
        default=None,
        description="Only when a clock change makes the time ambiguous or nonexistent: "
        "0 = the earlier offset, 1 = the later offset",
    )

    @model_validator(mode="after")
    def one_location(self) -> Self:
        if (self.place_id is None) == (self.timezone is None):
            raise ValueError("give either place_id or timezone, not both")
        return self


class OffsetOption(BaseModel):
    fold: Literal[0, 1]
    utc: dt.datetime
    offset_seconds: int
    offset_label: str
    abbreviation: str

    @classmethod
    def of(cls, option: TimeOption) -> "OffsetOption":
        return cls(
            fold=option.fold,
            utc=option.utc,
            offset_seconds=option.offset_seconds,
            offset_label=format_offset(option.offset_seconds),
            abbreviation=option.abbreviation,
        )


class TimeResolveResponse(BaseModel):
    status: TimeStatus
    timezone: str
    local: dt.datetime
    utc: dt.datetime | None
    offset_seconds: int | None
    offset_label: str | None
    abbreviation: str | None
    clock_change: TimeStatus | None
    options: list[OffsetOption]


@router.post("/v1/time/resolve", response_model=TimeResolveResponse)
def resolve_time(body: TimeResolveRequest, db: PlacesDb) -> TimeResolveResponse:
    timezone = body.timezone
    if body.place_id is not None:
        place = get_place(db, body.place_id)
        if place is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown place")
        timezone = place.timezone
    assert timezone is not None
    try:
        result = resolve_local_time(body.date, body.time, timezone, body.fold)
    except TimeConversionError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
    return to_response(result)


def to_response(result: TimeResolution) -> TimeResolveResponse:
    return TimeResolveResponse(
        status=result.status,
        timezone=result.timezone,
        local=result.local,
        utc=result.utc,
        offset_seconds=result.offset_seconds,
        offset_label=format_offset(result.offset_seconds)
        if result.offset_seconds is not None
        else None,
        abbreviation=result.abbreviation,
        clock_change=result.clock_change,
        options=[OffsetOption.of(o) for o in result.options],
    )
