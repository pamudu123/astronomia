"""Birth details shared by the chart endpoints, and turning them into UTC and coordinates."""

import datetime as dt
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Self

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, model_validator

from app.api.timeresolve import TimeResolveResponse, to_response
from app.engine.timeconv import TimeConversionError, TimeStatus, resolve_local_time
from app.geo.search import Place, get_place


class BirthInput(BaseModel):
    """Birth details travel in the request body, never in the URL."""

    date: dt.date
    time: dt.time
    place_id: int | None = Field(default=None, description="A place id from /v1/places")
    latitude: float | None = Field(default=None, gt=-90, lt=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str | None = Field(default=None, description="Needed with latitude and longitude")
    fold: Literal[0, 1] | None = None

    @model_validator(mode="after")
    def one_location(self) -> Self:
        manual = [self.latitude, self.longitude, self.timezone]
        if self.place_id is not None and any(v is not None for v in manual):
            raise ValueError("give either place_id or latitude, longitude and timezone")
        if self.place_id is None and any(v is None for v in manual):
            raise ValueError("give place_id, or all of latitude, longitude and timezone")
        return self


@dataclass(frozen=True)
class ResolvedBirth:
    time: TimeResolveResponse
    utc: dt.datetime | None
    latitude: float
    longitude: float
    place: Place | None = None  # None when coordinates were given


def resolve_birth(body: BirthInput, places_db: Path) -> ResolvedBirth:
    latitude, longitude, timezone = body.latitude, body.longitude, body.timezone
    place = None
    if body.place_id is not None:
        place = get_place(places_db, body.place_id)
        if place is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown place")
        latitude, longitude, timezone = place.latitude, place.longitude, place.timezone
    assert latitude is not None and longitude is not None and timezone is not None
    try:
        result = resolve_local_time(body.date, body.time, timezone, body.fold)
    except TimeConversionError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)) from error
    utc = result.utc if result.status is TimeStatus.OK else None
    return ResolvedBirth(to_response(result), utc, latitude, longitude, place)
