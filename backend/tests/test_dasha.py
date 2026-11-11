from datetime import UTC, datetime, timedelta

import pytest

from app.engine.dasha import TOTAL_YEARS, YEAR_DAYS, YEARS, vimshottari
from app.engine.zodiac import Body

BIRTH = datetime(1995, 4, 19, 9, 5, tzinfo=UTC)
NAK = 360 / 27


def years(delta: timedelta) -> float:
    return delta.total_seconds() / 86400 / YEAR_DAYS


def test_moon_at_start_of_nakshatra_gives_full_first_period() -> None:
    timeline = vimshottari(0.0, BIRTH)  # Ashwini, ruled by Ketu
    assert timeline.periods[0].lord is Body.KETU
    assert timeline.periods[0].start == BIRTH
    assert timeline.balance_years == pytest.approx(7)


def test_balance_is_the_part_of_the_nakshatra_still_ahead() -> None:
    # Anuradha (Saturn, 19 years), Moon a quarter of the way through.
    moon = 16 * NAK + NAK / 4
    timeline = vimshottari(moon, BIRTH)
    assert timeline.periods[0].lord is Body.SATURN
    assert timeline.balance_years == pytest.approx(19 * 0.75)
    assert years(timeline.periods[0].end - BIRTH) == pytest.approx(19 * 0.75)


def test_order_and_total_length() -> None:
    timeline = vimshottari(16 * NAK, BIRTH)
    lords = [p.lord for p in timeline.periods]
    assert lords == [
        Body.SATURN,
        Body.MERCURY,
        Body.KETU,
        Body.VENUS,
        Body.SUN,
        Body.MOON,
        Body.MARS,
        Body.RAHU,
        Body.JUPITER,
    ]
    total = timeline.periods[-1].end - timeline.periods[0].start
    assert years(total) == pytest.approx(TOTAL_YEARS)


def test_sub_periods_fill_their_parent_and_start_with_its_lord() -> None:
    timeline = vimshottari(100.0, BIRTH)
    for main in timeline.periods:
        assert main.children[0].lord is main.lord
        assert main.children[0].start == main.start
        assert abs((main.children[-1].end - main.end).total_seconds()) < 1
        expected = YEARS[main.lord] * YEARS[main.children[1].lord] / TOTAL_YEARS
        assert years(main.children[1].end - main.children[1].start) == pytest.approx(expected)
        for sub in main.children:
            assert len(sub.children) == 9
            assert sub.children[0].lord is sub.lord


def test_current_period_path() -> None:
    timeline = vimshottari(100.0, BIRTH)
    path = timeline.current(datetime(2026, 11, 11, tzinfo=UTC))
    assert len(path) == 3
    assert path[1] in path[0].children
    assert path[2] in path[1].children
    assert timeline.current(datetime(1900, 1, 1, tzinfo=UTC)) == []
