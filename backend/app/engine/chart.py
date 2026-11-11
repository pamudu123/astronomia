"""The birth chart (hadahan): lagna, the nine planets, nakshatra, houses and navamsha."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.engine.ephemeris import Ephemeris, julian_day
from app.engine.zodiac import (
    BODIES,
    Body,
    degree_in_sign,
    nakshatra_index,
    navamsha_sign_index,
    pada,
    sign_index,
    whole_sign_house,
)

HOUSE_SYSTEM = "whole_sign"
TIME_CHECK_MINUTES = (5, 15)

# Sun and Moon never go retrograde. Rahu and Ketu are always counted as retrograde.
_NEVER_RETROGRADE = {Body.SUN, Body.MOON}
_ALWAYS_RETROGRADE = {Body.RAHU, Body.KETU}


@dataclass(frozen=True)
class Point:
    """A position on the zodiac with everything derived from it."""

    longitude: float
    sign: int
    degree: float
    nakshatra: int
    pada: int
    navamsha_sign: int

    @classmethod
    def at(cls, longitude: float) -> "Point":
        return cls(
            longitude=longitude,
            sign=sign_index(longitude),
            degree=degree_in_sign(longitude),
            nakshatra=nakshatra_index(longitude),
            pada=pada(longitude),
            navamsha_sign=navamsha_sign_index(longitude),
        )


@dataclass(frozen=True)
class Placement:
    body: Body
    point: Point
    house: int
    navamsha_house: int
    retrograde: bool
    speed: float


@dataclass(frozen=True)
class TimeSensitivity:
    """Whether a nearby birth time would change a key part of the chart."""

    lagna_changes_within: int | None  # minutes, or None if stable within 15
    nakshatra_changes_within: int | None
    pada_changes_within: int | None

    @property
    def stable(self) -> bool:
        return self.lagna_changes_within is None and self.nakshatra_changes_within is None


@dataclass(frozen=True)
class Method:
    ayanamsa: str
    ayanamsa_degrees: float
    node: str
    house_system: str
    ephemeris: str


@dataclass(frozen=True)
class Chart:
    utc: datetime
    latitude: float
    longitude: float
    lagna: Point
    planets: dict[Body, Placement]
    time_check: TimeSensitivity
    method: Method

    @property
    def moon(self) -> Point:
        return self.planets[Body.MOON].point


def _core(ephemeris: Ephemeris, utc: datetime, lat: float, lon: float) -> tuple[Point, Point]:
    jd = julian_day(utc)
    lagna = Point.at(ephemeris.ascendant(jd, lat, lon))
    moon = Point.at(ephemeris.positions(jd)[Body.MOON].longitude)
    return lagna, moon


def _time_check(
    ephemeris: Ephemeris, utc: datetime, lat: float, lon: float, lagna: Point, moon: Point
) -> TimeSensitivity:
    lagna_at = nak_at = pada_at = None
    for minutes in TIME_CHECK_MINUTES:
        for sign in (-1, 1):
            other_lagna, other_moon = _core(
                ephemeris, utc + sign * timedelta(minutes=minutes), lat, lon
            )
            if lagna_at is None and other_lagna.sign != lagna.sign:
                lagna_at = minutes
            if nak_at is None and other_moon.nakshatra != moon.nakshatra:
                nak_at = minutes
            if pada_at is None and (other_moon.nakshatra, other_moon.pada) != (
                moon.nakshatra,
                moon.pada,
            ):
                pada_at = minutes
    return TimeSensitivity(lagna_at, nak_at, pada_at)


def compute_chart(ephemeris: Ephemeris, utc: datetime, latitude: float, longitude: float) -> Chart:
    if utc.tzinfo is None:
        raise ValueError("utc must be timezone aware")
    utc = utc.astimezone(UTC)
    if not -90.0 < latitude < 90.0 or not -180.0 <= longitude <= 180.0:
        raise ValueError("latitude must be between -90 and 90, longitude between -180 and 180")

    jd = julian_day(utc)
    positions = ephemeris.positions(jd)
    lagna = Point.at(ephemeris.ascendant(jd, latitude, longitude))

    planets: dict[Body, Placement] = {}
    for body in BODIES:
        position = positions[body]
        point = Point.at(position.longitude)
        if body in _ALWAYS_RETROGRADE:
            retrograde = True
        elif body in _NEVER_RETROGRADE:
            retrograde = False
        else:
            retrograde = position.speed < 0
        planets[body] = Placement(
            body=body,
            point=point,
            house=whole_sign_house(point.sign, lagna.sign),
            navamsha_house=whole_sign_house(point.navamsha_sign, lagna.navamsha_sign),
            retrograde=retrograde,
            speed=position.speed,
        )

    moon = planets[Body.MOON].point
    method = Method(
        ayanamsa=getattr(ephemeris, "ayanamsa_type", "lahiri"),
        ayanamsa_degrees=ephemeris.ayanamsa(jd),
        node=str(getattr(ephemeris, "node", "mean")),
        house_system=HOUSE_SYSTEM,
        ephemeris=ephemeris.description,
    )
    return Chart(
        utc=utc,
        latitude=latitude,
        longitude=longitude,
        lagna=lagna,
        planets=planets,
        time_check=_time_check(ephemeris, utc, latitude, longitude, lagna, moon),
        method=method,
    )
