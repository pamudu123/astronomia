"""The calendar, naming and planet tools: the right request, and a short plain answer."""

from typing import Any

import httpx

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
