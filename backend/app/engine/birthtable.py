"""The birth table: the almanac at the moment of birth, and the birth star's traditional groups.

Printed horoscopes open with this table (docs/17, chart chapter 1). Everything here reuses
rules the site already has:

- weekday, thithi, yoga and karana: the nakath rules (`panchanga.py`), at the birth moment.
  The weekday is the Sinhala day, which begins at sunrise, so a birth before sunrise belongs
  to the day before.
- gana, yoni, nadi, rajju, bird (pakshi), element (bhuta), tree (vruksha), sage lineage
  (gothra) and linga: the birth star's group in the match rules' tables (`porondam.py`).

Only keys come out of here; the API adds the names in the page's language.
"""

import zoneinfo
from dataclasses import dataclass

from app.engine import panchanga, porondam
from app.engine.chart import Chart
from app.engine.ephemeris import Ephemeris
from app.engine.zodiac import NAKSHATRA, Body

# The star groups shown, in the order printed tables use.
STAR_GROUPS: tuple[str, ...] = (
    "gana",
    "yoni",
    "nadi",
    "rajju",
    "pakshi",
    "bhuta",
    "vruksha",
    "gothra",
    "linga",
)


@dataclass(frozen=True)
class BirthTable:
    weekday: str  # the Sinhala day, from sunrise
    calendar_weekday: str  # the civil date's weekday, as the match's weekday factor counts it
    thithi: str
    yoga: str
    karana: str
    star: dict[str, str]  # group name -> the birth star's group in it, e.g. gana -> deva
    rule_sets: tuple[str, str]  # the nakath rules and the match rules used
    provisional: bool


def star_groups(star: str, version: str = porondam.DEFAULT_RULES) -> dict[str, str]:
    """The birth star's group in each of the match rules' star tables."""
    tables = porondam.load_rules(version)["tables"]
    return {
        name: next(group for group, stars in tables[name].items() if star in stars)
        for name in STAR_GROUPS
    }


def birth_table(ephemeris: Ephemeris, chart: Chart, timezone: str) -> BirthTable:
    sun = chart.planets[Body.SUN].point.longitude
    moon = chart.moon.longitude
    place = panchanga.Place(chart.latitude, chart.longitude, timezone)
    day = panchanga.sinhala_day(ephemeris, chart.utc, place)
    match_rules = porondam.load_rules()
    almanac = panchanga.load_rules()
    return BirthTable(
        weekday=panchanga.WEEKDAYS[day.weekday()],
        calendar_weekday=panchanga.WEEKDAYS[
            chart.utc.astimezone(zoneinfo.ZoneInfo(timezone)).date().weekday()
        ],
        thithi=panchanga.THITHI_KEYS[panchanga.thithi_index(sun, moon)],
        yoga=panchanga.YOGA_KEYS[panchanga.yoga_index(sun, moon)],
        karana=panchanga.karana_key(panchanga.karana_index(sun, moon)),
        star=star_groups(NAKSHATRA[chart.moon.nakshatra]),
        rule_sets=(str(almanac["version"]), str(match_rules["version"])),
        provisional=bool(almanac["provisional"]) or bool(match_rules["provisional"]),
    )
