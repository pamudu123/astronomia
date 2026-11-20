"""Naming tools: the first letters for a birth star, and names that start with them."""

from typing import Annotated, Any, Literal

from langchain_core.tools import BaseTool, StructuredTool, ToolException
from pydantic import BaseModel, Field

from app.tools.engine import STARS, EngineClient, Lang

Gender = Literal["boy", "girl", "any"]
LangField = Annotated[Lang, Field(description="Language of the names: 'en' or 'si'.")]


class StarLettersArgs(BaseModel):
    star: Annotated[str, Field(description="Birth star id, for example 'rohini'.")]
    lang: LangField = "en"


class NamesArgs(BaseModel):
    letters: Annotated[
        list[str],
        Field(
            min_length=1,
            max_length=4,
            description="Sinhala first letters from name_letters_for_star, for example ['ව'].",
        ),
    ]
    gender: Gender = "any"
    lang: LangField = "en"


def tools(engine: EngineClient) -> list[BaseTool]:
    async def name_letters_for_star(star: str, lang: Lang = "en") -> dict[str, Any]:
        if star not in STARS:
            raise ToolException(f"Unknown birth star '{star}'. Use one of: {', '.join(STARS)}.")
        body = await engine.get(f"/v1/baby/letters/{star}", {"lang": lang})
        return {
            "star": body["star_name"],
            "quarters": [
                {
                    "pada": p["pada"],
                    "letter": p["letter"],
                    "sounds_like": p["latin"],
                    "also_used": p["others"],
                    "sign": p["rashi_name"],
                }
                for p in body["padas"]
            ],
            "provisional": body["provisional"],
        }

    async def names_for_letters(
        letters: list[str], gender: Gender = "any", lang: Lang = "en"
    ) -> dict[str, Any]:
        params = [("letters", letter) for letter in letters]
        params += [("gender", gender), ("lang", lang)]
        body = await engine.get("/v1/baby/names", params)
        return {
            "count_by_letter": {c["letter"]: c["count"] for c in body["letters"]},
            "names": [
                {
                    "name": n["en"],
                    "sinhala": n["si"],
                    "gender": n["gender"],
                    # None when the list has no sourced meaning for the name.
                    "meaning": n["meaning"] or None,
                }
                for n in body["names"][:20]
            ],
            "more_on_the_page": max(0, len(body["names"]) - 20),
            "provisional": body["provisional"],
        }

    return [
        StructuredTool.from_function(
            coroutine=name_letters_for_star,
            name="name_letters_for_star",
            description=(
                "The traditional first letter of a baby's name for each quarter (pada) of a "
                "birth star. Needs only the star, no birth details."
            ),
            args_schema=StarLettersArgs,
            handle_tool_error=True,
        ),
        StructuredTool.from_function(
            coroutine=names_for_letters,
            name="names_for_letters",
            description=(
                "Sinhala names from the site's list that start with the given first letters, "
                "with their meanings. A meaning of null means no source gives one: say so and "
                "never guess a meaning. Use after name_letters_for_star."
            ),
            args_schema=NamesArgs,
            handle_tool_error=True,
        ),
    ]
