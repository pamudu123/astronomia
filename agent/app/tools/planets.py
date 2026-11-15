"""Planet change tools: when Saturn, Jupiter, Rahu and Ketu change signs, and what that means
for each rising sign. General readings for a sign, never for a person."""

from typing import Annotated, Any

from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field

from app.tools.engine import EngineClient, Lang, Sign

LangField = Annotated[Lang, Field(description="Language of the names: 'en' or 'si'.")]
SignField = Annotated[Sign, Field(description="The rising sign (lagna) to read the change for.")]


class ListArgs(BaseModel):
    lang: LangField = "en"


class ChangeArgs(BaseModel):
    change_id: Annotated[
        str, Field(description="Change id from upcoming_planet_changes, e.g. 'saturn-2027-06'.")
    ]
    sign: SignField
    lang: LangField = "en"


class YearArgs(BaseModel):
    year: Annotated[int, Field(ge=1950, le=2100)]
    sign: SignField
    lang: LangField = "en"


def summary(change: dict[str, Any]) -> dict[str, Any]:
    return {
        "change_id": change["id"],
        "title": change["title"],
        "when": change["when"],
        "moves": [m["text"] for m in change["moves"]],
    }


def tools(engine: EngineClient) -> list[BaseTool]:
    async def upcoming_planet_changes(lang: Lang = "en") -> dict[str, Any]:
        body = await engine.get("/v1/changes", {"lang": lang})
        return {
            "changes": [summary(c) for c in body["changes"]],
            "provisional": body["provisional"],
        }

    async def planet_change_for_sign(
        change_id: str, sign: Sign, lang: Lang = "en"
    ) -> dict[str, Any]:
        body = await engine.get(f"/v1/changes/{change_id}/{sign}", {"lang": lang})
        lagna = body["lagna"]
        return {
            **summary(body["change"]),
            "rising_sign": lagna["sign_name"],
            "for_this_sign": [
                {"move": m["text"], "leaves": m["from_theme"], "enters": m["to_theme"]}
                for m in lagna["moves"]
            ],
            "other_planets": [o["text"] for o in lagna["others"]],
            "notes": lagna["notes"],
            "moon_sign_notes": body["moon_notes"],
            "provisional": body["provisional"],
        }

    async def year_ahead_for_sign(year: int, sign: Sign, lang: Lang = "en") -> dict[str, Any]:
        body = await engine.get(f"/v1/yearly/{year}/{sign}", {"lang": lang})
        return {
            "year": year,
            "rising_sign": body["sign_name"],
            "planets": {
                p["body"]: [{"when": s["text"], "theme": s["theme"]} for s in p["stays"]]
                for p in body["planets"]
            },
            "key_dates": [
                {
                    "change_id": k["change"]["id"],
                    "title": k["change"]["title"],
                    "when": k["change"]["when"],
                }
                for k in body["key_dates"]
            ],
            "provisional": body["provisional"],
        }

    return [
        StructuredTool.from_function(
            coroutine=upcoming_planet_changes,
            name="upcoming_planet_changes",
            description=(
                "The coming sign changes of Saturn, Jupiter, Rahu and Ketu, with dates and "
                "change ids."
            ),
            args_schema=ListArgs,
            handle_tool_error=True,
        ),
        StructuredTool.from_function(
            coroutine=planet_change_for_sign,
            name="planet_change_for_sign",
            description=(
                "What one planet change means for a rising sign: the houses it leaves and "
                "enters, where the other slow planets are, and notes for the Moon sign."
            ),
            args_schema=ChangeArgs,
            handle_tool_error=True,
        ),
        StructuredTool.from_function(
            coroutine=year_ahead_for_sign,
            name="year_ahead_for_sign",
            description=(
                "A year ahead for a rising sign: where Saturn, Jupiter, Rahu and Ketu are, "
                "month by month in plain words, and the key change dates."
            ),
            args_schema=YearArgs,
            handle_tool_error=True,
        ),
    ]
