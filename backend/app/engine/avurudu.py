"""Sinhala and Tamil New Year: the moment the Sun enters Mesha, punya kalaya, and the
official nakath list.

Only the dawn and punya kalaya are calculated. The other nakath come from the official list
of each year (rules/avurudu_v1.yaml) and are never calculated (docs/11).
"""

import zoneinfo
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.engine.ephemeris import Ephemeris
from app.engine.transits import sign_changes
from app.engine.zodiac import RASHI, Body

RULES_DIR = Path(__file__).resolve().parents[1] / "data" / "rules"
DEFAULT_RULES = "avurudu_v1"
MESHA = RASHI.index("mesha")
# Years with a page. Calculated times work for any year in this range.
FIRST_YEAR, LAST_YEAR = 1950, 2100


@lru_cache
def load_rules(version: str = DEFAULT_RULES) -> dict[str, Any]:
    with (RULES_DIR / f"{version}.yaml").open(encoding="utf-8") as handle:
        rules: dict[str, Any] = yaml.safe_load(handle)
    return rules


@dataclass(frozen=True)
class OfficialItem:
    key: str
    at: datetime | None = None  # UTC
    start: datetime | None = None
    end: datetime | None = None
    day: date | None = None  # an item with a day but no time
    colour: str | None = None
    direction: str | None = None


@dataclass(frozen=True)
class Avurudu:
    year: int
    dawn: datetime  # calculated, UTC, to the minute
    punya_start: datetime
    punya_end: datetime
    official: tuple[OfficialItem, ...]  # empty when no official list is known
    source: str | None
    url: str | None
    rule_set: str
    provisional: bool

    def official_item(self, key: str) -> OfficialItem | None:
        return next((item for item in self.official if item.key == key), None)


def _sri_lanka(text: str) -> datetime:
    zone = zoneinfo.ZoneInfo(str(load_rules()["timezone"]))
    return datetime.fromisoformat(text).replace(tzinfo=zone).astimezone(UTC)


def _item(raw: dict[str, Any]) -> OfficialItem:
    return OfficialItem(
        key=str(raw["key"]),
        at=_sri_lanka(raw["at"]) if "at" in raw else None,
        start=_sri_lanka(raw["start"]) if "start" in raw else None,
        end=_sri_lanka(raw["end"]) if "end" in raw else None,
        day=date.fromisoformat(raw["date"]) if "date" in raw else None,
        colour=raw.get("colour"),
        direction=raw.get("direction"),
    )


@lru_cache(maxsize=256)
def _sun_enters_mesha(ephemeris: Ephemeris, year: int) -> datetime:
    """The Sun crosses into Mesha once a year, around 13 or 14 April."""
    found = sign_changes(
        ephemeris,
        datetime(year, 4, 1, tzinfo=UTC),
        datetime(year, 5, 1, tzinfo=UTC),
        bodies=(Body.SUN,),
    )
    return next(change.moment for change in found if change.to_sign == MESHA)


def avurudu(ephemeris: Ephemeris, year: int) -> Avurudu:
    if not FIRST_YEAR <= year <= LAST_YEAR:
        raise ValueError(f"no new year for {year}")
    rules = load_rules()
    dawn = _sun_enters_mesha(ephemeris, year)  # type: ignore[arg-type]
    half = timedelta(minutes=int(rules["punya_kalaya_minutes"]))
    listed = rules["years"].get(year) or {}
    return Avurudu(
        year=year,
        dawn=dawn,
        punya_start=dawn - half,
        punya_end=dawn + half,
        official=tuple(_item(raw) for raw in listed.get("items", [])),
        source=listed.get("source"),
        url=listed.get("url"),
        rule_set=str(rules["version"]),
        provisional=bool(rules["provisional"]),
    )


def official_years() -> list[int]:
    return sorted(int(year) for year in load_rules()["years"])
