"""Fixed tables of the sidereal zodiac: rashi, nakshatra and the nine planets.

Only keys live here. Names in Sinhala and English come from the label files (step 9).
"""

import math
from enum import StrEnum


class Body(StrEnum):
    SUN = "sun"
    MOON = "moon"
    MARS = "mars"
    MERCURY = "mercury"
    JUPITER = "jupiter"
    VENUS = "venus"
    SATURN = "saturn"
    RAHU = "rahu"
    KETU = "ketu"


BODIES: tuple[Body, ...] = tuple(Body)

RASHI: tuple[str, ...] = (
    "mesha",
    "vrishabha",
    "mithuna",
    "kataka",
    "simha",
    "kanya",
    "tula",
    "vrischika",
    "dhanu",
    "makara",
    "kumbha",
    "meena",
)

RASHI_LORD: tuple[Body, ...] = (
    Body.MARS,
    Body.VENUS,
    Body.MERCURY,
    Body.MOON,
    Body.SUN,
    Body.MERCURY,
    Body.VENUS,
    Body.MARS,
    Body.JUPITER,
    Body.SATURN,
    Body.SATURN,
    Body.JUPITER,
)

NAKSHATRA: tuple[str, ...] = (
    "ashwini",
    "bharani",
    "krittika",
    "rohini",
    "mrigashira",
    "ardra",
    "punarvasu",
    "pushya",
    "ashlesha",
    "magha",
    "purva_phalguni",
    "uttara_phalguni",
    "hasta",
    "chitra",
    "swati",
    "vishakha",
    "anuradha",
    "jyeshtha",
    "mula",
    "purva_ashadha",
    "uttara_ashadha",
    "shravana",
    "dhanishta",
    "shatabhisha",
    "purva_bhadrapada",
    "uttara_bhadrapada",
    "revati",
)

# Vimshottari lords repeat every nine nakshatra, starting with Ketu at Ashwini.
_LORD_CYCLE = (
    Body.KETU,
    Body.VENUS,
    Body.SUN,
    Body.MOON,
    Body.MARS,
    Body.RAHU,
    Body.JUPITER,
    Body.SATURN,
    Body.MERCURY,
)
NAKSHATRA_LORD: tuple[Body, ...] = tuple(_LORD_CYCLE[i % 9] for i in range(27))

DEGREES_PER_SIGN = 30.0
DEGREES_PER_NAKSHATRA = 360.0 / 27  # 13 deg 20 min
DEGREES_PER_PADA = 360.0 / 108  # 3 deg 20 min, also one navamsha


def normalize(longitude: float) -> float:
    value = longitude % 360.0
    return 0.0 if value >= 360.0 else value


def sign_index(longitude: float) -> int:
    """0 = Mesha ... 11 = Meena."""
    return math.floor(normalize(longitude) / DEGREES_PER_SIGN) % 12


def degree_in_sign(longitude: float) -> float:
    return normalize(longitude) - sign_index(longitude) * DEGREES_PER_SIGN


def _pada_number(longitude: float) -> int:
    """0 to 107 around the zodiac. Multiplying first keeps exact boundaries exact."""
    return math.floor(normalize(longitude) * 108 / 360) % 108


def nakshatra_index(longitude: float) -> int:
    """0 = Ashwini ... 26 = Revati."""
    return _pada_number(longitude) // 4


def pada(longitude: float) -> int:
    """1 to 4."""
    return _pada_number(longitude) % 4 + 1


def navamsha_sign_index(longitude: float) -> int:
    """The D9 sign. Each sign is split into nine parts of 3 deg 20 min, counted on from Mesha."""
    return _pada_number(longitude) % 12


def whole_sign_house(sign: int, lagna_sign: int) -> int:
    """1 to 12, the house counted from the lagna sign."""
    return (sign - lagna_sign) % 12 + 1
