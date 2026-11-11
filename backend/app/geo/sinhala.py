"""Checks for Sinhala text taken from outside data.

GeoNames holds some broken Sinhala: vowel signs typed before the consonant (legacy
font order), or letters with their vowel signs missing. We keep a name only when it
is well formed, and among several names we pick the most complete one.
"""

import re

SINHALA_BLOCK = re.compile("[\u0d80-\u0dff]")
_ALLOWED = re.compile("^[\u0d80-\u0dff\u200d ()\\-.]+$")
# Vowel signs (U+0DCF to U+0DDF, U+0DF2, U+0DF3), virama (U+0DCA) and anusvara and
# visarga (U+0D82, U+0D83) can never start a word.
_MARK = re.compile("[\u0d82\u0d83\u0dca\u0dcf-\u0ddf\u0df2\u0df3]")


def has_sinhala(text: str) -> bool:
    return bool(SINHALA_BLOCK.search(text))


def is_well_formed(text: str) -> bool:
    text = text.strip()
    if not text or not _ALLOWED.match(text):
        return False
    return all(not _MARK.match(word) for word in text.split())


def completeness(text: str) -> int:
    """More vowel signs and viramas usually means fewer missing marks."""
    return len(_MARK.findall(text))


def best_name(candidates: list[tuple[str, bool]]) -> str | None:
    """Pick one name from (name, is_preferred) pairs. Preferred names win, then completeness."""
    good = [(name.strip(), preferred) for name, preferred in candidates if is_well_formed(name)]
    if not good:
        return None
    good.sort(key=lambda item: (item[1], completeness(item[0]), len(item[0])), reverse=True)
    return good[0][0]
