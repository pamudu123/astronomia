"""Kuja dosha (Mars affliction): where Mars falls from the lagna, Moon and Venus, and
which cancellation conditions apply. Rules come from a versioned YAML file.

The result carries reason codes and the facts behind them, not sentences. The words are
added from the label files, in Sinhala or English.
"""

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.engine.chart import Chart
from app.engine.zodiac import RASHI, Body, whole_sign_house

RULES_DIR = Path(__file__).resolve().parents[1] / "data" / "rules"


@dataclass(frozen=True)
class FromPoint:
    point: str  # lagna, moon or venus
    house: int  # Mars counted from that point
    counts: bool


@dataclass(frozen=True)
class Cancellation:
    id: str
    applies: bool
    facts: dict[str, str | int] = field(default_factory=dict)


@dataclass(frozen=True)
class KujaResult:
    rule_set: str
    provisional: bool
    present: bool
    strength: int  # how many of the points show it
    points: list[FromPoint]
    cancellations: list[Cancellation]

    @property
    def reduced(self) -> bool:
        return self.present and any(c.applies for c in self.cancellations)


@lru_cache
def load_rules(version: str = "kuja_v1") -> dict[str, Any]:
    with (RULES_DIR / f"{version}.yaml").open(encoding="utf-8") as handle:
        rules: dict[str, Any] = yaml.safe_load(handle)
    return rules


def _sign(chart: Chart, body: Body) -> int:
    return chart.planets[body].point.sign


def _jupiter_aspects(jupiter_sign: int, target_sign: int) -> bool:
    """Jupiter in the same sign, or aspecting the 5th, 7th or 9th sign from itself."""
    return whole_sign_house(target_sign, jupiter_sign) in (1, 5, 7, 9)


def _check(rule: dict[str, Any], chart: Chart) -> Cancellation:
    mars = _sign(chart, Body.MARS)
    kind = rule["type"]
    if kind == "lagna_in_signs":
        return Cancellation(
            rule["id"], RASHI[chart.lagna.sign] in rule["signs"], {"sign": RASHI[chart.lagna.sign]}
        )
    if kind == "mars_in_signs":
        return Cancellation(rule["id"], RASHI[mars] in rule["signs"], {"sign": RASHI[mars]})
    if kind == "jupiter_aspects_mars":
        jupiter = _sign(chart, Body.JUPITER)
        return Cancellation(
            rule["id"],
            _jupiter_aspects(jupiter, mars),
            {"jupiter_sign": RASHI[jupiter], "mars_sign": RASHI[mars]},
        )
    if kind == "mars_house_sign":
        house = chart.planets[Body.MARS].house
        applies = any(
            pair["house"] == house and RASHI[mars] in pair["signs"] for pair in rule["pairs"]
        )
        return Cancellation(rule["id"], applies, {"house": house, "sign": RASHI[mars]})
    raise ValueError(f"unknown kuja rule type: {kind}")


def kuja_dosha(chart: Chart, version: str = "kuja_v1") -> KujaResult:
    rules = load_rules(version)
    mars = _sign(chart, Body.MARS)
    bases = {
        "lagna": chart.lagna.sign,
        "moon": _sign(chart, Body.MOON),
        "venus": _sign(chart, Body.VENUS),
    }
    points = []
    for name in rules["points"]:
        house = whole_sign_house(mars, bases[name])
        points.append(FromPoint(name, house, house in rules["houses"]))
    strength = sum(p.counts for p in points)
    return KujaResult(
        rule_set=rules["version"],
        provisional=bool(rules["provisional"]),
        present=strength > 0,
        strength=strength,
        points=points,
        cancellations=[_check(rule, chart) for rule in rules["cancellations"]],
    )
