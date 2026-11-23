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
    # How many free reports one account (guest or Google) may keep at a time (docs/18, section
    # 3). Each is deleted 7 days after saving; paid reports count against paid_saved_limit.
    free_saved_limit: int = 20
    # How many new guest accounts one address may make in an hour.
    guests_per_hour: int = 30
    # Paid reports (docs/18). Off: everyone gets every feature, as before. On: the AI reading,
    # explain buttons, full detail and full PDF show only on reports the account paid for.
    # Switch it on once Google sign in is live, since only a Google account can unlock a report.
    paid_reports: bool = False
    # Orders and coupons, when SQLite is used.
    orders_db: Path = VAR_DIR / "orders.sqlite"
    # The buyer's country, for the price, when the request does not say (local runs, no
    # Vercel). Sri Lanka, where most buyers are.
    default_country: str = "LK"
    # Wrong coupon codes one account may try in an hour.
    coupon_misses_per_hour: int = 10
    # How many paid reports one account may keep: a safety limit, not a product one.
    paid_saved_limit: int = 1000
    # The site's own addresses (for example https://sidera.lk). A request that changes stored
    # data must come from one of these, or from the address it was sent to.
    site_origins: tuple[str, ...] = ()
    # PostgreSQL for share links and accounts on hosts without a lasting disk. When empty,
    # SQLite is used. Required in production, where accounts must last.
    database_url: str = ""
    # Supabase Auth (docs/19): the project address, for the public keys that sign access tokens,
    # for example https://abcd.supabase.co. Empty: nobody can sign in.
    supabase_url: str = ""
    # Supabase's secret key (sb_secret_...), used only to delete a user from Supabase Auth when
    # they delete their account. Secret: set in the host's dashboard or backend/.env, never here.
    supabase_secret_key: str = ""
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
