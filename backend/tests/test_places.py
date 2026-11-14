import csv
from pathlib import Path

import pytest

from app.geo.build import LK_CSV
from app.geo.normalize import normalize
from app.geo.search import get_place, search
from app.geo.sinhala import best_name, is_well_formed


def first(db: Path, query: str) -> tuple[str, str]:
    place = search(db, query, 1)[0]
    return place.name, place.country_code


def test_kandy_is_found_in_english_and_sinhala(places_db: Path) -> None:
    assert first(places_db, "kandy") == ("Kandy", "LK")
    assert first(places_db, "මහනුවර") == ("Kandy", "LK")
    assert first(places_db, "Mahanuwara") == ("Kandy", "LK")


def test_kandy_has_sinhala_names_and_province(places_db: Path) -> None:
    kandy = search(places_db, "kandy", 1)[0]
    assert kandy.name_si == "මහනුවර"
    assert kandy.region == "Central Province"
    assert kandy.region_si == "මධ්‍යම පළාත"
    assert kandy.country_name_si == "ශ්‍රී ලංකාව"
    assert kandy.timezone == "Asia/Colombo"


def test_big_cities_abroad_rank_first(places_db: Path) -> None:
    assert first(places_db, "london") == ("London", "GB")
    assert first(places_db, "sydney") == ("Sydney", "AU")


def test_places_abroad_with_the_same_name_have_regions(places_db: Path) -> None:
    # QA report AST-07: several results read "London, United States".
    londons = [p for p in search(places_db, "london", 10) if p.name == "London"]
    labels = [(p.name, p.region, p.country_name) for p in londons]
    assert ("London", "England", "United Kingdom") in labels
    assert ("London", "Ontario", "Canada") in labels
    assert ("London", "Kentucky", "United States") in labels
    assert len(set(labels)) == len(labels)


def test_small_sri_lankan_village_is_found(places_db: Path) -> None:
    # Yakkala is not in the worldwide list (fewer than 1000 people recorded).
    names = [(p.name, p.country_code) for p in search(places_db, "yakkala", 5)]
    assert ("Yakkala", "LK") in names


def test_a_later_word_in_the_name_matches(places_db: Path) -> None:
    assert first(places_db, "mount lavinia") == ("Dehiwala-Mount Lavinia", "LK")


def test_accents_are_ignored(places_db: Path) -> None:
    assert first(places_db, "Zürich") == first(places_db, "zurich")


def test_limit_is_respected(places_db: Path) -> None:
    assert len(search(places_db, "san", 3)) == 3
    assert len(search(places_db, "san", 500)) == 20


def test_get_place_by_id(places_db: Path) -> None:
    kandy = search(places_db, "kandy", 1)[0]
    assert get_place(places_db, kandy.id) == kandy
    assert get_place(places_db, -1) is None


def test_every_sinhala_name_in_the_data_is_well_formed() -> None:
    with LK_CSV.open(encoding="utf-8", newline="") as handle:
        names = [row["name_si"] for row in csv.DictReader(handle) if row["name_si"]]
    assert len(names) > 100
    assert all(is_well_formed(name) for name in names)


@pytest.mark.parametrize(
    "broken",
    [
        "ෙකාළඹ",  # vowel sign typed before the consonant
        "Kandy",  # not Sinhala at all
        "",
    ],
)
def test_broken_sinhala_is_rejected(broken: str) -> None:
    assert not is_well_formed(broken)


def test_best_name_prefers_the_most_complete() -> None:
    # "Mirissa" appears both with and without its vowel signs.
    assert best_name([("මරසස", False), ("මිරිස්ස", False)]) == "මිරිස්ස"
    assert best_name([("මිරිස්ස", False), ("මිරිස", True)]) == "මිරිස"


def test_normalize() -> None:
    assert normalize("  Dehiwala-Mount  Lavinia ") == "dehiwala mount lavinia"
    assert normalize("São Paulo") == "sao paulo"
    assert normalize("මහනුවර") == "මහනුවර"
