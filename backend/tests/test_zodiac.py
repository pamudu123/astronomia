import pytest

from app.engine.zodiac import (
    NAKSHATRA,
    NAKSHATRA_LORD,
    RASHI,
    Body,
    degree_in_sign,
    nakshatra_index,
    navamsha_sign_index,
    pada,
    sign_index,
    whole_sign_house,
)

NAK = 360 / 27
PADA = 360 / 108


def test_tables() -> None:
    assert len(RASHI) == 12
    assert len(NAKSHATRA) == 27
    assert NAKSHATRA_LORD[0] is Body.KETU
    assert NAKSHATRA_LORD[16] is Body.SATURN  # Anuradha
    assert NAKSHATRA_LORD[26] is Body.MERCURY  # Revati


@pytest.mark.parametrize(
    ("longitude", "nakshatra", "pada_no"),
    [
        (0.0, "ashwini", 1),
        (PADA - 1e-9, "ashwini", 1),
        (PADA, "ashwini", 2),
        (NAK - 1e-9, "ashwini", 4),
        (NAK, "bharani", 1),
        (2 * NAK, "krittika", 1),
        (359.999999, "revati", 4),
        (360.0, "ashwini", 1),
    ],
)
def test_nakshatra_and_pada_at_edges(longitude: float, nakshatra: str, pada_no: int) -> None:
    assert NAKSHATRA[nakshatra_index(longitude)] == nakshatra
    assert pada(longitude) == pada_no


def test_sign_and_degree() -> None:
    assert RASHI[sign_index(125.5)] == "simha"
    assert degree_in_sign(125.5) == pytest.approx(5.5)
    assert RASHI[sign_index(-10)] == "meena"


@pytest.mark.parametrize(
    ("longitude", "navamsha"),
    [
        (0.0, "mesha"),  # fire signs start their navamsha from Mesha
        (PADA, "vrishabha"),
        (30.0, "makara"),  # earth signs start from Makara
        (60.0, "tula"),  # air signs start from Tula
        (90.0, "kataka"),  # water signs start from Kataka
        (120.0 + 8.5 * PADA, "dhanu"),  # last navamsha of Simha
    ],
)
def test_navamsha(longitude: float, navamsha: str) -> None:
    assert RASHI[navamsha_sign_index(longitude)] == navamsha


def test_whole_sign_house() -> None:
    simha, kataka, mesha = 4, 3, 0
    assert whole_sign_house(simha, simha) == 1
    assert whole_sign_house(kataka, simha) == 12
    assert whole_sign_house(mesha, simha) == 9
