from datetime import UTC, date, datetime, time

import pytest

from app.engine.timeconv import (
    TimeConversionError,
    TimeStatus,
    format_offset,
    resolve_local_time,
)

H = 3600


@pytest.mark.parametrize(
    ("day", "expected_offset"),
    [
        (date(1990, 1, 1), 5.5 * H),
        (date(1996, 6, 1), 6.5 * H),  # clocks moved forward on 25 May 1996
        (date(1996, 12, 1), 6 * H),  # and back half an hour on 26 October 1996
        (date(2006, 5, 1), 5.5 * H),  # back to +05:30 on 15 April 2006
    ],
)
def test_sri_lanka_offsets_follow_history(day: date, expected_offset: float) -> None:
    result = resolve_local_time(day, time(10, 0), "Asia/Colombo")
    assert result.status is TimeStatus.OK
    assert result.offset_seconds == expected_offset


def test_sri_lanka_2006_change_is_ambiguous() -> None:
    # At 00:30 on 15 April 2006 clocks went back to 00:00, so 00:15 happened twice.
    result = resolve_local_time(date(2006, 4, 15), time(0, 15), "Asia/Colombo")
    assert result.status is TimeStatus.AMBIGUOUS
    assert result.utc is None
    assert [o.offset_seconds for o in result.options] == [6 * H, 5.5 * H]


def test_sri_lanka_1996_change_is_nonexistent() -> None:
    # At midnight on 25 May 1996 clocks jumped to 01:00, so 00:10 never happened.
    result = resolve_local_time(date(1996, 5, 25), time(0, 10), "Asia/Colombo")
    assert result.status is TimeStatus.NONEXISTENT
    assert result.utc is None
    assert [o.offset_seconds for o in result.options] == [5.5 * H, 6.5 * H]


def test_uk_summer_time() -> None:
    result = resolve_local_time(date(2025, 7, 1), time(12, 0), "Europe/London")
    assert result.offset_seconds == 1 * H
    assert result.abbreviation == "BST"


def test_uk_spring_forward_is_nonexistent() -> None:
    result = resolve_local_time(date(2025, 3, 30), time(1, 30), "Europe/London")
    assert result.status is TimeStatus.NONEXISTENT


def test_uk_autumn_back_is_ambiguous_and_fold_resolves_it() -> None:
    day, clock = date(2025, 10, 26), time(1, 30)
    assert resolve_local_time(day, clock, "Europe/London").status is TimeStatus.AMBIGUOUS

    first = resolve_local_time(day, clock, "Europe/London", fold=0)
    second = resolve_local_time(day, clock, "Europe/London", fold=1)
    assert first.status is TimeStatus.OK
    assert first.clock_change is TimeStatus.AMBIGUOUS
    assert first.utc == datetime(2025, 10, 26, 0, 30, tzinfo=UTC)
    assert second.utc == datetime(2025, 10, 26, 1, 30, tzinfo=UTC)


def test_nonexistent_time_with_fold_uses_the_chosen_offset() -> None:
    result = resolve_local_time(date(2025, 3, 30), time(1, 30), "Europe/London", fold=0)
    assert result.status is TimeStatus.OK
    assert result.clock_change is TimeStatus.NONEXISTENT
    assert result.utc == datetime(2025, 3, 30, 1, 30, tzinfo=UTC)


def test_southern_hemisphere_summer_time() -> None:
    january = resolve_local_time(date(2025, 1, 15), time(12, 0), "Australia/Sydney")
    july = resolve_local_time(date(2025, 7, 15), time(12, 0), "Australia/Sydney")
    assert january.offset_seconds == 11 * H
    assert july.offset_seconds == 10 * H


def test_midnight_birth_lands_on_previous_utc_day() -> None:
    result = resolve_local_time(date(2025, 1, 1), time(0, 0), "Asia/Colombo")
    assert result.utc == datetime(2024, 12, 31, 18, 30, tzinfo=UTC)


def test_before_standard_time_uses_local_mean_time() -> None:
    result = resolve_local_time(date(1880, 1, 1), time(12, 0), "Asia/Colombo")
    assert result.status is TimeStatus.OK
    assert result.offset_seconds is not None
    assert format_offset(result.offset_seconds).startswith("UTC+05:19")


def test_unknown_time_zone_is_rejected() -> None:
    with pytest.raises(TimeConversionError):
        resolve_local_time(date(2000, 1, 1), time(0, 0), "Mars/Olympus")


def test_year_out_of_range_is_rejected() -> None:
    with pytest.raises(TimeConversionError):
        resolve_local_time(date(1700, 1, 1), time(0, 0), "Asia/Colombo")


def test_format_offset() -> None:
    assert format_offset(19800) == "UTC+05:30"
    assert format_offset(-18000) == "UTC-05:00"
    assert format_offset(19172) == "UTC+05:19:32"
