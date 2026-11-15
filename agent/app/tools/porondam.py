"""Matching tools: which birth stars suit a birth star."""

from typing import Annotated, Any, Literal

from langchain_core.tools import BaseTool, StructuredTool, ToolException
from pydantic import BaseModel, Field

from app.tools.engine import STARS, EngineClient, Lang

Role = Literal["bride", "groom"]


class MatchingStarsArgs(BaseModel):
    star: Annotated[
        str, Field(description="Birth star id as the engine names it, for example 'rohini'.")
    ]
    pada: Annotated[int, Field(ge=1, le=4, description="Quarter of the star, 1 to 4.")] = 1
    role: Annotated[Role, Field(description="Whether this star is the bride's or groom's.")] = (
        "bride"
    )
    lang: Annotated[Lang, Field(description="Language of the names: 'en' or 'si'.")] = "en"
    limit: Annotated[int, Field(ge=1, le=27, description="How many top matches to return.")] = 8


def tools(engine: EngineClient) -> list[BaseTool]:
    async def find_matching_stars(
        star: str, pada: int = 1, role: Role = "bride", lang: Lang = "en", limit: int = 8
    ) -> dict[str, Any]:
        if star not in STARS:
            raise ToolException(f"Unknown birth star '{star}'. Use one of: {', '.join(STARS)}.")
        body = await engine.get(
            f"/v1/porondam/stars/{star}", {"pada": pada, "role": role, "lang": lang}
        )
        return {
            "star": body["name"],
            "pada": body["pada"],
            "sign": body["rashi_name"],
            "role": body["role"],
            "provisional": body["provisional"],
            "best_matches": [
                {
                    "star_id": m["nakshatra"],
                    "star": m["name"],
                    "sign": m["rashi_name"],
                    "padas": m["padas"],
                    # Named as the site names them: "factors agree", "essential checks".
                    "factors_agree": f"{m['score']['passed']} of {m['score']['total']}",
                    "essential_checks_pass": m["essential_pass"],
                    "essential_checks": {c["name"]: c["passed"] for c in m["hard_checks"]},
                    "same_star": m["same_star"],
                }
                for m in body["matches"][:limit]
            ],
        }

    return [
        StructuredTool.from_function(
            coroutine=find_matching_stars,
            name="find_matching_stars",
            description=(
                "Rank all 27 birth stars as partners for one birth star, best first, using the "
                "site's match rules. Needs only the star and its quarter (pada), no birth "
                "details. Use for questions like 'which stars suit mine?'."
            ),
            args_schema=MatchingStarsArgs,
            handle_tool_error=True,
        )
    ]
