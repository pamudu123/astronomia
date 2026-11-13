"""The names list and how a name is matched to its starting letter."""

import re

import pytest

from app.api.baby import table_letters
from app.engine import babynames
from app.engine.babynames import aksharas, first_letter, fold, names_for, syllables


@pytest.mark.parametrize(
    ("word", "letter", "count"),
    [
        ("නිමල්", "නි", 2),  # the last letter has its vowel killed
        ("ප්‍රියා", "පි", 2),  # a joined ර: the vowel of the joined syllable counts
        ("ස්වර්ණා", "ස", 2),  # a dead first consonant: its own sound, with the next vowel
        ("ආලෝක", "අ", 3),  # a long first vowel counts as the short one
        ("චන්ද්‍රසේන", "ච", 4),
        ("ගෝඨාභය", "ගො", 4),
        ("හේමන්ත", "හෙ", 3),
        ("සංජීව", "ස", 3),
        ("කල්‍යාණි", "ක", 3),  # a joined ය
        ("ඉඳුනිල්", "ඉ", 3),
    ],
)
def test_first_letter_and_syllables(word: str, letter: str, count: int) -> None:
    assert first_letter(word) == letter
    assert syllables(word) == count


def test_joined_letters_stay_in_one_syllable() -> None:
    assert [a.text for a in aksharas("ධර්මප්‍රිය")] == ["ධ", "ර්", "ම", "ප්‍රි", "ය"]


def test_long_and_short_vowels_fold_together() -> None:
    assert fold("චූ") == fold("චු") == "චු"
    assert fold("ජේ") == "ජෙ"
    assert fold("ලී") == "ලි"


def test_every_name_starts_with_a_letter_from_the_table() -> None:
    letters = table_letters()
    for name in babynames.all_names():
        assert name.letter in letters, (name.en, name.letter)


def test_every_name_says_where_it_came_from() -> None:
    data = babynames.load_names()
    assert data["provisional"] is True
    sources = set(data["sources"])
    for row in data["names"]:
        assert row["source"] in sources - {"astronomia"}, row["en"]
        assert row["url"].startswith("https://en.wikipedia.org/wiki/"), row["en"]
        assert row["meaning_from"] in {"wikipedia", "astronomia"}, row["en"]


def test_names_are_clean_text() -> None:
    names = babynames.all_names()
    assert len(names) >= 200
    assert len({n.en for n in names}) == len(names)
    assert len({n.si for n in names}) == len(names)
    for row in babynames.load_names()["names"]:
        # Every field is text: YAML would read a bare No or Yes as true or false.
        assert all(isinstance(row[key], str) for key in ("en", "si", "meaning_en", "meaning_si"))
    for name in names:
        assert name.gender in {"boy", "girl", "both"}
        assert re.fullmatch(r"[A-Z][a-z]+", name.en), name.en
        assert not re.search(r"[A-Za-z]", name.si + name.meaning_si), name.en
        assert name.meaning_en and name.meaning_si
        assert chr(0x2014) not in name.meaning_en and chr(0x2013) not in name.meaning_en


def test_filters() -> None:
    girls = names_for(["නි"], "girl")
    assert {n.en for n in girls} >= {"Nimali", "Nilmini"}
    assert all(n.gender in {"girl", "both"} for n in girls)
    boys = names_for(["නි"], "boy")
    assert "Nimal" in {n.en for n in boys} and "Nimali" not in {n.en for n in boys}
    short = names_for(["නි", "ස"], length="short")
    assert short and all(n.syllables <= 2 for n in short)
    long = names_for(["ච"], length="long")
    assert "Chandrasena" in {n.en for n in long}
    # A long vowel in the asked letter finds the same names.
    assert names_for(["චූ"]) == names_for(["චු"])
    assert [n.en for n in names_for(["ස"])] == sorted(n.en for n in names_for(["ස"]))
