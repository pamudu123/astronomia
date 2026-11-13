"""Planet positions and the ascendant, from Swiss Ephemeris.

Everything behind the `Ephemeris` interface, so the library can be swapped later (for example
if the licence decision goes another way) without touching the chart code.

Swiss Ephemeris keeps global state and is not thread safe, so every call holds a lock.
"""

import threading
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol

import swisseph as swe

from app.engine.zodiac import Body, normalize


class Ayanamsa(StrEnum):
    LAHIRI = "lahiri"


class NodeType(StrEnum):
    MEAN = "mean"
    TRUE = "true"


# Sunrise is when the upper edge of the Sun clears the horizon, with the usual refraction.
# This is the definition the civil tables use, and the one porondam.lk matches to the minute
# (docs/11-nakath-rules.md). The other choice, the centre of the disc without refraction,
# comes about four minutes later in Colombo.
_RISE_FLAGS = 0
_STANDARD_PRESSURE = 1013.25  # hPa
_STANDARD_TEMPERATURE = 15.0  # degrees Celsius

_SID_MODES = {Ayanamsa.LAHIRI: swe.SIDM_LAHIRI}

_PLANETS = {
    Body.SUN: swe.SUN,
    Body.MOON: swe.MOON,
    Body.MARS: swe.MARS,
    Body.MERCURY: swe.MERCURY,
    Body.JUPITER: swe.JUPITER,
    Body.VENUS: swe.VENUS,
    Body.SATURN: swe.SATURN,
}


@dataclass(frozen=True)
class BodyPosition:
    body: Body
    longitude: float  # sidereal, degrees 0 to 360
    latitude: float
    speed: float  # degrees per day, negative when retrograde


class Ephemeris(Protocol):
    @property
    def description(self) -> str: ...

    def ayanamsa(self, jd_ut: float) -> float: ...

    def positions(self, jd_ut: float) -> dict[Body, BodyPosition]: ...

    def ascendant(self, jd_ut: float, latitude: float, longitude: float) -> float: ...

    def sun_moon(self, jd_ut: float) -> tuple[float, float]: ...

    def sunrise(self, jd_ut: float, latitude: float, longitude: float) -> float | None: ...

    def sunset(self, jd_ut: float, latitude: float, longitude: float) -> float | None: ...


def julian_day(moment: datetime) -> float:
    """UT Julian day for an aware datetime."""
    utc = moment.astimezone(UTC)
    hours = utc.hour + utc.minute / 60 + (utc.second + utc.microsecond / 1e6) / 3600
    return float(swe.julday(utc.year, utc.month, utc.day, hours, swe.GREG_CAL))


class SwissEphemeris:
    _lock = threading.Lock()

    def __init__(
        self, ayanamsa: Ayanamsa = Ayanamsa.LAHIRI, node: NodeType = NodeType.MEAN
    ) -> None:
        self.ayanamsa_type = ayanamsa
        self.node = node
        self._mode = "unknown"

    @property
    def description(self) -> str:
        """Which data the last calculation used: Swiss Ephemeris files or the Moshier model."""
        return self._mode

    def _sidereal(self) -> None:
        swe.set_sid_mode(_SID_MODES[self.ayanamsa_type], 0, 0)

    def ayanamsa(self, jd_ut: float) -> float:
        with self._lock:
            self._sidereal()
            return float(swe.get_ayanamsa_ut(jd_ut))

    def positions(self, jd_ut: float) -> dict[Body, BodyPosition]:
        flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED
        result: dict[Body, BodyPosition] = {}
        with self._lock:
            self._sidereal()
            for body, code in _PLANETS.items():
                values, used = swe.calc_ut(jd_ut, code, flags)
                result[body] = BodyPosition(body, normalize(values[0]), values[1], values[3])
                self._mode = "moshier" if used & swe.FLG_MOSEPH else "swiss_ephemeris_files"
            node_code = swe.MEAN_NODE if self.node is NodeType.MEAN else swe.TRUE_NODE
            values, _ = swe.calc_ut(jd_ut, node_code, flags)
        rahu = normalize(values[0])
        result[Body.RAHU] = BodyPosition(Body.RAHU, rahu, 0.0, values[3])
        result[Body.KETU] = BodyPosition(Body.KETU, normalize(rahu + 180.0), 0.0, values[3])
        return result

    def ascendant(self, jd_ut: float, latitude: float, longitude: float) -> float:
        with self._lock:
            self._sidereal()
            _cusps, angles = swe.houses_ex(jd_ut, latitude, longitude, b"W", swe.FLG_SIDEREAL)
        return normalize(angles[0])

    def sun_moon(self, jd_ut: float) -> tuple[float, float]:
        """Sidereal longitudes of the Sun and Moon only, for the many panchanga searches."""
        flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL
        with self._lock:
            self._sidereal()
            sun, _ = swe.calc_ut(jd_ut, swe.SUN, flags)
            moon, _ = swe.calc_ut(jd_ut, swe.MOON, flags)
        return normalize(sun[0]), normalize(moon[0])

    def _rise_or_set(
        self, event: int, jd_ut: float, latitude: float, longitude: float
    ) -> float | None:
        """The first sunrise or sunset after jd_ut, or None where the Sun stays up or down."""
        with self._lock:
            result, times = swe.rise_trans(
                jd_ut,
                swe.SUN,
                event | _RISE_FLAGS,
                (longitude, latitude, 0.0),
                _STANDARD_PRESSURE,
                _STANDARD_TEMPERATURE,
            )
        return None if result != 0 else float(times[0])

    def sunrise(self, jd_ut: float, latitude: float, longitude: float) -> float | None:
        return self._rise_or_set(swe.CALC_RISE, jd_ut, latitude, longitude)

    def sunset(self, jd_ut: float, latitude: float, longitude: float) -> float | None:
        return self._rise_or_set(swe.CALC_SET, jd_ut, latitude, longitude)
