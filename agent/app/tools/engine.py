"""Tools that ask the calculation engine (the existing backend API).

The rule: the AI talks, the engine calculates. Every fact about stars, signs and matches
comes from here, never from the model's own memory.

Each tool returns a small, plain dict. The model sees exactly what the person could see on
the site, through the same API, so free and paid trimming still applies.
"""

from typing import Annotated, Any, Literal

import httpx
from langchain_core.tools import BaseTool, StructuredTool, ToolException
from pydantic import BaseModel, Field

Lang = Literal["en", "si"]
Role = Literal["bride", "groom"]

# The 27 birth stars, as the engine names them (backend/app/engine/zodiac.py, NAKSHATRA).
# fmt: off
STARS = (
    "ashwini", "bharani", "krittika", "rohini", "mrigashira", "ardra", "punarvasu", "pushya",
    "ashlesha", "magha", "purva_phalguni", "uttara_phalguni", "hasta", "chitra", "swati",
    "vishakha", "anuradha", "jyeshtha", "mula", "purva_ashadha", "uttara_ashadha", "shravana",
    "dhanishta", "shatabhisha", "purva_bhadrapada", "uttara_bhadrapada", "revati",
)
# fmt: on


class EngineClient:
    """A thin client for the backend API, shared by all tools."""

    def __init__(self, base_url: str, access_key: str = "", timeout: float = 20.0) -> None:
        headers = {"X-Access-Key": access_key} if access_key else {}
        self.http = httpx.AsyncClient(base_url=base_url, headers=headers, timeout=timeout)

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        try:
            response = await self.http.get(path, params=params)
        except httpx.HTTPError as error:
            raise ToolException("The calculation service could not be reached.") from error
        if response.status_code == 422:
            raise ToolException(f"The calculation service rejected the request: {response.text}")
        if response.is_error:
            raise ToolException(f"The calculation service failed ({response.status_code}).")
        return response.json()

    async def aclose(self) -> None:
        await self.http.aclose()


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


def engine_tools(engine: EngineClient) -> list[BaseTool]:
    """The engine tools the assistant can use."""

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
