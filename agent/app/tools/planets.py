"""Planet change tools: when Saturn, Jupiter, Rahu and Ketu change signs, and what that means
for each rising sign. General readings for a sign, never for a person."""

from typing import Annotated, Any, get_args

from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field

from app.tools.engine import EngineClient, Lang, Sign

LangField = Annotated[Lang, Field(description="Language of the names: 'en' or 'si'.")]
SignField = Annotated[Sign, Field(description="The rising sign (lagna) to read the change for.")]


SIGNS: tuple[str, ...] = get_args(Sign)


class ListArgs(BaseModel):
    lang: LangField = "en"
    moon_sign: Annotated[
        Sign | None,
        Field(description="The person's Moon sign, for a question about erashtaka or Saturn."),
    ] = None
    rising_sign: Annotated[
        Sign | None,
        Field(description="The person's rising sign, for the same question, when it is known."),
    ] = None


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


def saturn_from(saturn: str, base: str, *, moon: bool) -> dict[str, Any]:
    """Saturn counted from a sign, its own sign being 1: the 12th, 1st and 2nd are the three parts
    of erashtaka, and the 8th from the Moon sign is ashtama shani (backend/app/engine/couple.py).
    Worked out here because the model gets the count wrong."""
    place = (SIGNS.index(saturn) - SIGNS.index(base)) % 12 + 1
    part = {12: "first", 1: "middle", 2: "last"}.get(place)
    return {
        "counted_from": base,
        "erashtaka_running": part is not None,
        **({"part": part} if part else {}),
        **({"ashtama_shani_running": place == 8} if moon else {}),
    }


def saturn_now(
    changes: list[dict[str, Any]], moon_sign: str | None, rising_sign: str | None
) -> dict[str, Any] | None:
    """The sign Saturn is in now (the one its next change leaves), counted from the person's."""
    moves = (m for c in changes for m in c["moves"] if m["body"] == "saturn")
    sign = next((m["from_sign"] for m in moves), None)
    if sign is None:
        return None
    out: dict[str, Any] = {"saturn_is_in": sign}
    if moon_sign:
        out["by_moon_sign"] = saturn_from(sign, moon_sign, moon=True)
    if rising_sign:
        out["by_rising_sign"] = saturn_from(sign, rising_sign, moon=False)
    return out


def tools(engine: EngineClient) -> list[BaseTool]:
    async def upcoming_planet_changes(
        lang: Lang = "en", moon_sign: Sign | None = None, rising_sign: Sign | None = None
    ) -> dict[str, Any]:
        body = await engine.get("/v1/changes", {"lang": lang})
        asked = moon_sign or rising_sign
        now = saturn_now(body["changes"], moon_sign, rising_sign) if asked else None
        return {
            **({"saturn_now": now} if now else {}),
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
                "change ids. Given a person's Moon sign and rising sign, also whether erashtaka or "
                "ashtama shani is running for them now, in `saturn_now`."
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
