"""Today's date in any time zone, and the New Year times with or without an official list.

Regression tests for the live QA of 15 November 2026: ASTRO-01 ("today" was a guessed date)
and ASTRO-03 (no dawn time for a year without an official list).
"""

import datetime as dt
from collections.abc import Iterator
from typing import Any

import httpx
import pytest

from app import clock

from .test_topic_tools import tool_for


@pytest.fixture
def late_evening_utc() -> Iterator[None]:
    # 19:30 UTC on 15 November 2026: 01:00 on the 16th in Colombo, still the 15th in London
    # and New York.
    clock.set_clock(lambda: dt.datetime(2026, 11, 15, 19, 30, tzinfo=dt.UTC))
    yield
    clock.set_clock(None)


def unused(request: httpx.Request) -> httpx.Response:
    raise AssertionError("the engine should not be called")


@pytest.mark.usefixtures("late_evening_utc")
async def test_current_date_defaults_to_sri_lanka() -> None:
    out = await tool_for(unused, "current_date").ainvoke({})

    assert out == {
        "timezone": "Asia/Colombo",
        "local_time": "01:00",
        "today": "2026-11-16",
        "weekday": "Monday",
        "tomorrow": "2026-11-17",
        "yesterday": "2026-11-15",
    }


@pytest.mark.usefixtures("late_evening_utc")
async def test_current_date_follows_the_places_own_calendar() -> None:
    tool = tool_for(unused, "current_date")

    london = await tool.ainvoke({"timezone": "Europe/London"})
    new_york = await tool.ainvoke({"timezone": "America/New_York"})

    assert (london["today"], london["local_time"]) == ("2026-11-15", "19:30")
    assert london["tomorrow"] == "2026-11-16"
    assert (new_york["today"], new_york["yesterday"]) == ("2026-11-15", "2026-11-14")


async def test_current_date_refuses_an_unknown_zone_plainly() -> None:
    out = await tool_for(unused, "current_date").ainvoke({"timezone": "Mars/Olympus"})

    assert "Unknown time zone 'Mars/Olympus'" in out


async def test_find_place_gives_the_time_zone_for_current_date() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        place = {"id": 2643743, "name": "London", "country_name": "United Kingdom"}
        return httpx.Response(200, json={"places": [{**place, "timezone": "Europe/London"}]})

    out = await tool_for(handler, "find_place").ainvoke({"query": "London"})

    assert out["places"][0]["timezone"] == "Europe/London"


def both(sl: tuple[str, str], local: tuple[str, str]) -> dict[str, Any]:
    def moment(clock: str, date: str) -> dict[str, str]:
        return {"utc": "", "local": "", "clock": clock, "date": date}

    return {"sri_lanka": moment(*sl), "local": moment(*local)}


def avurudu_body(*, official: bool, timezone: str) -> dict[str, Any]:
    """The engine's /v1/avurudu answer, cut down to the fields the tool reads."""
    items = []
    if official:
        items = [
            {
                "key": "dawn",
                "name": "Dawn of the New Year",
                "text": "The new year dawns.",
                "at": both(("09:32", "2027-04-14"), ("05:02", "2027-04-14")),
                "start": None,
                "end": None,
                "date_text": None,
                "colour": None,
                "direction": None,
            }
        ]
    return {
        "year": 2028 if not official else 2027,
        "official": official,
        "source": "Department of Cultural Affairs" if official else None,
        "timezone": timezone,
        "calculated": {
            "dawn": both(("21:44", "2028-04-13"), ("17:14", "2028-04-13")),
            "punya_start": both(("15:20", "2028-04-13"), ("10:50", "2028-04-13")),
            "punya_end": both(("04:08", "2028-04-14"), ("23:38", "2028-04-13")),
            "dawn_difference": 3 if official else None,
            "punya_difference": None,
        },
        "items": items,
        "notes": ["A note."],
        "provisional": True,
    }


async def test_new_year_without_an_official_list_still_gives_the_calculated_dawn() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=avurudu_body(official=False, timezone="Asia/Colombo"))

    out = await tool_for(handler, "new_year_times").ainvoke({"year": 2028})

    assert seen[0].url.path == "/v1/avurudu/2028"
    assert seen[0].url.params["timezone"] == "Asia/Colombo"
    assert out["official_list"] is False
    assert out["official"]["times"] == []
    assert "No official list" in out["official"]["label"]
    assert out["calculated"]["new_year_dawn"] == "21:44 on 2028-04-13 Sri Lanka time"
    assert "Calculated by the site" in out["calculated"]["label"]


async def test_new_year_times_in_the_chosen_zone_keep_both_kinds_apart() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=avurudu_body(official=True, timezone="Europe/London"))

    out = await tool_for(handler, "new_year_times").ainvoke(
        {"year": 2027, "timezone": "Europe/London"}
    )

    assert seen[0].url.params["timezone"] == "Europe/London"
    assert out["timezone"] == "Europe/London"
    assert out["official"]["label"] == "Official times from Department of Cultural Affairs"
    assert out["official"]["times"][0]["at"] == (
        "09:32 on 2027-04-14 Sri Lanka time; 05:02 on 2027-04-14 in Europe/London"
    )
    assert out["calculated"]["new_year_dawn"] == (
        "21:44 on 2028-04-13 Sri Lanka time; 17:14 on 2028-04-13 in Europe/London"
    )
    assert out["calculated"]["minutes_after_official_dawn"] == 3


def test_tool_descriptions_say_what_each_needs() -> None:
    # QA ASTRO-02: the guide said a wedding date needed full birth charts.
    from app.graph import system_prompt

    prompt = system_prompt()
    assert "# What each tool needs" in prompt
    assert "quick match (birth stars only)" in prompt
    assert "venue" in prompt
    description = tool_for(unused, "new_year_times").description
    assert "calculated" in description
    assert "official" in description
