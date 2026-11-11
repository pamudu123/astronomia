"""Local birth time and place to UTC, with the real time zone history of every country.

Time zone rules come from the `tzdata` package, not the server's operating system, so a
result never changes because the server was updated.

When clocks change, a local time can be ambiguous (clocks went back, so it happened twice)
or nonexistent (clocks went forward, so it never happened). Neither is guessed: the result
lists the options, and the caller passes `fold` (0 = earlier offset, 1 = later offset) to choose.
"""

import zoneinfo
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from enum import StrEnum
from typing import Literal

# Use only the bundled tzdata package, never the operating system's copy.
zoneinfo.reset_tzpath(to=[])

MIN_YEAR = 1800
MAX_YEAR = 2200

Fold = Literal[0, 1]


class TimeStatus(StrEnum):
    OK = "ok"
    AMBIGUOUS = "ambiguous"
    NONEXISTENT = "nonexistent"


class TimeConversionError(ValueError):
    """The input cannot be converted (unknown time zone, year out of range)."""


@dataclass(frozen=True)
class TimeOption:
    fold: Fold
    utc: datetime
    offset_seconds: int
    abbreviation: str


@dataclass(frozen=True)
class TimeResolution:
    status: TimeStatus
    timezone: str
    local: datetime
    utc: datetime | None = None
    offset_seconds: int | None = None
    abbreviation: str | None = None
    clock_change: TimeStatus | None = None
    options: list[TimeOption] = field(default_factory=list)


def format_offset(seconds: int) -> str:
    """+19800 -> "UTC+05:30". Local mean time keeps its seconds: "UTC+05:19:24"."""
    sign = "+" if seconds >= 0 else "-"
    hours, rest = divmod(abs(seconds), 3600)
    minutes, secs = divmod(rest, 60)
    text = f"UTC{sign}{hours:02d}:{minutes:02d}"
    return f"{text}:{secs:02d}" if secs else text


def load_zone(name: str) -> zoneinfo.ZoneInfo:
    try:
        return zoneinfo.ZoneInfo(name)
    except (zoneinfo.ZoneInfoNotFoundError, ValueError) as error:
        raise TimeConversionError(f"unknown time zone: {name}") from error


def _option(naive: datetime, zone: zoneinfo.ZoneInfo, fold: Fold) -> TimeOption:
    aware = naive.replace(tzinfo=zone, fold=fold)
    offset = aware.utcoffset() or timedelta(0)
    return TimeOption(
        fold=fold,
        # Subtract the offset directly: for a nonexistent time, astimezone() would
        # silently use the other offset.
        utc=(naive - offset).replace(tzinfo=UTC),
        offset_seconds=int(offset.total_seconds()),
        abbreviation=aware.tzname() or "",
    )


def resolve_local_time(
    day: date, clock: time, timezone: str, fold: Fold | None = None
) -> TimeResolution:
    if not MIN_YEAR <= day.year <= MAX_YEAR:
        raise TimeConversionError(f"year must be between {MIN_YEAR} and {MAX_YEAR}")
    zone = load_zone(timezone)
    naive = datetime.combine(day, clock.replace(tzinfo=None))
    earlier, later = _option(naive, zone, 0), _option(naive, zone, 1)

    if earlier.offset_seconds == later.offset_seconds:
        return TimeResolution(
            status=TimeStatus.OK,
            timezone=timezone,
            local=naive,
            utc=earlier.utc,
            offset_seconds=earlier.offset_seconds,
            abbreviation=earlier.abbreviation,
        )

    # The two readings differ, so a clock change is involved. A real (ambiguous) local
    # time survives a round trip through UTC; a skipped (nonexistent) one does not.
    round_trip = earlier.utc.astimezone(zone).replace(tzinfo=None)
    change = TimeStatus.AMBIGUOUS if round_trip == naive else TimeStatus.NONEXISTENT

    if fold is None:
        return TimeResolution(
            status=change,
            timezone=timezone,
            local=naive,
            clock_change=change,
            options=[earlier, later],
        )

    chosen = earlier if fold == 0 else later
    return TimeResolution(
        status=TimeStatus.OK,
        timezone=timezone,
        local=naive,
        utc=chosen.utc,
        offset_seconds=chosen.offset_seconds,
        abbreviation=chosen.abbreviation,
        clock_change=change,
        options=[earlier, later],
    )
