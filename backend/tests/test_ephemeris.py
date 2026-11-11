"""Swiss Ephemeris checked against astropy's own built-in ephemeris (independent code)."""

import math
import random
from datetime import UTC, datetime, timedelta

import pytest

from app.engine.ephemeris import SwissEphemeris, julian_day
from app.engine.zodiac import Body

astropy = pytest.importorskip("astropy")
from astropy import units as u  # noqa: E402
from astropy.coordinates import (  # noqa: E402
    GeocentricTrueEcliptic,
    get_body,
    solar_system_ephemeris,
)
from astropy.time import Time  # noqa: E402
from astropy.utils import iers  # noqa: E402

iers.conf.auto_download = False

# astropy's built-in planets come from ERFA's plan94 model, which is less precise for the
# outer planets (tens of arcseconds) than Swiss Ephemeris. These limits are still far below
# anything that could move a planet across a sign or nakshatra boundary (0.025 degrees at most).
TOLERANCE_ARCSEC = {"jupiter": 90.0, "saturn": 90.0}
DEFAULT_TOLERANCE_ARCSEC = 30.0
BODIES = {
    "sun": Body.SUN,
    "moon": Body.MOON,
    "mercury": Body.MERCURY,
    "venus": Body.VENUS,
    "mars": Body.MARS,
    "jupiter": Body.JUPITER,
    "saturn": Body.SATURN,
}

rng = random.Random(2026)
START = datetime(1965, 1, 1, tzinfo=UTC)
MOMENTS = [START + timedelta(days=rng.uniform(0, 55 * 365)) for _ in range(20)]


def arcsec(a: float, b: float) -> float:
    return abs((a - b + 180) % 360 - 180) * 3600


@pytest.fixture(scope="module")
def ephemeris() -> SwissEphemeris:
    return SwissEphemeris()


@pytest.mark.parametrize("moment", MOMENTS, ids=lambda m: m.date().isoformat())
def test_planets_agree_with_astropy(ephemeris: SwissEphemeris, moment: datetime) -> None:
    jd = julian_day(moment)
    positions = ephemeris.positions(jd)
    ayanamsa = ephemeris.ayanamsa(jd)
    when = Time(moment)
    with solar_system_ephemeris.set("builtin"):
        for name, body in BODIES.items():
            other = get_body(name, when).transform_to(GeocentricTrueEcliptic(equinox=when))
            tropical = (positions[body].longitude + ayanamsa) % 360
            limit = TOLERANCE_ARCSEC.get(name, DEFAULT_TOLERANCE_ARCSEC)
            assert arcsec(other.lon.deg, tropical) < limit, name


@pytest.mark.parametrize("moment", MOMENTS[:8], ids=lambda m: m.date().isoformat())
@pytest.mark.parametrize("latitude", [7.29, 51.5, -33.87])
def test_ascendant_agrees_with_formula(
    ephemeris: SwissEphemeris, moment: datetime, latitude: float
) -> None:
    longitude = 80.63
    jd = julian_day(moment)
    when = Time(moment)
    ramc = math.radians(when.sidereal_time("apparent", longitude=longitude * u.deg).to_value(u.deg))
    eps = math.radians(_true_obliquity(when))
    phi = math.radians(latitude)
    asc = (
        math.degrees(
            math.atan2(
                math.cos(ramc), -(math.sin(ramc) * math.cos(eps) + math.tan(phi) * math.sin(eps))
            )
        )
        % 360
    )
    tropical = (ephemeris.ascendant(jd, latitude, longitude) + ephemeris.ayanamsa(jd)) % 360
    assert arcsec(asc, tropical) < 60.0


def _true_obliquity(when: Time) -> float:
    """Mean obliquity plus nutation in obliquity, in degrees (IAU 2006/2000A)."""
    import erfa

    tt = when.tt
    mean = erfa.obl06(tt.jd1, tt.jd2)
    _dpsi, deps = erfa.nut06a(tt.jd1, tt.jd2)
    return math.degrees(mean + deps)


def test_lahiri_ayanamsa_in_2000(ephemeris: SwissEphemeris) -> None:
    value = ephemeris.ayanamsa(julian_day(datetime(2000, 1, 1, tzinfo=UTC)))
    assert value == pytest.approx(23 + 51 / 60, abs=1 / 60)  # about 23 deg 51 min


def test_ketu_is_opposite_rahu(ephemeris: SwissEphemeris) -> None:
    positions = ephemeris.positions(julian_day(datetime(1995, 4, 19, 9, 5, tzinfo=UTC)))
    gap = (positions[Body.KETU].longitude - positions[Body.RAHU].longitude) % 360
    assert gap == pytest.approx(180.0)
