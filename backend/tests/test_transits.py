"""Sign changes of the slow planets, checked against published almanacs (Lahiri, mean node)."""

from datetime import UTC, date, datetime, timedelta, timezone

import pytest

from app.engine.ephemeris import SwissEphemeris
from app.engine.forecast import month_bounds, month_forecast
from app.engine.transits import SLOW_BODIES, sign_changes, signs_at
from app.engine.zodiac import RASHI, Body

EPHEMERIS = SwissEphemeris()
IST = timezone(timedelta(hours=5, minutes=30))  # Indian almanacs print Indian time


def changes(year_from: int, year_to: int) -> dict[tuple[str, str, date], datetime]:
    found = sign_changes(
        EPHEMERIS, datetime(year_from, 1, 1, tzinfo=UTC), datetime(year_to, 1, 1, tzinfo=UTC)
    )
    return {
        (c.body.value, RASHI[c.to_sign], c.moment.astimezone(IST).date()): c.moment for c in found
    }


ALMANAC = [
    ("saturn", "meena", date(2025, 3, 29)),
    ("jupiter", "mithuna", date(2025, 5, 14)),
    ("jupiter", "kataka", date(2025, 10, 18)),
    ("jupiter", "mithuna", date(2025, 12, 5)),  # retrograde, back into Mithuna
    ("jupiter", "kataka", date(2026, 6, 2)),
    ("jupiter", "simha", date(2026, 10, 31)),
    ("rahu", "makara", date(2026, 12, 5)),
    ("ketu", "kataka", date(2026, 12, 5)),
    ("jupiter", "kataka", date(2027, 1, 25)),
    ("saturn", "mesha", date(2027, 6, 3)),
    ("saturn", "meena", date(2027, 10, 20)),
]


@pytest.mark.parametrize("expected", ALMANAC)
def test_sign_changes_match_the_almanac(expected: tuple[str, str, date]) -> None:
    assert expected in changes(2025, 2028)


def test_rahu_moves_at_the_almanac_minute() -> None:
    moment = changes(2026, 2027)[("rahu", "makara", date(2026, 12, 5))]
    # Published as 5 December 2026, 10:32 pm Indian time.
    assert abs(moment - datetime(2026, 12, 5, 22, 32, tzinfo=IST)) <= timedelta(minutes=2)


def test_changes_are_in_time_order_and_land_on_the_boundary() -> None:
    found = sign_changes(
        EPHEMERIS, datetime(2025, 1, 1, tzinfo=UTC), datetime(2028, 1, 1, tzinfo=UTC)
    )
    assert [c.moment for c in found] == sorted(c.moment for c in found)
    for change in found:
        before = signs_at(EPHEMERIS, change.moment - timedelta(minutes=2))[change.body]
        after = signs_at(EPHEMERIS, change.moment + timedelta(minutes=2))[change.body]
        assert (before, after) == (change.from_sign, change.to_sign)


def test_rahu_and_ketu_move_together_and_backwards() -> None:
    found = changes(2025, 2028)
    assert (
        found[("rahu", "makara", date(2026, 12, 5))] == found[("ketu", "kataka", date(2026, 12, 5))]
    )


def test_naive_times_are_refused() -> None:
    with pytest.raises(ValueError, match="timezone aware"):
        sign_changes(EPHEMERIS, datetime(2026, 1, 1), datetime(2026, 2, 1))


def test_month_bounds() -> None:
    assert month_bounds(date(2026, 12, 12)) == (
        datetime(2026, 12, 1, tzinfo=UTC),
        datetime(2027, 1, 1, tzinfo=UTC),
    )
    assert month_bounds(date(2028, 2, 29))[1] == datetime(2028, 3, 1, tzinfo=UTC)


def test_a_settled_month() -> None:
    simha = RASHI.index("simha")
    result = month_forecast(EPHEMERIS, simha, date(2026, 11, 12))
    assert [p.body for p in result.planets] == list(SLOW_BODIES)
    by_body = {p.body: p for p in result.planets}
    assert all(not p.moves for p in result.planets)
    assert (RASHI[by_body[Body.SATURN].sign], by_body[Body.SATURN].house) == ("meena", 8)
    assert (RASHI[by_body[Body.JUPITER].sign], by_body[Body.JUPITER].house) == ("simha", 1)
    assert (RASHI[by_body[Body.RAHU].sign], by_body[Body.RAHU].house) == ("kumbha", 7)
    assert (RASHI[by_body[Body.KETU].sign], by_body[Body.KETU].house) == ("simha", 1)
    assert result.provisional is True
    assert not by_body[Body.RAHU].retrograde


def test_a_month_with_a_move() -> None:
    simha = RASHI.index("simha")
    result = month_forecast(EPHEMERIS, simha, date(2026, 12, 1))
    rahu = next(p for p in result.planets if p.body is Body.RAHU)
    assert (RASHI[rahu.sign], rahu.house) == ("kumbha", 7)
    assert len(rahu.moves) == 1
    assert (RASHI[rahu.moves[0].to_sign], rahu.moves[0].to_house) == ("makara", 6)
    assert rahu.moves[0].moment.date() == date(2026, 12, 5)
    assert rahu.last_house == 6
