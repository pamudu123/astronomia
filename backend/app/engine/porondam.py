"""Porondam: compare the bride's and groom's Moon positions, factor by factor.

All rules and tables come from a versioned YAML file. The result holds facts and pass or
fail flags, never sentences: words come from the label files.
"""

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml

from app.engine.chart import Point
from app.engine.zodiac import DEGREES_PER_NAKSHATRA, DEGREES_PER_PADA, NAKSHATRA, RASHI, RASHI_LORD

RULES_DIR = Path(__file__).resolve().parents[1] / "data" / "rules"
DEFAULT_RULES = "porondam_si_v3"


@dataclass(frozen=True)
class FactorResult:
    id: str
    passed: bool
    hard: bool
    facts: dict[str, str | int] = field(default_factory=dict)
    # False when the factor needs something this match does not have, such as the birth
    # weekdays in a birth star only match. It is then left out of the count.
    checked: bool = True


@dataclass(frozen=True)
class MatchResult:
    rule_set: str
    provisional: bool
    factors: list[FactorResult]
    same_star: bool

    @property
    def scored(self) -> list[FactorResult]:
        """The counted factors: not the essential checks, and only those that were checked."""
        return [f for f in self.factors if not f.hard and f.checked]

    @property
    def unchecked(self) -> list[FactorResult]:
        return [f for f in self.factors if not f.checked]

    @property
    def hard_checks(self) -> list[FactorResult]:
        return [f for f in self.factors if f.hard]

    @property
    def passed(self) -> int:
        return sum(f.passed for f in self.scored)

    @property
    def summary(self) -> str:
        if not all(f.passed for f in self.hard_checks):
            return "essential_fail"
        return "majority_pass" if self.passed * 2 > len(self.scored) else "minority_pass"


@lru_cache
def load_rules(version: str = DEFAULT_RULES) -> dict[str, Any]:
    with (RULES_DIR / f"{version}.yaml").open(encoding="utf-8") as handle:
        rules: dict[str, Any] = yaml.safe_load(handle)
    return rules


def star_point(nakshatra: str, pada: int) -> Point:
    """A Moon position for a quick match: the middle of the given pada."""
    if nakshatra not in NAKSHATRA:
        raise ValueError(f"unknown nakshatra: {nakshatra}")
    if not 1 <= pada <= 4:
        raise ValueError("pada must be 1 to 4")
    index = NAKSHATRA.index(nakshatra)
    return Point.at(index * DEGREES_PER_NAKSHATRA + (pada - 0.5) * DEGREES_PER_PADA)


WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


def _group(table: dict[str, list[str]], star: str) -> str:
    return next(group for group, stars in table.items() if star in stars)


def _pair_in(a: str, b: str, pairs: list[list[str]]) -> bool:
    return any({a, b} == set(pair) for pair in pairs)


def _index28(nakshatra: int) -> int:
    """A star's place in the 28 star count, where Abhijit follows Uttara Ashadha."""
    return nakshatra + 1 if nakshatra > NAKSHATRA.index("uttara_ashadha") else nakshatra


def distance28(bride: int, groom: int) -> int:
    """How far apart two stars are in the 28 star count, the nearer way round: 1 (the same
    star) to 15. Counting both ends, as the tradition does."""
    count = (_index28(groom) - _index28(bride)) % 28 + 1
    return 1 if count == 1 else min(count, 30 - count)


def _factor(
    rule: dict[str, Any],
    rules: dict[str, Any],
    bride: Point,
    groom: Point,
    weekdays: tuple[int, int] | None,
    lagnas: tuple[int, int] | None,
) -> FactorResult:
    kind = rule["type"]
    hard = bool(rule.get("hard", False))
    b_star, g_star = NAKSHATRA[bride.nakshatra], NAKSHATRA[groom.nakshatra]
    count = (groom.nakshatra - bride.nakshatra) % 27 + 1
    sign_count = (groom.sign - bride.sign) % 12 + 1

    def result(passed: bool, **facts: str | int) -> FactorResult:
        return FactorResult(rule["id"], passed, hard, facts)

    if kind == "count_mod":
        remainder = count % rule["mod"]
        return result(remainder in rule["pass"], count=count, remainder=remainder)
    if kind == "count_in":
        return result(count in rule["pass"], count=count)
    if kind == "count_above":
        return result(count > rule["threshold"], count=count, threshold=rule["threshold"])
    if kind == "weekday_count_avoid":
        if weekdays is None:
            return FactorResult(rule["id"], False, hard, {}, checked=False)
        b_day, g_day = weekdays
        weekday_count = (g_day - b_day) % 7 + 1
        return result(
            weekday_count not in rule["fail"],
            bride_weekday=WEEKDAYS[b_day],
            groom_weekday=WEEKDAYS[g_day],
            count=weekday_count,
        )
    if kind in ("group_pairs", "group_pairs_ordered", "group_avoid", "group_different"):
        table = rules["tables"][rule["table"]]
        b_group, g_group = _group(table, b_star), _group(table, g_star)
        name = rule["table"]
        facts: dict[str, str | int] = {f"bride_{name}": b_group, f"groom_{name}": g_group}
        if kind == "group_pairs":
            return result(_pair_in(b_group, g_group, rule["pass"]), **facts)
        if kind == "group_pairs_ordered":
            return result([b_group, g_group] in rule["pass"], **facts)
        if kind == "group_avoid":
            return result(not _pair_in(b_group, g_group, rule["fail"]), **facts)
        return result(b_group != g_group, **facts)
    if kind == "sign_rank_at_least":
        # The table lists its groups from highest to lowest.
        groups = list(rules[rule["table"]])
        b_group = _group(rules[rule["table"]], RASHI[bride.sign])
        g_group = _group(rules[rule["table"]], RASHI[groom.sign])
        return result(
            groups.index(g_group) <= groups.index(b_group),
            bride_varna=b_group,
            groom_varna=g_group,
        )
    if kind == "distance28_avoid":
        distance = distance28(bride.nakshatra, groom.nakshatra)
        return result(distance not in rule["fail"], distance=distance)
    if kind == "lagna_and_moon_lords":
        if lagnas is None:
            return FactorResult(rule["id"], False, hard, {}, checked=False)
        enemies = rules["enemies"]
        b_lagna, g_lagna = RASHI_LORD[lagnas[0]].value, RASHI_LORD[lagnas[1]].value
        b_moon, g_moon = RASHI_LORD[bride.sign].value, RASHI_LORD[groom.sign].value
        # How each lord sees the other: the same planet, a friend or a neutral counts.
        checks = [(g_lagna, b_lagna), (b_lagna, g_lagna), (g_moon, b_moon), (b_moon, g_moon)]
        positive = sum(other not in enemies[lord] for lord, other in checks)
        return result(
            positive >= rule["min_positive"],
            bride_lagna_lord=b_lagna,
            groom_lagna_lord=g_lagna,
            bride_moon_lord=b_moon,
            groom_moon_lord=g_moon,
            positive=positive,
        )
    if kind == "sign_count_avoid":
        return result(sign_count not in rule["fail"], count=sign_count)
    if kind == "lords_friendly":
        b_lord, g_lord = RASHI_LORD[bride.sign].value, RASHI_LORD[groom.sign].value
        enemies = rules["enemies"]
        friendly = b_lord == g_lord or (
            g_lord not in enemies[b_lord] and b_lord not in enemies[g_lord]
        )
        return result(friendly, bride_lord=b_lord, groom_lord=g_lord)
    if kind == "sign_vashya":
        b_sign, g_sign = RASHI[bride.sign], RASHI[groom.sign]
        table = rules["vashya"]
        return result(
            g_sign in table[b_sign] or b_sign in table[g_sign], bride_sign=b_sign, groom_sign=g_sign
        )
    if kind == "star_pairs_avoid":
        return result(
            not _pair_in(b_star, g_star, rule["fail"]), bride_star=b_star, groom_star=g_star
        )
    raise ValueError(f"unknown porondam rule type: {kind}")


def match(
    bride: Point,
    groom: Point,
    version: str = DEFAULT_RULES,
    weekdays: tuple[int, int] | None = None,
    lagnas: tuple[int, int] | None = None,
) -> MatchResult:
    """Every factor for one couple. Weekdays (0 = Monday) are the bride's and the groom's
    birth weekdays, and lagnas their lagna signs (0 = Mesha), when the birth details are known.
    A factor that needs one of them is left unchecked without it."""
    rules = load_rules(version)
    return MatchResult(
        rule_set=rules["version"],
        provisional=bool(rules["provisional"]),
        factors=[_factor(rule, rules, bride, groom, weekdays, lagnas) for rule in rules["factors"]],
        same_star=bride.nakshatra == groom.nakshatra,
    )


Role = Literal["bride", "groom"]


@dataclass(frozen=True)
class StarMatch:
    """One possible partner: a birth star and the Moon sign those padas fall in."""

    nakshatra: int
    sign: int
    padas: tuple[int, ...]
    result: MatchResult

    @property
    def essential_pass(self) -> bool:
        return all(f.passed for f in self.result.hard_checks)


def star_matches(
    nakshatra: str, pada: int, role: Role, version: str = DEFAULT_RULES
) -> list[StarMatch]:
    """Every birth star as a partner for one star, best first.

    Counts run from the bride's star, so the role matters. A star that lies across two
    signs is listed once for each sign, because the sign based factors differ. Partners
    that pass every essential check come first, then those with more factors agreeing.
    """
    own = star_point(nakshatra, pada)
    found: list[StarMatch] = []
    for index, partner_star in enumerate(NAKSHATRA):
        by_sign: dict[int, list[int]] = {}
        for partner_pada in (1, 2, 3, 4):
            by_sign.setdefault(star_point(partner_star, partner_pada).sign, []).append(partner_pada)
        for sign, padas in by_sign.items():
            partner = star_point(partner_star, padas[0])
            bride, groom = (own, partner) if role == "bride" else (partner, own)
            found.append(StarMatch(index, sign, tuple(padas), match(bride, groom, version)))
    return sorted(found, key=lambda m: (not m.essential_pass, -m.result.passed, m.nakshatra))
