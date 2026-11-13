"""Name suggestions for the starting letters (free).

The names are data (data/names/names_si_v1.yaml), each with where it came from.
A name matches a letter when its first sound does: the first consonant or vowel, with
the vowel of the first syllable. Long and short vowels count as the same letter, since the
letter sources themselves differ on vowel length (docs/12-baby-rules.md).
"""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml

NAMES_DIR = Path(__file__).resolve().parents[1] / "data" / "names"
DEFAULT_NAMES = "names_si_v1"

Gender = Literal["boy", "girl", "both"]
Length = Literal["short", "medium", "long"]

VIRAMA = chr(0x0DCA)  # ්, the sign that kills a consonant's vowel
ZWJ = chr(0x200D)  # zero width joiner: joins letters, as in the rakaransaya
ANUSVARA = chr(0x0D82)  # the anusvara sign
VISARGA = chr(0x0D83)  # ඃ

# Long vowels count as their short forms.
_FOLD = {
    "\u0dcf": "",  # ා (aa) to the inherent a
    "\u0dd3": "\u0dd2",  # ී to ි
    "\u0dd6": "\u0dd4",  # ූ to ු
    "\u0dda": "\u0dd9",  # ේ to ෙ
    "\u0ddd": "\u0ddc",  # ෝ to ො
    "\u0dd1": "\u0dd0",  # ෑ to ැ
    "\u0df2": "\u0dd8",  # ෲ to ෘ
    "ආ": "අ",
    "ඈ": "ඇ",
    "ඊ": "ඉ",
    "ඌ": "උ",
    "ඒ": "එ",
    "ඕ": "ඔ",
    "ඎ": "ඍ",
}


def _consonant(char: str) -> bool:
    return "ක" <= char <= "ෆ"


def _vowel(char: str) -> bool:
    return "අ" <= char <= "ඖ"


def _sign(char: str) -> bool:
    return ("ා" <= char <= "ෟ" or char in "ෲෳ") and char != VIRAMA


@dataclass(frozen=True)
class Akshara:
    text: str
    live: bool  # False for a consonant with its vowel killed (න් in චන්ද්‍ර)


def aksharas(word: str) -> list[Akshara]:
    """Split a Sinhala word into its written syllables. Joined letters stay together."""
    out: list[Akshara] = []
    i, n = 0, len(word)
    while i < n:
        start = i
        if not (_consonant(word[i]) or _vowel(word[i])):
            i += 1
            continue
        i += 1
        live = True
        while i < n:
            char = word[i]
            joined = (
                char == VIRAMA and i + 2 < n and word[i + 1] == ZWJ and _consonant(word[i + 2])
            ) or (char == ZWJ and i + 2 < n and word[i + 1] == VIRAMA and _consonant(word[i + 2]))
            if joined:  # ්‍ර, ්‍ය and touching letters belong to this syllable
                i += 3
            elif char == VIRAMA:
                i += 1
                live = False
                break
            elif _sign(char) or char in (ANUSVARA, VISARGA, ZWJ):
                i += 1
            else:
                break
        out.append(Akshara(word[start:i], live))
    return out


def fold(letter: str) -> str:
    return "".join(_FOLD.get(char, char) for char in letter)


def first_letter(word: str) -> str:
    """The letter a name starts with: ප්‍රියා gives පි, ස්වර්ණා gives ස, ආලෝක gives අ."""
    parts = aksharas(word)
    if not parts:
        raise ValueError(f"not a Sinhala word: {word!r}")
    base = parts[0].text[0]
    if _vowel(base):
        return fold(base)
    live = next((p for p in parts if p.live), parts[0])
    sign = next((c for c in live.text[1:] if _sign(c)), "")
    return fold(base + sign)


def syllables(word: str) -> int:
    return sum(1 for part in aksharas(word) if part.live)


def length_of(word: str) -> Length:
    count = syllables(word)
    return "short" if count <= 2 else "medium" if count == 3 else "long"


@dataclass(frozen=True)
class Name:
    en: str
    si: str
    gender: Gender
    meaning_en: str
    meaning_si: str
    meaning_from: str
    source: str
    url: str
    letter: str  # folded first letter
    syllables: int
    length: Length


@lru_cache
def load_names(version: str = DEFAULT_NAMES) -> dict[str, Any]:
    with (NAMES_DIR / f"{version}.yaml").open(encoding="utf-8") as handle:
        data: dict[str, Any] = yaml.safe_load(handle)
    return data


@lru_cache
def all_names(version: str = DEFAULT_NAMES) -> tuple[Name, ...]:
    rows = load_names(version)["names"]
    return tuple(
        Name(
            en=str(row["en"]),
            si=str(row["si"]),
            gender=row["gender"],
            meaning_en=str(row["meaning_en"]),
            meaning_si=str(row["meaning_si"]),
            meaning_from=str(row["meaning_from"]),
            source=str(row["source"]),
            url=str(row["url"]),
            letter=first_letter(str(row["si"])),
            syllables=syllables(str(row["si"])),
            length=length_of(str(row["si"])),
        )
        for row in rows
    )


def names_for(
    letters: list[str], gender: Literal["boy", "girl", "any"] = "any", length: Length | None = None
) -> list[Name]:
    """Names that start with any of the letters, in English alphabetical order."""
    wanted = {fold(letter) for letter in letters}
    return sorted(
        (
            name
            for name in all_names()
            if name.letter in wanted
            and (gender == "any" or name.gender in (gender, "both"))
            and (length is None or name.length == length)
        ),
        key=lambda name: name.en,
    )
