"""The client for the calculation engine (the existing backend API), shared by every tool.

The rule: the AI talks, the engine calculates. Every fact about stars, signs, times and
matches comes from here, never from the model's own memory.

Tools only use the engine's public endpoints, the ones that need no birth details. Each tool
returns a small, plain dict: the model reads every token of it.
"""

from typing import Any, Literal

import httpx
from langchain_core.tools import ToolException

Lang = Literal["en", "si"]

# The 27 birth stars, as the engine names them (backend/app/engine/zodiac.py, NAKSHATRA).
# fmt: off
STARS = (
    "ashwini", "bharani", "krittika", "rohini", "mrigashira", "ardra", "punarvasu", "pushya",
    "ashlesha", "magha", "purva_phalguni", "uttara_phalguni", "hasta", "chitra", "swati",
    "vishakha", "anuradha", "jyeshtha", "mula", "purva_ashadha", "uttara_ashadha", "shravana",
    "dhanishta", "shatabhisha", "purva_bhadrapada", "uttara_bhadrapada", "revati",
)
# fmt: on

# The 12 signs, as the engine names them.
Sign = Literal[
    "mesha", "vrishabha", "mithuna", "kataka", "simha", "kanya",
    "tula", "vrischika", "dhanu", "makara", "kumbha", "meena",
]  # fmt: skip

# Colombo in the engine's place list: the default place for times of day.
COLOMBO = 1248991


class EngineClient:
    """A thin client for the backend API, shared by all tools."""

    def __init__(self, base_url: str, access_key: str = "", timeout: float = 20.0) -> None:
        headers = {"X-Access-Key": access_key} if access_key else {}
        self.http = httpx.AsyncClient(base_url=base_url, headers=headers, timeout=timeout)

    async def get(self, path: str, params: Any = None) -> Any:
        try:
            response = await self.http.get(path, params=params)
        except httpx.HTTPError as error:
            raise ToolException("The calculation service could not be reached.") from error
        if response.status_code in (404, 422):
            raise ToolException(f"The calculation service rejected the request: {response.text}")
        if response.is_error:
            raise ToolException(f"The calculation service failed ({response.status_code}).")
        return response.json()

    async def aclose(self) -> None:
        await self.http.aclose()


def clock(moment: dict[str, Any] | None, day: str | None = None) -> str | None:
    """A local time as "06:00", or "02:02 on 2026-11-16" when it falls on another day."""
    if not moment:
        return None
    if day is None or moment.get("date") == day:
        return str(moment["clock"])
    return f"{moment['clock']} on {moment['date']}"


def span(part: dict[str, Any] | None, day: str | None = None) -> str | None:
    """A time range as "16:16 to 17:44"."""
    if not part:
        return None
    return f"{clock(part.get('start'), day)} to {clock(part.get('end'), day)}"
