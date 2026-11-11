"""Place search."""

from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.deps import PlacesDb
from app.geo.search import MAX_LIMIT, Place, search

router = APIRouter(tags=["places"])


class PlaceOut(BaseModel):
    id: int
    name: str
    name_si: str | None
    country_code: str
    country_name: str
    country_name_si: str | None
    region: str | None
    region_si: str | None
    latitude: float
    longitude: float
    timezone: str
    population: int

    @classmethod
    def of(cls, place: Place) -> "PlaceOut":
        return cls(**place.__dict__)


class PlaceList(BaseModel):
    places: list[PlaceOut]


@router.get("/v1/places", response_model=PlaceList)
def find_places(
    db: PlacesDb,
    q: Annotated[str, Query(min_length=2, max_length=64, description="Place name, any script")],
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = 10,
) -> PlaceList:
    return PlaceList(places=[PlaceOut.of(p) for p in search(db, q, limit)])
