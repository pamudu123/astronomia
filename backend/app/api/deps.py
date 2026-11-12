"""Shared dependencies for the routers."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends

from app.config import Settings, get_settings
from app.geo.build import ensure_built
from app.store.shares import PostgresShareStore, ShareStore, Store


@lru_cache
def _built_index(path: Path) -> Path:
    return ensure_built(path)


def places_db(settings: Annotated[Settings, Depends(get_settings)]) -> Path:
    return _built_index(settings.places_db)


PlacesDb = Annotated[Path, Depends(places_db)]


@lru_cache
def _sqlite_store(path: Path) -> Store:
    return ShareStore(path)


@lru_cache
def _postgres_store(url: str) -> Store:
    return PostgresShareStore(url)


def share_store(settings: Annotated[Settings, Depends(get_settings)]) -> Store:
    if settings.database_url:
        return _postgres_store(settings.database_url)
    return _sqlite_store(settings.shares_db)


Shares = Annotated[Store, Depends(share_store)]
