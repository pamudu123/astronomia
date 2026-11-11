"""Settings read from environment variables (prefix ASTRONOMIA_)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.geo.build import DEFAULT_DB


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ASTRONOMIA_", env_file=".env", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"
    languages: tuple[str, ...] = ("si", "en")
    default_language: str = "en"
    # The place search index. Built on first use if missing or out of date.
    places_db: Path = DEFAULT_DB


@lru_cache
def get_settings() -> Settings:
    return Settings()
