"""Shared dependencies for the routers."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends

from app.config import Settings, get_settings
from app.geo.build import ensure_built
from app.store.shares import ShareStore


@lru_cache
def _built_index(path: Path) -> Path:
    return ensure_built(path)


def places_db(settings: Annotated[Settings, Depends(get_settings)]) -> Path:
    return _built_index(settings.places_db)


PlacesDb = Annotated[Path, Depends(places_db)]


@lru_cache
def _share_store(path: Path) -> ShareStore:
    return ShareStore(path)


def share_store(settings: Annotated[Settings, Depends(get_settings)]) -> ShareStore:
    return _share_store(settings.shares_db)


Shares = Annotated[ShareStore, Depends(share_store)]
