import pytest

from app.engine.porondam import FactorResult, load_rules, match, star_point
from app.engine.zodiac import NAKSHATRA, RASHI


def factor(
    bride: str, groom: str, factor_id: str, bride_pada: int = 1, groom_pada: int = 1
) -> FactorResult:
    result = match(star_point(bride, bride_pada), star_point(groom, groom_pada))
    return next(f for f in result.factors if f.id == factor_id)


def test_rules_are_provisional_and_have_eleven_factors() -> None:
    rules = load_rules()
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
        "nadi",
        "rajju",
        "vedha",
    ]


@pytest.mark.parametrize("table", ["gana", "yoni", "nadi", "rajju"])
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
    assert len(result.scored) == 9
    assert len(result.hard_checks) == 2
    assert result.passed == 7
    assert result.summary == "majority_pass"
    failed = match(star_point("ashwini", 1), star_point("jyeshtha", 1))
    assert failed.summary == "essential_fail"


def test_same_star_is_flagged() -> None:
    assert match(star_point("rohini", 1), star_point("rohini", 3)).same_star
