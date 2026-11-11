"""Sinhala and English names and one line reasons, from app/data/labels/*.yaml."""

from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml

Lang = Literal["si", "en"]
LABELS_DIR = Path(__file__).resolve().parents[1] / "data" / "labels"


@lru_cache
def labels(lang: Lang) -> dict[str, Any]:
    with (LABELS_DIR / f"{lang}.yaml").open(encoding="utf-8") as handle:
        data: dict[str, Any] = yaml.safe_load(handle)
    return data


# Fact names ending in these suffixes are keys to look up in a label table.
_GROUP_TABLES = ("gana", "yoni", "nadi", "rajju")


def _value(table: dict[str, Any], name: str, value: str | int) -> str:
    if name == "house" or name.endswith("_house"):
        return str(table["house"][int(value) - 1])
    if name == "sign" or name.endswith("_sign"):
        return str(table["rashi"][str(value)]["name"])
    if name == "point":
        return str(table["point"][str(value)])
    if name.endswith("_star"):
        return str(table["nakshatra"][str(value)])
    if name.endswith("_lord"):
        return str(table["planet"][str(value)]["name"])
    for group in _GROUP_TABLES:
        if name.endswith(f"_{group}"):
            return str(table[group][str(value)])
    return str(value)


def reason(
    lang: Lang,
    code: str,
    facts: Mapping[str, str | int] | None = None,
    *,
    section: str = "reason",
) -> str:
    """Fill a reason template. Keys in the facts become names in the chosen language."""
    table = labels(lang)
    values = {name: _value(table, name, value) for name, value in (facts or {}).items()}
    text: str = table[section][code].format(**values)
    return text[0].upper() + text[1:] if lang == "en" else text
