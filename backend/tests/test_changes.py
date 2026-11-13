"""Planet changes: the shared list, and the houses counted from a sign."""

from datetime import datetime, timedelta, timezone

import pytest

from app.engine.changes import (
    START,
    all_changes,
    changes_between,
    count_from,
    find_change,
    saturn_notes,
)
from app.engine.ephemeris import SwissEphemeris
from app.engine.zodiac import RASHI, Body

EPHEMERIS = SwissEphemeris()
SL = timezone(timedelta(hours=5, minutes=30))

# The upcoming changes in Sri Lanka time, as published in the almanacs (see test_transits.py).
EXPECTED = [
    ("rahu-ketu-2026-12", datetime(2026, 12, 5, 22, 32, tzinfo=SL)),
    ("jupiter-2027-01", datetime(2027, 1, 25, 1, 32, tzinfo=SL)),
    ("saturn-2027-06", datetime(2027, 6, 3, 5, 28, tzinfo=SL)),
    ("jupiter-2027-06", datetime(2027, 6, 26, 5, 19, tzinfo=SL)),
    ("saturn-2027-10", datetime(2027, 10, 20, 7, 12, tzinfo=SL)),
    ("jupiter-2027-11", datetime(2027, 11, 26, 18, 45, tzinfo=SL)),
]


def test_the_changes_up_to_2028_are_the_almanac_ones() -> None:
    found = changes_between(EPHEMERIS, START, datetime(2028, 1, 1, tzinfo=SL))
    assert [c.id for c in found] == [change_id for change_id, _ in EXPECTED]
    for change, (_, moment) in zip(found, EXPECTED, strict=True):
        assert abs(change.moment - moment) <= timedelta(minutes=2), change.id


def test_ids_are_unique_and_in_time_order() -> None:
    changes = all_changes(EPHEMERIS)
    assert len({c.id for c in changes}) == len(changes)
    assert [c.moment for c in changes] == sorted(c.moment for c in changes)


def test_the_list_is_worked_out_once() -> None:
    assert all_changes(EPHEMERIS) is all_changes(EPHEMERIS)


def test_rahu_and_ketu_are_one_change() -> None:
    change = find_change(EPHEMERIS, "rahu-ketu-2026-12")
    assert change is not None
    assert change.kind == "rahu-ketu"
    assert [m.body for m in change.moves] == [Body.RAHU, Body.KETU]
    rahu, ketu = change.moves
    assert (RASHI[rahu.from_sign], RASHI[rahu.to_sign]) == ("kumbha", "makara")
    assert (RASHI[ketu.from_sign], RASHI[ketu.to_sign]) == ("simha", "kataka")
    # The nodes always move backwards, so this is not called a retrograde step.
    assert not rahu.retrograde and not ketu.retrograde
    # They next move in June 2028 (Sri Lanka time), into Dhanu and Mithuna.
    assert rahu.until is not None and rahu.until.astimezone(SL).date().isoformat() == "2028-06-24"
    assert (RASHI[rahu.next_sign or 0], RASHI[ketu.next_sign or 0]) == ("dhanu", "mithuna")
    assert dict(change.others) == {
        Body.SATURN: RASHI.index("meena"),
        Body.JUPITER: RASHI.index("simha"),
    }


def test_a_backward_step_is_marked() -> None:
    change = find_change(EPHEMERIS, "jupiter-2027-01")
    assert change is not None
    (jupiter,) = change.moves
    assert jupiter.retrograde
    assert RASHI[jupiter.next_sign or 0] == "simha"  # it returns in June 2027
    forward = find_change(EPHEMERIS, "jupiter-2027-06")
    assert forward is not None and not forward.moves[0].retrograde


def test_unknown_change() -> None:
    assert find_change(EPHEMERIS, "rahu-ketu-1999-01") is None


# Rahu Kumbha to Makara, Ketu Simha to Kataka, counted by hand from each lagna.
BY_HAND = {
    "mesha": ((11, 10), (5, 4)),
    "vrishabha": ((10, 9), (4, 3)),
    "mithuna": ((9, 8), (3, 2)),
    "kataka": ((8, 7), (2, 1)),
    "simha": ((7, 6), (1, 12)),
    "kanya": ((6, 5), (12, 11)),
    "tula": ((5, 4), (11, 10)),
    "vrischika": ((4, 3), (10, 9)),
    "dhanu": ((3, 2), (9, 8)),
    "makara": ((2, 1), (8, 7)),
    "kumbha": ((1, 12), (7, 6)),
    "meena": ((12, 11), (6, 5)),
}


@pytest.mark.parametrize("lagna", RASHI)
def test_houses_for_every_lagna(lagna: str) -> None:
    change = find_change(EPHEMERIS, "rahu-ketu-2026-12")
    assert change is not None
    counted = count_from(change, RASHI.index(lagna))
    assert tuple((m.from_house, m.to_house) for m in counted.moves) == BY_HAND[lagna]
    assert {body for body, _, _ in counted.others} == {Body.SATURN, Body.JUPITER}
    assert counted.provisional is True


def test_a_return_after_a_backward_step_is_marked() -> None:
    flags = {c.id: [(m.retrograde, m.returning) for m in c.moves] for c in all_changes(EPHEMERIS)}
    assert flags["jupiter-2027-01"] == [(True, False)]
    assert flags["jupiter-2027-06"] == [(False, True)]
    assert flags["saturn-2027-06"] == [(False, False)]  # its first move into Mesha
    assert flags["saturn-2027-10"] == [(True, False)]
    assert flags["saturn-2028-02"] == [(False, True)]
    assert flags["jupiter-2027-11"] == [(False, False)]


@pytest.mark.parametrize(
    ("change_id", "moon", "notes"),
    [
        ("saturn-2027-06", "mesha", ["erashtaka_continues"]),  # 12th to 1st
        ("saturn-2027-06", "meena", ["erashtaka_continues"]),  # 1st to 2nd
        ("saturn-2027-06", "vrishabha", ["erashtaka_starts"]),  # 11th to 12th
        ("saturn-2027-06", "kumbha", ["erashtaka_ends"]),  # 2nd to 3rd
        ("saturn-2027-06", "kanya", ["ashtama_starts"]),  # 7th to 8th
        ("saturn-2027-06", "simha", ["ashtama_ends"]),  # 8th to 9th
        ("saturn-2027-06", "tula", []),  # 6th to 7th
        ("saturn-2027-10", "vrishabha", ["erashtaka_ends"]),  # back from 12th to 11th
        ("rahu-ketu-2026-12", "mesha", []),  # only Saturn counts
    ],
)
def test_saturn_periods_from_the_moon(change_id: str, moon: str, notes: list[str]) -> None:
    change = find_change(EPHEMERIS, change_id)
    assert change is not None
    assert saturn_notes(count_from(change, RASHI.index(moon))) == notes
