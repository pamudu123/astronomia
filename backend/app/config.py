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
    # Accounts and saved reports (docs/16), when SQLite is used.
    accounts_db: Path = VAR_DIR / "accounts.sqlite"
    # How many reports a guest account may keep.
    guest_saved_limit: int = 100
    # How many new guest accounts one address may make in an hour.
    guests_per_hour: int = 30
    # The site's own addresses (for example https://sidera.lk). A request that changes stored
    # data must come from one of these, or from the address it was sent to.
    site_origins: tuple[str, ...] = ()
    # PostgreSQL for share links and accounts on hosts without a lasting disk. When empty,
    # SQLite is used. Required in production, where accounts must last.
    database_url: str = ""
    # Supabase Auth (docs/19): the project address, for the public keys that sign access tokens,
    # for example https://abcd.supabase.co. Empty: nobody can sign in.
    supabase_url: str = ""
    # When set, every request except /healthz must carry this key in X-Access-Key.
    # Used to keep a staging backend private. Empty means open, as in local runs.
    access_key: str = ""

    @property
    def secure_cookies(self) -> bool:
        """Cookies are https only everywhere but on a developer's own computer."""
        return self.environment != "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
