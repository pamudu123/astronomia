"""Sinhala and English names and one line reasons, from app/data/labels/*.yaml."""

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


def reason(lang: Lang, code: str, **facts: str | int) -> str:
    """Fill a reason template. Sign keys become sign names, house numbers become ordinals."""
    table = labels(lang)
    values: dict[str, str] = {}
    for name, value in facts.items():
        if name == "house" or name.endswith("_house"):
            values[name] = table["house"][int(value) - 1]
        elif name == "sign" or name.endswith("_sign"):
            values[name] = table["rashi"][str(value)]["name"]
        elif name == "point":
            values[name] = table["point"][str(value)]
        else:
            values[name] = str(value)
    text: str = table["reason"][code].format(**values)
    return text[0].upper() + text[1:] if lang == "en" else text
