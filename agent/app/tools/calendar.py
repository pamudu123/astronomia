"""Calendar tools: places, the good and bad times of a day, a month's litha, and Avurudu."""

from typing import Annotated, Any

from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field

from app.tools.engine import COLOMBO, EngineClient, Lang, clock, span

DATE = r"^\d{4}-\d{2}-\d{2}$"
LangField = Annotated[Lang, Field(description="Language of the names: 'en' or 'si'.")]
PlaceField = Annotated[
    int,
    Field(description="Place id from find_place, or from the page. Default: Colombo."),
]


class FindPlaceArgs(BaseModel):
    query: Annotated[str, Field(min_length=2, description="A town or city name.")]
    limit: Annotated[int, Field(ge=1, le=10)] = 5


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
    lang: LangField = "en"


def parts(items: list[dict[str, Any]], day: str) -> list[dict[str, Any]]:
    """Thithi, nakatha, yoga or karana: each part of the day with its time range."""
    return [
        {"name": p["name"], "from": clock(p["start"], day), "to": clock(p["end"], day)}
        for p in items
    ]


def sri_lanka(moment: dict[str, Any] | None) -> str | None:
    """An Avurudu time in Sri Lanka time, as "09:32 on 2026-04-14"."""
    if not moment:
        return None
    sl = moment["sri_lanka"]
    return f"{sl['clock']} on {sl['date']}"


def tools(engine: EngineClient) -> list[BaseTool]:
    async def find_place(query: str, limit: int = 5) -> dict[str, Any]:
        body = await engine.get("/v1/places", {"q": query, "limit": limit})
        return {
            "places": [
                {"place_id": p["id"], "name": p["name"], "country": p["country_name"]}
                for p in body["places"]
            ]
        }

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

    async def new_year_times(year: int, lang: Lang = "en") -> dict[str, Any]:
        body = await engine.get(f"/v1/avurudu/{year}", {"lang": lang})
        return {
            "year": year,
            "official": body["official"],
            "source": body["source"],
            "times": [
                {
                    "name": i["name"],
                    "what_to_do": i["text"],
                    "at": sri_lanka(i["at"]),
                    "from": sri_lanka(i["start"]),
                    "to": sri_lanka(i["end"]),
                    "date": i["date_text"],
                    "colour": i["colour"],
                    "direction": i["direction"],
                }
                for i in body["items"]
            ],
            "notes": body["notes"],
            "times_are": "Sri Lanka time. Abroad, the same moments on the local clock.",
            "provisional": body["provisional"],
        }

    return [
        StructuredTool.from_function(
            coroutine=find_place,
            name="find_place",
            description=(
                "Find a town or city and its place id, for the times of a day or month there."
            ),
            args_schema=FindPlaceArgs,
            handle_tool_error=True,
        ),
        StructuredTool.from_function(
            coroutine=good_times_for_day,
            name="good_times_for_day",
            description=(
                "The day's almanac for a place: sunrise, sunset, Rahu kalaya, and the thithi, "
                "nakatha, yoga and karana with the times each starts and ends. Use for "
                "'is today good?', 'when is Rahu kalaya?' or a date the person names."
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
                "The Sinhala and Tamil New Year (Avurudu) nakath for a year: each custom with "
                "its time, colour and direction, and whether the list is the official one."
            ),
            args_schema=YearArgs,
            handle_tool_error=True,
        ),
    ]
