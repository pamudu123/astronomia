"""Service information: health and what the API supports."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app import __version__
from app.config import Settings, get_settings

router = APIRouter()


class Health(BaseModel):
    status: str


class Meta(BaseModel):
    version: str
    languages: list[str]
    default_language: str


@router.get("/healthz", response_model=Health, tags=["meta"])
def healthz() -> Health:
    return Health(status="ok")


@router.get("/v1/meta", response_model=Meta, tags=["meta"])
def meta(settings: Annotated[Settings, Depends(get_settings)]) -> Meta:
    return Meta(
        version=__version__,
        languages=list(settings.languages),
        default_language=settings.default_language,
    )
