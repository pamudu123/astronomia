from app.engine.kuja import KujaResult, kuja_dosha, load_rules
from tests.chart_helpers import fake_chart


def by_id(result: KujaResult, rule: str) -> bool:
    return next(c.applies for c in result.cancellations if c.id == rule)


def test_rules_are_marked_provisional() -> None:
    rules = load_rules()
    assert rules["provisional"] is True
    assert rules["houses"] == [1, 2, 4, 7, 8, 12]


def test_no_dosha_when_mars_is_in_a_neutral_house_from_every_point() -> None:
    # Lagna Mesha, Moon Mesha, Venus Mesha, Mars in Mithuna = 3rd house from each.
    result = kuja_dosha(fake_chart("mesha", mars="mithuna"))
    assert not result.present
    assert result.strength == 0
    assert not result.reduced


def test_dosha_from_all_three_points() -> None:
    # Mars in Tula is the 7th from Mesha.
    result = kuja_dosha(fake_chart("mesha", mars="tula", moon="mesha", venus="mesha"))
    assert result.present
    assert result.strength == 3
    assert [p.house for p in result.points] == [7, 7, 7]


def test_dosha_from_lagna_only() -> None:
    result = kuja_dosha(fake_chart("simha", mars="kataka", moon="vrischika", venus="meena"))
    assert [(p.point, p.house, p.counts) for p in result.points] == [
        ("lagna", 12, True),
        ("moon", 9, False),
        ("venus", 5, False),
    ]


def test_lagna_kataka_or_simha_cancels() -> None:
    result = kuja_dosha(fake_chart("simha", mars="kataka"))
    assert by_id(result, "lagna_kataka_simha")
    assert result.reduced


def test_mars_own_or_exalted_sign() -> None:
    assert by_id(kuja_dosha(fake_chart("tula", mars="makara")), "mars_own_or_exalted")
    assert not by_id(kuja_dosha(fake_chart("tula", mars="kataka")), "mars_own_or_exalted")


def test_jupiter_aspect() -> None:
    # Jupiter in Vrischika aspects the 5th (Meena), 7th (Vrishabha) and 9th (Kataka) signs.
    for mars in ("vrischika", "meena", "vrishabha", "kataka"):
        assert by_id(
            kuja_dosha(fake_chart("tula", mars=mars, jupiter="vrischika")), "jupiter_aspects_mars"
        )
    assert not by_id(
        kuja_dosha(fake_chart("tula", mars="mithuna", jupiter="vrischika")), "jupiter_aspects_mars"
    )


def test_house_sign_exception() -> None:
    # Mars in the 12th from a Mithuna lagna is Vrishabha: excused.
    assert by_id(kuja_dosha(fake_chart("mithuna", mars="vrishabha")), "mars_house_sign_exception")
    # Mars in the 12th from a Simha lagna is Kataka: not excused.
    assert not by_id(kuja_dosha(fake_chart("simha", mars="kataka")), "mars_house_sign_exception")
