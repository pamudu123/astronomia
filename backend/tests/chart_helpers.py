"""Build charts with chosen signs, for rule tests that should not depend on real dates."""

from datetime import UTC, datetime

from app.engine.chart import Chart, Method, Placement, Point, TimeSensitivity
from app.engine.zodiac import BODIES, RASHI, Body, whole_sign_house


def fake_chart(lagna: str, **signs: str) -> Chart:
    """Every planet sits at 15 degrees of the sign given, Mesha if not given."""
    lagna_point = Point.at(RASHI.index(lagna) * 30 + 15)
    planets = {}
    for body in BODIES:
        point = Point.at(RASHI.index(signs.get(body.value, "mesha")) * 30 + 15)
        planets[body] = Placement(
            body=body,
            point=point,
            house=whole_sign_house(point.sign, lagna_point.sign),
            navamsha_house=1,
            retrograde=body in (Body.RAHU, Body.KETU),
            speed=1.0,
        )
    return Chart(
        utc=datetime(2000, 1, 1, tzinfo=UTC),
        latitude=7.0,
        longitude=80.0,
        lagna=lagna_point,
        planets=planets,
        time_check=TimeSensitivity(None, None, None),
        method=Method("lahiri", 23.85, "mean", "whole_sign", "test"),
    )
