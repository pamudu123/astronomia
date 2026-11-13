import pytest

from app.engine.porondam import (
    FactorResult,
    Role,
    load_rules,
    match,
    star_matches,
    star_point,
)
from app.engine.zodiac import NAKSHATRA, RASHI


def factor(
    bride: str, groom: str, factor_id: str, bride_pada: int = 1, groom_pada: int = 1
) -> FactorResult:
    result = match(star_point(bride, bride_pada), star_point(groom, groom_pada))
    return next(f for f in result.factors if f.id == factor_id)


def test_rules_are_provisional_and_have_fifteen_factors() -> None:
    rules = load_rules()
    assert rules["version"] == "porondam_si_v2"
    assert rules["provisional"] is True
    assert [f["id"] for f in rules["factors"]] == [
        "dina",
        "gana",
        "mahendra",
        "stree_deergha",
        "yoni",
        "rashi",
        "rashyadhipathi",
        "vashya",
        "gothra",
        "pakshi",
        "linga",
        "weekday",
        "nadi",
        "rajju",
        "vedha",
    ]


def test_version_one_still_loads() -> None:
    old = match(star_point("anuradha", 2), star_point("rohini", 1), version="porondam_si_v1")
    assert old.rule_set == "porondam_si_v1"
    assert len(old.scored) == 9


@pytest.mark.parametrize("table", ["gothra", "pakshi", "linga", "gana", "yoni", "nadi", "rajju"])
def test_each_table_places_every_star_exactly_once(table: str) -> None:
    groups = load_rules()["tables"][table]
    stars = [star for members in groups.values() for star in members]
    assert sorted(stars) == sorted(NAKSHATRA)


def test_vedha_pairs_are_real_stars() -> None:
    vedha = next(f for f in load_rules()["factors"] if f["id"] == "vedha")
    assert all(a in NAKSHATRA and b in NAKSHATRA and a != b for a, b in vedha["fail"])


def test_vashya_and_enemy_tables_cover_every_sign_and_planet() -> None:
    rules = load_rules()
    assert set(rules["vashya"]) == set(RASHI)
    assert set(rules["enemies"]) == {"sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"}


def test_quick_point_uses_the_pada_for_the_sign() -> None:
    # Krittika pada 1 is in Mesha, padas 2 to 4 are in Vrishabha.
    assert RASHI[star_point("krittika", 1).sign] == "mesha"
    assert RASHI[star_point("krittika", 2).sign] == "vrishabha"
    assert star_point("krittika", 3).pada == 3
    with pytest.raises(ValueError):
        star_point("krittika", 5)
    with pytest.raises(ValueError):
        star_point("pluto", 1)


def test_design_sample_counts() -> None:
    # Anuradha bride, Rohini groom: Rohini is the 15th star from Anuradha.
    assert factor("anuradha", "rohini", "dina").facts == {"count": 15, "remainder": 6}
    assert factor("anuradha", "rohini", "dina").passed
    assert not factor("anuradha", "rohini", "mahendra").passed
    assert factor("anuradha", "rohini", "stree_deergha").passed


def test_dina_fail() -> None:
    # Bharani is the 2nd... count 3 from Ashwini is Krittika: remainder 3, not favourable.
    assert not factor("ashwini", "krittika", "dina").passed
    assert factor("ashwini", "bharani", "dina").passed  # count 2


def test_mahendra_pass() -> None:
    assert factor("ashwini", "rohini", "mahendra").passed  # count 4


def test_stree_deergha_fail_when_too_close() -> None:
    assert not factor("ashwini", "magha", "stree_deergha").passed  # count 10


def test_gana() -> None:
    assert factor("ashwini", "bharani", "gana").passed  # deva with manushya
    assert not factor("ashwini", "krittika", "gana").passed  # deva with rakshasa
    assert factor("krittika", "magha", "gana").passed  # both rakshasa


def test_yoni_enemies() -> None:
    assert not factor("uttara_phalguni", "chitra", "yoni").passed  # cow and tiger
    assert not factor("magha", "punarvasu", "yoni").passed  # rat and cat
    assert factor("anuradha", "rohini", "yoni").passed  # deer and snake


def test_rashi_distance() -> None:
    assert factor("anuradha", "rohini", "rashi").passed  # 7th
    assert not factor("ashwini", "rohini", "rashi").passed  # Mesha to Vrishabha is 2nd
    assert not factor("ashwini", "hasta", "rashi").passed  # Mesha to Kanya is 6th


def test_rashyadhipathi() -> None:
    # Simha (Sun) and Makara (Saturn): Sun counts Saturn as an enemy.
    assert not factor("magha", "shravana", "rashyadhipathi").passed
    # Mesha (Mars) and Dhanu (Jupiter): friends.
    assert factor("ashwini", "mula", "rashyadhipathi").passed


def test_vashya() -> None:
    assert factor("ashwini", "magha", "vashya").passed  # Mesha holds Simha
    assert not factor("anuradha", "rohini", "vashya").passed  # Vrischika and Vrishabha


def test_nadi() -> None:
    assert not factor("ashwini", "ardra", "nadi").passed  # both aadi
    assert factor("ashwini", "bharani", "nadi").passed


def test_rajju_is_a_hard_check() -> None:
    same = factor("ashwini", "magha", "rajju")  # both pada rajju
    assert same.hard and not same.passed
    assert factor("anuradha", "rohini", "rajju").passed


def test_vedha_in_both_directions() -> None:
    assert not factor("ashwini", "jyeshtha", "vedha").passed
    assert not factor("jyeshtha", "ashwini", "vedha").passed
    assert not factor("mrigashira", "chitra", "vedha").passed
    assert factor("anuradha", "rohini", "vedha").passed


def test_score_and_summary() -> None:
    result = match(star_point("anuradha", 2), star_point("rohini", 1))
    # A birth star only match has no weekdays: 12 counted factors, and 13 with them.
    assert len(result.scored) == 12
    assert [f.id for f in result.unchecked] == ["weekday"]
    assert len(result.hard_checks) == 2
    assert result.passed == 9
    with_days = match(star_point("anuradha", 2), star_point("rohini", 1), weekdays=(0, 1))
    assert len(with_days.scored) == 13
    assert with_days.passed == 10
    assert result.summary == "majority_pass"
    failed = match(star_point("ashwini", 1), star_point("jyeshtha", 1))
    assert failed.summary == "essential_fail"


def test_same_star_is_flagged() -> None:
    assert match(star_point("rohini", 1), star_point("rohini", 3)).same_star


def test_star_matches_lists_every_star_and_splits_those_across_two_signs() -> None:
    found = star_matches("anuradha", 2, "bride")
    assert {m.nakshatra for m in found} == set(range(27))
    # Nine stars lie across two signs, so they are listed twice.
    assert len(found) == 36
    krittika = sorted(
        (m for m in found if NAKSHATRA[m.nakshatra] == "krittika"), key=lambda m: m.padas
    )
    assert [(RASHI[m.sign], m.padas) for m in krittika] == [
        ("mesha", (1,)),
        ("vrishabha", (2, 3, 4)),
    ]
    rohini = next(m for m in found if NAKSHATRA[m.nakshatra] == "rohini")
    assert rohini.padas == (1, 2, 3, 4)


def test_star_matches_agree_with_a_single_match() -> None:
    found = star_matches("anuradha", 2, "bride")
    rohini = next(m for m in found if NAKSHATRA[m.nakshatra] == "rohini")
    assert rohini.result == match(star_point("anuradha", 2), star_point("rohini", 1))


def test_star_matches_put_essential_passes_first_then_the_higher_count() -> None:
    found = star_matches("anuradha", 2, "bride")
    keys = [(not m.essential_pass, -m.result.passed) for m in found]
    assert keys == sorted(keys)
    assert found[0].essential_pass
    assert not found[-1].essential_pass


def test_star_matches_depend_on_the_role() -> None:
    def count(role: Role) -> int | str:
        rohini = next(
            m for m in star_matches("anuradha", 2, role) if NAKSHATRA[m.nakshatra] == "rohini"
        )
        return next(f for f in rohini.result.factors if f.id == "dina").facts["count"]

    assert count("bride") == 15  # rohini counted from anuradha
    assert count("groom") == 14  # anuradha counted from rohini


def test_star_matches_reject_an_unknown_star() -> None:
    with pytest.raises(ValueError, match="unknown nakshatra"):
        star_matches("polaris", 1, "bride")


def test_gothra_same_sage_does_not_agree() -> None:
    assert not factor("ashwini", "rohini", "gothra").passed  # both Marichi
    assert factor("rohini", "mrigashira", "gothra").passed  # Marichi and Atri
    # Abhijit sits between Uttara Ashadha and Shravana, so the sages' groups of four move.
    assert not factor("uttara_ashadha", "dhanishta", "gothra").passed  # both Pulaha
    assert factor("dhanishta", "shatabhisha", "gothra").passed  # Pulaha and Kratu
    assert not factor("purva_bhadrapada", "uttara_bhadrapada", "gothra").passed  # both Kratu
    assert factor("revati", "ashwini", "gothra").facts == {
        "bride_gothra": "kratu",
        "groom_gothra": "marichi",
    }


def test_pakshi_enemy_birds() -> None:
    assert factor("ashwini", "bharani", "pakshi").passed  # eagle and eagle
    assert factor("anuradha", "hasta", "pakshi").passed  # cock and crow
    assert factor("hasta", "ashwini", "pakshi").passed  # crow and eagle
    assert not factor("ardra", "hasta", "pakshi").passed  # the owl is everyone's enemy
    assert not factor("revati", "pushya", "pakshi").passed  # peacock and owl
    assert not factor("ashwini", "anuradha", "pakshi").passed  # eagle and cock
    assert not factor("dhanishta", "ashwini", "pakshi").passed  # peacock and eagle


def test_linga_depends_on_who_is_the_bride() -> None:
    assert factor("krittika", "rohini", "linga").passed  # female bride, male groom
    assert not factor("rohini", "krittika", "linga").passed  # male bride, female groom
    assert factor("krittika", "hasta", "linga").passed  # both female
    assert not factor("ashwini", "rohini", "linga").passed  # both male
    assert factor("krittika", "mula", "linga").passed  # female and neuter, partly
    assert not factor("mula", "ashwini", "linga").passed  # neuter and male


@pytest.mark.parametrize(
    ("bride", "groom", "passed"),
    [
        (0, 0, True),  # the same day
        (0, 1, True),  # Monday and Tuesday
        (0, 4, True),
        (0, 5, False),  # Saturday is two days before Monday
        (0, 6, False),  # Sunday is one day before Monday
        (2, 0, False),
        (4, 0, True),
        (5, 3, False),
        (6, 6, True),
    ],
)
def test_weekday(bride: int, groom: int, passed: bool) -> None:
    result = match(star_point("anuradha", 2), star_point("rohini", 1), weekdays=(bride, groom))
    weekday = next(f for f in result.factors if f.id == "weekday")
    assert weekday.checked
    assert weekday.passed is passed
    assert weekday.facts["count"] == (groom - bride) % 7 + 1


def test_weekday_is_not_checked_without_birth_dates() -> None:
    weekday = factor("anuradha", "rohini", "weekday")
    assert not weekday.checked
    assert weekday.facts == {}
