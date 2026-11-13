import re
import string

import pytest

from app.engine.kuja import load_rules
from app.engine.zodiac import BODIES, NAKSHATRA, RASHI
from app.explain.labels import Lang, labels, reason


def keys(value: object, prefix: str = "") -> set[str]:
    if isinstance(value, dict):
        return {k for key, v in value.items() for k in keys(v, f"{prefix}.{key}")} | {prefix}
    if isinstance(value, list):
        return {f"{prefix}[{len(value)}]"}
    return {prefix}


def test_sinhala_and_english_have_the_same_keys() -> None:
    assert keys(labels("si")) == keys(labels("en"))


@pytest.mark.parametrize("lang", ["si", "en"])
def test_every_name_exists(lang: Lang) -> None:
    table = labels(lang)
    assert set(table["rashi"]) == set(RASHI)
    assert set(table["nakshatra"]) == set(NAKSHATRA)
    assert set(table["planet"]) == {b.value for b in BODIES}
    assert len(table["house"]) == 12
    assert set(table["kuja_rule"]) == {r["id"] for r in load_rules()["cancellations"]}


@pytest.mark.parametrize("lang", ["si", "en"])
@pytest.mark.parametrize(
    "section",
    ["reason", "porondam_reason", "report", "forecast", "couple", "changes", "yearly", "panchanga"],
)
def test_templates_use_the_same_placeholders(lang: Lang, section: str) -> None:
    en, other = labels("en")[section], labels(lang)[section]
    for code, text in en.items():
        fields = {f for _, f, _, _ in string.Formatter().parse(text) if f}
        assert fields == {f for _, f, _, _ in string.Formatter().parse(other[code]) if f}, code


def test_every_porondam_factor_has_names_and_both_reasons() -> None:
    from app.engine.porondam import load_rules

    ids = [f["id"] for f in load_rules()["factors"]]
    for lang in ("si", "en"):
        table = labels(lang)
        assert set(table["porondam_factor"]) == set(ids)
        for factor_id in ids:
            assert f"{factor_id}_pass" in table["porondam_reason"]
            assert f"{factor_id}_fail" in table["porondam_reason"]
        # A factor that needs the birth dates says why it was not counted.
        assert "weekday_unchecked" in table["porondam_reason"]


@pytest.mark.parametrize("lang", ["si", "en"])
def test_every_group_in_the_rules_has_a_name(lang: Lang) -> None:
    from app.engine.porondam import WEEKDAYS, load_rules

    table = labels(lang)
    for name, groups in load_rules()["tables"].items():
        assert set(table[name]) == set(groups), name
    assert set(table["weekday"]) == set(WEEKDAYS)


def test_reason_fills_names_and_ordinals() -> None:
    assert reason("en", "kuja_present", {"house": 12, "point": "lagna"}) == (
        "Mars is in the 12th house counted from the lagna."
    )
    assert reason("si", "kuja_cancel_mars_own_or_exalted", {"sign": "makara"}).startswith("කුජ මකර")


def test_sinhala_text_has_no_stray_latin_words() -> None:
    table = labels("si")
    for code, text in {
        **table["reason"],
        **table["porondam_reason"],
        **table["report"],
        **table["forecast"],
        **table["couple"],
        **table["changes"],
        **table["yearly"],
        **table["thithi"],
        **table["yoga"],
        **table["karana"],
    }.items():
        cleaned = re.sub(r"\{[a-z_]+\}|\d+", "", text)
        assert not re.search(r"[A-Za-z]", cleaned), code


@pytest.mark.parametrize("lang", ["si", "en"])
def test_twelve_month_names(lang: Lang) -> None:
    assert len(labels(lang)["month"]) == 12


@pytest.mark.parametrize("lang", ["si", "en"])
def test_twelve_house_themes(lang: Lang) -> None:
    assert len(labels(lang)["house_theme"]) == 12


@pytest.mark.parametrize("lang", ["si", "en"])
def test_every_panchanga_part_has_a_name(lang: Lang) -> None:
    from app.engine.panchanga import THITHI_KEYS, YOGA_KEYS, karana_key

    table = labels(lang)
    assert set(table["thithi"]) == set(THITHI_KEYS)
    assert set(table["yoga"]) == set(YOGA_KEYS)
    assert set(table["karana"]) == {karana_key(i) for i in range(60)}


def _avurudu_texts(lang: Lang) -> dict[str, str]:
    section = labels(lang)["avurudu"]
    texts = {k: v for k, v in section.items() if isinstance(v, str)}
    for key, item in section["item"].items():
        texts[f"item.{key}.name"] = item["name"]
        texts[f"item.{key}.text"] = item["text"]
    texts.update({f"colour.{k}": v for k, v in section["colour"].items()})
    texts.update({f"direction.{k}": v for k, v in labels(lang)["direction"].items()})
    return texts


def test_avurudu_texts_use_the_same_placeholders() -> None:
    en, si = _avurudu_texts("en"), _avurudu_texts("si")
    assert set(en) == set(si)
    for code, text in en.items():
        fields = {f for _, f, _, _ in string.Formatter().parse(text) if f}
        assert fields == {f for _, f, _, _ in string.Formatter().parse(si[code]) if f}, code


def test_avurudu_sinhala_has_no_latin_letters() -> None:
    for code, text in _avurudu_texts("si").items():
        cleaned = re.sub(r"\{[a-z_]+\}|\d+", "", text)
        assert not re.search(r"[A-Za-z]", cleaned), code
