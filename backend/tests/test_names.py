"""The name letter table: its sources, its majority rule and the engine around it."""

import datetime as dt
import json
import unicodedata
import zoneinfo
from collections import Counter
from pathlib import Path

import pytest

from app.api.charts import EPHEMERIS
from app.engine import names
from app.engine.chart import Point
from app.engine.ephemeris import julian_day
from app.engine.zodiac import NAKSHATRA, RASHI

OBSERVED = json.loads(
    (Path(__file__).parent / "golden" / "name_letters_observed.json").read_text("utf-8")
)
COLOMBO = zoneinfo.ZoneInfo("Asia/Colombo")

# Slots where the three Sri Lankan sources all differ. The classical Indian table breaks the tie.
TIE_BREAKS = {("ardra", 4): "ඡ", ("shravana", 4): "ඛ"}


def _sources() -> dict[tuple[str, int], list[str]]:
    site = {(b["star"], b["pada"]): b["letter"] for b in OBSERVED["lankahandahana_births"]}
    slots: dict[tuple[str, int], list[str]] = {}
    for star in NAKSHATRA:
        for pada in range(1, 5):
            seen = [
                site[star, pada],
                OBSERVED["laksara"][star][pada - 1],
                OBSERVED["lankadeepa"][star][pada - 1],
            ]
            slots[star, pada] = [letter for letter in seen if letter]  # one gap in Lankadeepa
    return slots


def test_every_star_has_four_padas() -> None:
    stars = names.load_rules()["stars"]
    assert list(stars) == list(NAKSHATRA)
    assert all(len(rows) == 4 for rows in stars.values())


def test_the_table_is_provisional() -> None:
    rules = names.load_rules()
    assert rules["provisional"] is True
    assert rules["version"] == "name_letters_si_v1"


@pytest.mark.parametrize(("slot", "seen"), list(_sources().items()))
def test_each_letter_is_the_majority_of_three_sources(
    slot: tuple[str, int], seen: list[str]
) -> None:
    chosen = names.letter_for(*slot)
    letter, count = Counter(seen).most_common(1)[0]
    if count >= 2:
        assert chosen.letter == letter
    else:
        assert chosen.letter == TIE_BREAKS[slot]
    # Every other spelling a source gave is kept for the astrologer.
    assert set(chosen.others) == set(seen) - {chosen.letter}


def test_the_site_star_and_pada_match_our_engine() -> None:
    """lankahandahana.com's star and pada for 108 made-up births agree with ours."""
    births = OBSERVED["lankahandahana_births"]
    assert len(births) == 108
    for birth in births:
        local = dt.datetime.fromisoformat(birth["local"]).replace(tzinfo=COLOMBO)
        moon = Point.at(EPHEMERIS.sun_moon(julian_day(local.astimezone(dt.UTC)))[1])
        assert (NAKSHATRA[moon.nakshatra], moon.pada) == (birth["star"], birth["pada"])
        assert moon.pada == birth["site_pada"]


def test_letters_are_sinhala_and_transliterations_are_latin() -> None:
    for star in NAKSHATRA:
        for row in names.star_letters(star):
            assert all("SINHALA" in unicodedata.name(c) for c in row.letter), row
            assert row.latin.isascii() and row.latin[0].isupper(), row


def test_lagna_and_weekday_tables_are_complete() -> None:
    for sign in range(12):
        assert names.lagna_letters(sign), RASHI[sign]
    for day in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"):
        assert names.weekday_letters(day), day


def test_bad_input_is_refused() -> None:
    with pytest.raises(ValueError):
        names.letter_for("pluto", 1)
    with pytest.raises(ValueError):
        names.letter_for("ashwini", 5)


def _utc(local: str) -> dt.datetime:
    return dt.datetime.fromisoformat(local).replace(tzinfo=COLOMBO).astimezone(dt.UTC)


def test_a_pada_change_soon_after_the_birth_time() -> None:
    (near,) = names.nearby_padas(EPHEMERIS, _utc("2024-01-18T15:10"))
    assert (near.minutes, near.direction, near.star, near.pada) == (3, "after", "ashwini", 3)


def test_a_pada_change_just_before_the_birth_time() -> None:
    (near,) = names.nearby_padas(EPHEMERIS, _utc("2024-01-18T21:05"))
    assert (near.minutes, near.direction, near.star, near.pada) == (1, "before", "ashwini", 3)


def test_no_change_in_the_middle_of_a_pada() -> None:
    assert names.nearby_padas(EPHEMERIS, _utc("2024-01-18T11:50")) == ()
