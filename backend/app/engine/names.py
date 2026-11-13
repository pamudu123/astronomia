"""Starting letters (akuru) for a baby's name, from the birth star and pada.

The table is in rules/name_letters_si_v1.yaml and is provisional (docs/12-baby-rules.md).
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.engine.chart import Point
from app.engine.ephemeris import Ephemeris, julian_day
from app.engine.zodiac import NAKSHATRA, RASHI

RULES_DIR = Path(__file__).resolve().parents[1] / "data" / "rules"
DEFAULT_RULES = "name_letters_si_v1"


@lru_cache
def load_rules(version: str = DEFAULT_RULES) -> dict[str, Any]:
    with (RULES_DIR / f"{version}.yaml").open(encoding="utf-8") as handle:
        rules: dict[str, Any] = yaml.safe_load(handle)
    return rules


@dataclass(frozen=True)
class Letter:
    star: str
    pada: int
    letter: str  # Sinhala
    latin: str  # English transliteration
    others: tuple[str, ...]  # what other sources give for this pada


def letter_for(star: str, pada: int) -> Letter:
    if star not in NAKSHATRA:
        raise ValueError(f"unknown nakshatra: {star}")
    if not 1 <= pada <= 4:
        raise ValueError(f"pada must be 1 to 4, not {pada}")
    row = load_rules()["stars"][star][pada - 1]
    return Letter(star, pada, str(row["letter"]), str(row["latin"]), tuple(row["others"]))


def star_letters(star: str) -> tuple[Letter, ...]:
    """The four letters of a star, pada 1 first."""
    return tuple(letter_for(star, pada) for pada in range(1, 5))


def lagna_letters(sign: int) -> tuple[str, ...]:
    return tuple(load_rules()["lagna"][RASHI[sign]])


def weekday_letters(weekday: str) -> tuple[str, ...]:
    return tuple(load_rules()["weekday"][weekday])


NEARBY_MINUTES = 15  # the same window as the hadahan birth time check


@dataclass(frozen=True)
class Nearby:
    """The pada the Moon was in a few minutes before or after the given birth time."""

    minutes: int  # how far from the given time the pada changes
    direction: str  # "before" or "after"
    star: str
    pada: int


def nearby_padas(ephemeris: Ephemeris, utc: datetime) -> tuple[Nearby, ...]:
    """Padas reached within 15 minutes of the birth time, nearest change first.

    A pada lasts about six hours, so at most one side changes. The name letter
    follows the pada, so a birth time near a change is worth checking.
    """
    here = Point.at(ephemeris.sun_moon(julian_day(utc))[1])
    found: list[Nearby] = []
    for direction, sign in (("before", -1), ("after", 1)):
        for minutes in range(1, NEARBY_MINUTES + 1):
            moment = utc + sign * timedelta(minutes=minutes)
            moon = Point.at(ephemeris.sun_moon(julian_day(moment))[1])
            if (moon.nakshatra, moon.pada) != (here.nakshatra, here.pada):
                found.append(Nearby(minutes, direction, NAKSHATRA[moon.nakshatra], moon.pada))
                break
    return tuple(sorted(found, key=lambda n: n.minutes))
