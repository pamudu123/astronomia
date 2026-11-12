"""Settings read from environment variables (prefix ASTRONOMIA_)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.geo.build import DEFAULT_DB

# Writable folder for stored data (share links). Kept out of the source folders.
VAR_DIR = Path(__file__).resolve().parents[1] / "var"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ASTRONOMIA_", env_file=".env", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"
    languages: tuple[str, ...] = ("si", "en")
    default_language: str = "en"
    # The place search index. Built on first use if missing or out of date.
    places_db: Path = DEFAULT_DB
    # Share links: where snapshots are kept, and for how many days a link stays open.
    shares_db: Path = VAR_DIR / "shares.sqlite"
    share_days: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
