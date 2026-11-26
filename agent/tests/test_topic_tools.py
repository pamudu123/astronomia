"""The calendar, naming and planet tools: the right request, and a short plain answer."""

import datetime as dt
from typing import Any

import httpx
import pytest

from app import clock
from app.tools import EngineClient, engine_tools

from .test_engine_tools import engine_with


def moment(clock: str, date: str) -> dict[str, str]:
    return {"utc": "", "local": "", "clock": clock, "date": date}


def tool_for(handler: Any, name: str) -> Any:
    engine: EngineClient = engine_with(handler)
    (found,) = [t for t in engine_tools(engine) if t.name == name]
    return found


async def test_good_times_default_to_colombo_and_mark_times_on_other_days() -> None:
    seen: list[httpx.Request] = []
    day = "2026-11-15"

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        part = {
            "name": "Bright 6",
            "start": moment("23:25", "2026-11-14"),
            "end": moment("02:02", "2026-11-16"),
        }
        return httpx.Response(
            200,
            json={
                "date": day,
                "weekday_name": "Sunday",
                "place": {"name": "Colombo"},
                "sunrise": moment("06:00", day),
                "sunset": moment("17:49", day),
                "rahu_kalaya": {"start": moment("16:16", day), "end": moment("17:44", day)},
                "thithi": [part],
                "nakatha": [],
                "yoga": [],
                "karana": [],
                "timezone_note": "Times are in Asia/Colombo.",
                "provisional": True,
            },
        )

    out = await tool_for(handler, "good_times_for_day").ainvoke({"date": day})

    assert seen[0].url.path == "/v1/panchanga"
    assert seen[0].url.params["place_id"] == "1248991"
    assert out["rahu_kalaya"] == "16:16 to 17:44"
    assert out["thithi"] == [
        {"name": "Bright 6", "from": "23:25 on 2026-11-14", "to": "02:02 on 2026-11-16"}
    ]


async def test_a_date_that_never_happened_says_so() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "date": "2011-12-30",
                "weekday_name": "Friday",
                "place": {"name": "Apia"},
                "sunrise": None,
                "sunset": None,
                "rahu_kalaya": None,
                "thithi": [],
                "nakatha": [],
                "yoga": [],
                "karana": [],
                "timezone_note": "Times are in Pacific/Apia.",
                "provisional": True,
                "skipped": True,
                "skipped_note": "This date did not happen here.",
            },
        )

    out = await tool_for(handler, "good_times_for_day").ainvoke({"date": "2011-12-30"})

    assert out["skipped_date"] == "This date did not happen here."
    assert out["sunrise"] is None and out["thithi"] == []


async def test_a_bad_date_is_refused_before_calling_the_engine() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("the engine should not be called")

    tool = tool_for(handler, "good_times_for_day")
    try:
        await tool.ainvoke({"date": "15 Nov"})
    except Exception as error:
        assert "date" in str(error)
    else:
        raise AssertionError("expected a validation error")


async def test_names_for_letters_sends_each_letter_and_keeps_the_list_short() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        names = [
            {"en": f"Name{i}", "si": "නම", "gender": "girl", "meaning": "A meaning"}
            for i in range(25)
        ]
        return httpx.Response(
            200,
            json={"letters": [{"letter": "ව", "count": 25}], "names": names, "provisional": True},
        )

    out = await tool_for(handler, "names_for_letters").ainvoke({"letters": ["ව", "වි"]})

    assert seen[0].url.params.get_list("letters") == ["ව", "වි"]
    assert len(out["names"]) == 20
    assert out["more_on_the_page"] == 5


async def test_planet_change_for_sign_reads_the_change_for_that_rising_sign() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "change": {
                    "id": "saturn-2027-06",
                    "title": "Saturn change",
                    "when": "3 June 2027",
                    "moves": [{"text": "Saturn moves from Meena into Mesha."}],
                },
                "lagna": {
                    "sign_name": "Mesha",
                    "moves": [
                        {
                            "text": "Saturn enters your 1st house.",
                            "from_theme": "Rest.",
                            "to_theme": "Yourself.",
                        }
                    ],
                    "others": [{"text": "Jupiter stays in Kataka."}],
                    "notes": [],
                },
                "moon_notes": [],
                "provisional": True,
            },
        )

    tool = tool_for(handler, "planet_change_for_sign")
    out = await tool.ainvoke({"change_id": "saturn-2027-06", "sign": "mesha"})

    assert seen[0].url.path == "/v1/changes/saturn-2027-06/mesha"
    assert out["for_this_sign"] == [
        {"move": "Saturn enters your 1st house.", "leaves": "Rest.", "enters": "Yourself."}
    ]


async def test_an_unknown_sign_is_refused() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("the engine should not be called")

    tool = tool_for(handler, "year_ahead_for_sign")
    try:
        await tool.ainvoke({"year": 2027, "sign": "aries"})
    except Exception as error:
        assert "sign" in str(error)
    else:
        raise AssertionError("expected a validation error")


async def test_a_day_at_one_hour_says_what_holds_then() -> None:
    day = "2026-12-09"

    def handler(request: httpx.Request) -> httpx.Response:
        def part(name: str, start: dict[str, str], end: dict[str, str]) -> dict[str, Any]:
            return {"name": name, "start": start, "end": end}

        return httpx.Response(
            200,
            json={
                "date": day,
                "weekday_name": "Wednesday",
                "place": {"name": "Colombo"},
                "sunrise": moment("06:10", day),
                "sunset": moment("17:53", day),
                "rahu_kalaya": {"start": moment("12:02", day), "end": moment("13:30", day)},
                "thithi": [
                    part("New moon", moment("04:14", "2026-12-08"), moment("06:22", day)),
                    part("Bright 1", moment("06:22", day), moment("08:47", "2026-12-10")),
                ],
                "nakatha": [
                    part("Jyeshtha", moment("18:17", "2026-12-08"), moment("21:01", day)),
                    part("Mula", moment("21:01", day), moment("23:59", "2026-12-10")),
                ],
                "yoga": [],
                "karana": [],
                "timezone_note": "Times are in Asia/Colombo.",
                "provisional": True,
            },
        )

    tool = tool_for(handler, "good_times_for_day")

    nine = await tool.ainvoke({"date": day, "time": "09:00"})
    assert nine["at_time"] == {
        "time": "09:00",
        "inside_rahu_kalaya": False,
        "thithi": "Bright 1",
        "nakatha": "Jyeshtha",
    }
    noon = await tool.ainvoke({"date": day, "time": "12:02"})
    assert noon["at_time"]["inside_rahu_kalaya"] is True
    # The end of Rahu kalaya is already outside it.
    after = await tool.ainvoke({"date": day, "time": "13:30"})
    assert after["at_time"]["inside_rahu_kalaya"] is False
    assert "at_time" not in await tool.ainvoke({"date": day})


async def test_erashtaka_is_counted_for_the_model() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        def change(id: str, body: str, came_from: str, to: str) -> dict[str, Any]:
            return {
                "id": id,
                "title": id,
                "when": "3 June 2027",
                "moves": [{"body": body, "from_sign": came_from, "to_sign": to, "text": id}],
            }

        return httpx.Response(
            200,
            json={
                "changes": [
                    change("jupiter-2027-01", "jupiter", "simha", "kataka"),
                    change("saturn-2027-06", "saturn", "meena", "mesha"),
                    change("saturn-2027-10", "saturn", "mesha", "meena"),
                ],
                "provisional": True,
            },
        )

    tool = tool_for(handler, "upcoming_planet_changes")

    def running(out: dict[str, Any]) -> tuple[bool, bool]:
        by_moon = out["saturn_now"]["by_moon_sign"]
        return by_moon["erashtaka_running"], by_moon["ashtama_shani_running"]

    expected = {"kumbha": "last", "meena": "middle", "mesha": "first"}
    for sign in ("mesha", "mithuna", "simha", "kanya", "makara", "kumbha", "meena"):
        out = await tool.ainvoke({"moon_sign": sign})
        assert out["saturn_now"]["saturn_is_in"] == "meena"
        # Saturn in Meena is the 8th sign from Simha.
        assert running(out) == (sign in expected, sign == "simha")
        assert out["saturn_now"]["by_moon_sign"].get("part") == expected.get(sign)

    both = await tool.ainvoke({"moon_sign": "mithuna", "rising_sign": "mesha"})
    assert both["saturn_now"]["by_rising_sign"]["erashtaka_running"] is True
    assert "saturn_now" not in await tool.ainvoke({})


@pytest.mark.parametrize(
    ("utc", "expected"),
    [
        ("2026-11-24T18:00", "still ahead today"),  # 13:00 in New York
        ("2026-11-24T19:30", "running now"),  # 14:30
        ("2026-11-25T04:30", "already over for today"),  # 23:30, the 25th in Sri Lanka
        ("2026-11-25T06:00", None),  # the next day there: the question is about another day
    ],
)
async def test_says_whether_todays_rahu_kalaya_has_passed(utc: str, expected: str | None) -> None:
    day = "2026-11-24"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "date": day,
                "weekday_name": "Tuesday",
                "place": {"name": "New York", "timezone": "America/New_York"},
                "sunrise": moment("06:56", day),
                "sunset": moment("16:30", day),
                "rahu_kalaya": {"start": moment("14:05", day), "end": moment("15:17", day)},
                "thithi": [],
                "nakatha": [],
                "yoga": [],
                "karana": [],
                "timezone_note": "Times are in America/New_York.",
                "provisional": True,
            },
        )

    clock.set_clock(lambda: dt.datetime.fromisoformat(utc).replace(tzinfo=dt.UTC))
    try:
        out = await tool_for(handler, "good_times_for_day").ainvoke({"date": day})
    finally:
        clock.set_clock(None)
    assert out.get("rahu_kalaya_now") == expected
    # Another place's "today" shows up as a different date here.
    assert out["now_there"].endswith(day) == (expected is not None)
