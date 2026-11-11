"""Turn place names and search text into comparable keys."""

import re
import unicodedata

from app.geo.sinhala import has_sinhala

_SPACES = re.compile("[\\s\\-'\u2019.,()]+")


def normalize(text: str) -> str:
    """Lowercase, accents removed for Latin text, punctuation folded to single spaces.

    Sinhala is only normalised to NFC: its vowel signs are part of the letter, not accents.
    """
    text = unicodedata.normalize("NFC", text).strip()
    if not has_sinhala(text):
        text = unicodedata.normalize("NFKD", text)
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return _SPACES.sub(" ", text.casefold()).strip()


def word_keys(text: str) -> list[str]:
    """The name and every tail that starts at a word: "mount lavinia" also gives "lavinia"."""
    words = normalize(text).split()
    return [" ".join(words[i:]) for i in range(len(words))]
