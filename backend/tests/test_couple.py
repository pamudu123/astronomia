"""Years ahead for a couple: Saturn periods from the Moon sign, overlaps and dasha periods."""

import itertools
from datetime import UTC, date, datetime, timedelta, timezone

from app.engine.couple import (
    SaturnKind,
    SaturnPeriod,
    Stay,
    dasha_periods,
    overlaps,
    saturn_periods,
    saturn_stays,
    window,
)
from app.engine.ephemeris import SwissEphemeris
from app.engine.zodiac import RASHI

EPHEMERIS = SwissEphemeris()
IST = timezone(timedelta(hours=5, minutes=30))  # Indian almanacs print Indian time
TODAY = date(2026, 11, 12)


def at(year: int, month: int = 1, day: int = 1) -> datetime:
    return datetime(year, month, day, tzinfo=UTC)


def period(
    start: int,
    end: int,
    from_before: bool = False,
    continues: bool = False,
    kind: SaturnKind = "erashtaka",
) -> SaturnPeriod:
    return SaturnPeriod(at(start), at(end), from_before, continues, kind=kind)


def test_window_is_ten_years_from_the_start_of_the_day() -> None:
    assert window(TODAY) == (at(2026, 11, 12), at(2036, 11, 12))
    assert window(date(2028, 2, 29))[1] == at(2038, 2, 28)


def test_saturn_stays_cover_the_window_and_match_the_almanac() -> None:
    stays = saturn_stays(EPHEMERIS, TODAY)
    assert stays[0].start == at(2026, 11, 12)
    assert stays[-1].end == at(2036, 11, 12)
    assert all(a.end == b.start for a, b in itertools.pairwise(stays))
    # Saturn enters Mesha on 3 June 2027 and steps back into Meena on 20 October 2027.
    assert [RASHI[s.sign] for s in stays[:3]] == ["meena", "mesha", "meena"]
    assert stays[1].start.astimezone(IST).date() == date(2027, 6, 3)
    assert stays[2].start.astimezone(IST).date() == date(2027, 10, 20)


def test_erashtaka_runs_through_the_twelfth_first_and_second() -> None:
    # Saturn in Kumbha, Meena, Mesha, then Vrishabha: for a Meena Moon these are the
    # 12th, 1st, 2nd and 3rd.
    stays = (
        Stay(10, at(2023), at(2025)),
        Stay(11, at(2025), at(2027)),
        Stay(0, at(2027), at(2030)),
        Stay(1, at(2030), at(2032)),
    )
    found = saturn_periods(stays, RASHI.index("meena"))
    assert found == [SaturnPeriod(at(2023), at(2030), from_before=True, kind="erashtaka")]


def test_the_eighth_is_its_own_kind_and_other_houses_are_left_out() -> None:
    stays = (Stay(11, at(2025), at(2027)), Stay(0, at(2027), at(2030)))
    # Meena is the 8th from Simha. Mesha is the 9th.
    assert saturn_periods(stays, RASHI.index("simha")) == [
        SaturnPeriod(at(2025), at(2027), from_before=True, kind="ashtama")
    ]
    # Meena and Mesha are the 6th and 7th from Tula: nothing.
    assert saturn_periods(stays, RASHI.index("tula")) == []


def test_a_step_back_splits_a_period_and_the_end_of_the_window_is_marked() -> None:
    # For a Simha Moon: Meena (8th), Mesha (9th), back to Meena (8th), then Kataka (12th).
    stays = (
        Stay(11, at(2026), at(2027, 6)),
        Stay(0, at(2027, 6), at(2027, 10)),
        Stay(11, at(2027, 10), at(2028)),
        Stay(3, at(2028), at(2030)),
    )
    found = saturn_periods(stays, RASHI.index("simha"))
    assert [(p.kind, p.from_before, p.continues) for p in found] == [
        ("ashtama", True, False),
        ("ashtama", False, False),
        ("erashtaka", False, True),
    ]
    # The 8th and the 12th touch here, but they are different kinds, so they stay apart.
    assert found[1].end == found[2].start


def test_real_periods_for_a_meena_moon() -> None:
    found = saturn_periods(saturn_stays(EPHEMERIS, TODAY), RASHI.index("meena"))
    # Erashtaka is running, and ends when Saturn first enters Vrishabha (the 3rd).
    assert found[0].kind == "erashtaka"
    assert found[0].from_before
    assert found[0].end.year == 2029
    assert not found[-1].continues


def test_overlaps() -> None:
    assert overlaps([period(2026, 2028)], [period(2029, 2031)]) == []
    assert overlaps([period(2026, 2028)], [period(2028, 2031)]) == []  # only touching
    partial = overlaps([period(2026, 2029)], [period(2028, 2031)])
    assert [(s.start, s.end) for s in partial] == [(at(2028), at(2029))]
    inside = overlaps([period(2026, 2036)], [period(2028, 2030), period(2032, 2033)])
    assert [(s.start, s.end) for s in inside] == [(at(2028), at(2030)), (at(2032), at(2033))]


def test_overlap_edges_are_open_only_when_both_are() -> None:
    both = overlaps(
        [period(2026, 2030, from_before=True)],
        [period(2026, 2036, from_before=True, continues=True)],
    )
    assert (both[0].from_before, both[0].continues) == (True, False)
    one = overlaps([period(2026, 2030, from_before=True)], [period(2026, 2028)])
    assert one[0].from_before is False


def test_touching_overlaps_are_joined() -> None:
    # The groom's 8th and 12th touch; the bride's period covers both.
    joined = overlaps(
        [period(2026, 2036)],
        [period(2027, 2029, kind="ashtama"), period(2029, 2031, kind="erashtaka")],
    )
    assert [(s.start, s.end) for s in joined] == [(at(2027), at(2031))]


def test_dasha_periods_touch_the_window_and_follow_on() -> None:
    start, end = window(TODAY)
    birth = datetime(1995, 4, 19, 9, 5, tzinfo=UTC)
    mains = dasha_periods(241.5, birth, start, end)
    assert mains[0].start <= start < mains[0].end
    assert mains[-1].start < end <= mains[-1].end
    assert all(a.end == b.start for a, b in itertools.pairwise(mains))
    subs = [sub for main in mains for sub in main.children]
    assert subs[0].start <= start < subs[0].end
    assert all(sub.start < end and sub.end > start for sub in subs)
    assert all(a.end == b.start for a, b in itertools.pairwise(subs))
