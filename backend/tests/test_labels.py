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
def test_templates_use_the_same_placeholders(lang: Lang) -> None:
    en, other = labels("en")["reason"], labels(lang)["reason"]
    for code, text in en.items():
        fields = {f for _, f, _, _ in string.Formatter().parse(text) if f}
        assert fields == {f for _, f, _, _ in string.Formatter().parse(other[code]) if f}, code


def test_reason_fills_names_and_ordinals() -> None:
    assert reason("en", "kuja_present", house=12, point="lagna") == (
        "Mars is in the 12th house counted from the lagna."
    )
    assert reason("si", "kuja_cancel_mars_own_or_exalted", sign="makara").startswith("කුජ මකර")


def test_sinhala_text_has_no_stray_latin_words() -> None:
    for code, text in labels("si")["reason"].items():
        cleaned = re.sub(r"\{[a-z_]+\}|\d+", "", text)
        assert not re.search(r"[A-Za-z]", cleaned), code
