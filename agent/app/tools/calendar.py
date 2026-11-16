"""Calendar tools: places, today's date, the times of a day, a month's litha, and Avurudu."""

from typing import Annotated, Any

from langchain_core.tools import BaseTool, StructuredTool, ToolException
from pydantic import BaseModel, Field

from app import clock as today
from app.tools.engine import COLOMBO, EngineClient, Lang, clock, span

DATE = r"^\d{4}-\d{2}-\d{2}$"
SRI_LANKA = today.SRI_LANKA
LangField = Annotated[Lang, Field(description="Language of the names: 'en' or 'si'.")]
PlaceField = Annotated[
    int,
    Field(description="Place id from find_place, or from the page. Default: Colombo."),
]


class FindPlaceArgs(BaseModel):
    query: Annotated[str, Field(min_length=2, description="A town or city name.")]
    limit: Annotated[int, Field(ge=1, le=10)] = 5


class TodayArgs(BaseModel):
    timezone: Annotated[
        str,
        Field(
            max_length=64,
            description=(
                "The place's IANA time zone, from find_place or the page, for example "
                "'Europe/London'. Default: Sri Lanka."
            ),
        ),
    ] = SRI_LANKA


class DayArgs(BaseModel):
    date: Annotated[str, Field(pattern=DATE, description="The day, as YYYY-MM-DD.")]
    place_id: PlaceField = COLOMBO
    lang: LangField = "en"


class MonthArgs(BaseModel):
    year: Annotated[int, Field(ge=1900, le=2100)]
    month: Annotated[int, Field(ge=1, le=12)]
    place_id: PlaceField = COLOMBO
    lang: LangField = "en"


class YearArgs(BaseModel):
    year: Annotated[int, Field(ge=1950, le=2100)]
    timezone: Annotated[
        str,
        Field(
            max_length=64,
            description=(
                "IANA time zone to show the times in as well, for example 'Europe/London' "
                "(the Avurudu page's chosen zone). Default: Sri Lanka only."
            ),
        ),
    ] = SRI_LANKA
    lang: LangField = "en"


def parts(items: list[dict[str, Any]], day: str) -> list[dict[str, Any]]:
    """Thithi, nakatha, yoga or karana: each part of the day with its time range."""
    return [
        {"name": p["name"], "from": clock(p["start"], day), "to": clock(p["end"], day)}
        for p in items
    ]


def on_day(moment: dict[str, Any]) -> str:
    """A local time with its date: "09:32 on 2026-04-14"."""
    return f"{moment['clock']} on {moment['date']}"


def both(moment: dict[str, Any] | None, timezone: str) -> str | None:
    """An Avurudu time in Sri Lanka time, and in the chosen zone when that is another one:
    "21:44 on 2028-04-13 Sri Lanka time; 17:14 on 2028-04-13 in Europe/London"."""
    if not moment:
        return None
    text = f"{on_day(moment['sri_lanka'])} Sri Lanka time"
    if timezone != SRI_LANKA:
        text += f"; {on_day(moment['local'])} in {timezone}"
    return text


def tools(engine: EngineClient) -> list[BaseTool]:
    async def find_place(query: str, limit: int = 5) -> dict[str, Any]:
        body = await engine.get("/v1/places", {"q": query, "limit": limit})
        return {
            "places": [
                {
                    "place_id": p["id"],
                    "name": p["name"],
                    "country": p["country_name"],
                    "timezone": p["timezone"],
                }
                for p in body["places"]
            ]
        }

    async def current_date(timezone: str = SRI_LANKA) -> dict[str, Any]:
        try:
            return today.local_days(timezone)
        except ValueError as error:
            raise ToolException(str(error)) from error

    async def good_times_for_day(
        date: str, place_id: int = COLOMBO, lang: Lang = "en"
    ) -> dict[str, Any]:
        body = await engine.get("/v1/panchanga", {"date": date, "place_id": place_id, "lang": lang})
        return {
            "date": body["date"],
            "weekday": body["weekday_name"],
            "place": body["place"]["name"],
            "sunrise": clock(body["sunrise"], date),
            "sunset": clock(body["sunset"], date),
            "rahu_kalaya": span(body["rahu_kalaya"], date),
            "thithi": parts(body["thithi"], date),
            "nakatha": parts(body["nakatha"], date),
            "yoga": parts(body["yoga"], date),
            "karana": parts(body["karana"], date),
            "times_note": body["timezone_note"],
            "provisional": body["provisional"],
        }

    async def month_calendar(
        year: int, month: int, place_id: int = COLOMBO, lang: Lang = "en"
    ) -> dict[str, Any]:
        body = await engine.get(
            "/v1/panchanga/month",
            {"year": year, "month": month, "place_id": place_id, "lang": lang},
        )
        days = body["days"]
        return {
            "year": year,
            "month": month,
            "place": body["place"]["name"],
            "poya_days": [
                {"date": d["date"], "full_moon": clock(d["full_moon"], d["date"])}
                for d in days
                if d.get("poya")
            ],
            "days": [
                {
                    "date": d["date"],
                    "weekday": d["weekday_name"],
                    "rahu_kalaya": span(d["rahu_kalaya"], d["date"]),
                    "thithi_at_sunrise": (d.get("thithi") or {}).get("name"),
                    "nakatha_at_sunrise": (d.get("nakatha") or {}).get("name"),
                }
                for d in days
            ],
            "poya_note": body["poya_note"],
            "provisional": body["provisional"],
        }

    async def new_year_times(
        year: int, timezone: str = SRI_LANKA, lang: Lang = "en"
    ) -> dict[str, Any]:
        body = await engine.get(f"/v1/avurudu/{year}", {"timezone": timezone, "lang": lang})
        zone = body.get("timezone") or timezone
        calc = body["calculated"]
        # The site's own calculation is there for every year, the official list only for
        # some. Both go back, each labelled, so a year without a list still has its dawn
        # (QA ASTRO-03).
        return {
            "year": year,
            "timezone": zone,
            "official_list": body["official"],
            "calculated": {
                "label": "Calculated by the site from the Sun's position (its own rules).",
                "new_year_dawn": both(calc["dawn"], zone),
                "punya_kalaya_from": both(calc["punya_start"], zone),
                "punya_kalaya_to": both(calc["punya_end"], zone),
                "minutes_after_official_dawn": calc["dawn_difference"],
            },
            "official": {
                "label": (
                    f"Official times from {body['source']}"
                    if body["official"]
                    else "No official list has been published for this year yet."
                ),
                "source": body["source"],
                "times": [
                    {
                        "name": i["name"],
                        "what_to_do": i["text"],
                        "at": both(i["at"], zone),
                        "from": both(i["start"], zone),
                        "to": both(i["end"], zone),
                        "date": i["date_text"],
                        "colour": i["colour"],
                        "direction": i["direction"],
                    }
                    for i in body["items"]
                ],
            },
            "notes": body["notes"],
            "provisional": body["provisional"],
        }

    return [
        StructuredTool.from_function(
            coroutine=find_place,
            name="find_place",
            description=(
                "Find a town or city: its place id, for the times of a day or month there, "
                "and its time zone, for current_date and new_year_times."
            ),
            args_schema=FindPlaceArgs,
            handle_tool_error=True,
        ),
        StructuredTool.from_function(
            coroutine=current_date,
            name="current_date",
            description=(
                "Today's, tomorrow's and yesterday's dates (YYYY-MM-DD) and the local time in a "
                "time zone. Needs only the time zone. Use before good_times_for_day whenever "
                "the person says 'today', 'tomorrow' or 'yesterday' for a place outside Sri "
                "Lanka."
            ),
            args_schema=TodayArgs,
            handle_tool_error=True,
        ),
        StructuredTool.from_function(
            coroutine=good_times_for_day,
            name="good_times_for_day",
            description=(
                "The day's almanac for a place: sunrise, sunset, Rahu kalaya, and the thithi, "
                "nakatha, yoga and karana with the times each starts and ends. Needs an exact "
                "date (YYYY-MM-DD) and a place id. For 'today', 'tomorrow' or 'yesterday', use "
                "the date from the Today note (Sri Lanka) or from current_date (elsewhere)."
            ),
            args_schema=DayArgs,
            handle_tool_error=True,
        ),
        StructuredTool.from_function(
            coroutine=month_calendar,
            name="month_calendar",
            description=(
                "A month's litha for a place: poya days (calculated full moons) and each day's "
                "Rahu kalaya, thithi and nakatha at sunrise. Use for 'when is the next poya?' "
                "or comparing days in a month."
            ),
            args_schema=MonthArgs,
            handle_tool_error=True,
        ),
        StructuredTool.from_function(
            coroutine=new_year_times,
            name="new_year_times",
            description=(
                "The Sinhala and Tamil New Year (Avurudu) times for a year. Needs only the year "
                "(and a time zone to show local times). Gives two labelled parts: `calculated`, "
                "the site's own new year dawn and punya kalaya, there for every year; and "
                "`official`, the published list of customs with time, colour and direction, "
                "empty when no list is out yet. Without an official list, give the calculated "
                "times and say they are the site's calculation."
            ),
            args_schema=YearArgs,
            handle_tool_error=True,
        ),
    ]
