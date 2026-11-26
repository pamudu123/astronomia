"""The Sun and Moon at any moment, read from a smooth curve instead of Swiss Ephemeris.

A month of panchanga asks where the Sun and Moon are more than 12,000 times. Both move so
smoothly that a Chebyshev curve through ten exact positions gives a whole day's motion to about
0.00000001 degrees: less than a thousandth of a second in the time of any thithi, nakatha, yoga
or karana change, where the search itself stops at 15 seconds.
"""

import math
from functools import lru_cache

from app.engine.ephemeris import Ephemeris
from app.engine.zodiac import normalize

_NODES = 10
_DAYS_KEPT = 4096  # about 11 years of days, a few MB

# The moments of a day (-1 to 1) where the exact positions are taken.
_AT = tuple(math.cos(math.pi * (k + 0.5) / _NODES) for k in range(_NODES))
_WEIGHTS = tuple(
    tuple(2 / _NODES * math.cos(math.pi * j * (k + 0.5) / _NODES) for k in range(_NODES))
    for j in range(_NODES)
)

Curve = tuple[float, ...]


def _fit(longitudes: list[float]) -> Curve:
    """The curve's terms, highest first, ready for _read()."""
    # Unwrapped, so a day that crosses 360 degrees has no jump in it.
    first = longitudes[0]
    values = [first + ((value - first + 180.0) % 360.0 - 180.0) for value in longitudes]
    terms = [
        sum(weight * value for weight, value in zip(row, values, strict=True)) for row in _WEIGHTS
    ]
    terms[0] /= 2
    return tuple(reversed(terms))


def _read(curve: Curve, x: float) -> float:
    """Clenshaw's sum of the Chebyshev terms."""
    twice = 2.0 * x
    b1 = b2 = 0.0
    for term in curve[:-1]:
        b1, b2 = twice * b1 - b2 + term, b1
    return x * b1 - b2 + curve[-1]


@lru_cache(maxsize=_DAYS_KEPT)
def _day(ephemeris: Ephemeris, day: int) -> tuple[Curve, Curve]:
    positions = [ephemeris.sun_moon(day + (x + 1.0) / 2.0) for x in _AT]
    return _fit([sun for sun, _ in positions]), _fit([moon for _, moon in positions])


def sun_moon(ephemeris: Ephemeris, jd_ut: float) -> tuple[float, float]:
    """Sidereal longitudes of the Sun and Moon, as Ephemeris.sun_moon() gives them."""
    day = math.floor(jd_ut)
    sun, moon = _day(ephemeris, day)
    x = 2.0 * (jd_ut - day) - 1.0
    return normalize(_read(sun, x)), normalize(_read(moon, x))
