"""Today's date, so "today", "tomorrow" and "yesterday" mean the real days (QA ASTRO-01).

A model has no clock: asked for "today" it guessed a date from its training. Two things fix
that, and both read the same clock:

- `today_middleware` adds a short "Today" note to the system prompt on every model call, with
  the date in Sri Lanka (the site's default place).
- `current_date` (in `app/tools/calendar.py`) gives the date in any other time zone, for a
  place abroad, where the local date can differ from Sri Lanka's.

Tests swap the clock with `set_clock`.
"""

import datetime as dt
import zoneinfo
from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from langchain_core.messages import SystemMessage

SRI_LANKA = "Asia/Colombo"


def _system_now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


_clock: Callable[[], dt.datetime] = _system_now


def set_clock(clock: Callable[[], dt.datetime] | None) -> None:
    """Use another clock (tests). None goes back to the real one."""
    global _clock
    _clock = clock or _system_now


def now() -> dt.datetime:
    """The current moment, in UTC."""
    return _clock().astimezone(dt.UTC)


def zone(name: str) -> zoneinfo.ZoneInfo:
    """A time zone by its IANA name, or ValueError for an unknown one."""
    try:
        return zoneinfo.ZoneInfo(name)
    except (zoneinfo.ZoneInfoNotFoundError, ValueError) as error:
        raise ValueError(
            f"Unknown time zone '{name}'. Use an IANA name like 'Europe/London'."
        ) from error


def local_days(timezone: str = SRI_LANKA) -> dict[str, str]:
    """Today, tomorrow and yesterday on the local calendar of a time zone, as YYYY-MM-DD."""
    local = now().astimezone(zone(timezone))
    today = local.date()
    return {
        "timezone": timezone,
        "local_time": local.strftime("%H:%M"),
        "today": today.isoformat(),
        "weekday": today.strftime("%A"),
        "tomorrow": (today + dt.timedelta(days=1)).isoformat(),
        "yesterday": (today - dt.timedelta(days=1)).isoformat(),
    }


def today_note() -> str:
    days = local_days(SRI_LANKA)
    return (
        "# Today\n\n"
        f"In Sri Lanka ({SRI_LANKA}) it is now {days['local_time']} on {days['weekday']}, "
        f"{days['today']}. Tomorrow is {days['tomorrow']}; yesterday was {days['yesterday']}.\n"
        "Use these dates for 'today', 'tomorrow' and 'yesterday' in Sri Lanka. For a place in "
        "another time zone, call `current_date` with that place's time zone first: its date can "
        "differ. Never guess a date. Put the same date in the lookup and in your answer."
    )


@wrap_model_call
async def today_middleware(
    request: ModelRequest[Any],
    handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
) -> ModelResponse[Any]:
    """Adds today's date to the end of the system prompt, read fresh for every call."""
    note = today_note()
    base = request.system_prompt
    content = f"{base}\n\n{note}" if base else note
    return await handler(request.override(system_message=SystemMessage(content=content)))
