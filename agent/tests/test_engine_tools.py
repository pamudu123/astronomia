import json
from typing import Any

import httpx
import pytest

from app.tools.engine import EngineClient, engine_tools

STARS_RESPONSE: dict[str, Any] = {
    "nakshatra": "rohini",
    "name": "Rohini",
    "pada": 2,
    "rashi": "vrishabha",
    "rashi_name": "Vrishabha",
    "role": "bride",
    "rule_set": "porondam_si_v3",
    "provisional": True,
    "matches": [
        {
            "nakshatra": star,
            "name": star.title(),
            "rashi": "mithuna",
            "rashi_name": "Mithuna",
            "padas": [1, 2, 3, 4],
            "score": {"passed": 12 - i, "total": 15},
            "essential_pass": i != 1,
            "hard_checks": [
                {"id": "rajju", "name": "Rajju", "passed": True},
                {"id": "vedha", "name": "Vedha", "passed": i != 1},
            ],
            "summary": "majority_pass",
            "same_star": False,
        }
        for i, star in enumerate(["ardra", "punarvasu", "pushya"])
    ],
}


def engine_with(handler: Any, key: str = "") -> EngineClient:
    engine = EngineClient("http://engine.test", key)
    engine.http = httpx.AsyncClient(
        base_url="http://engine.test",
        headers=engine.http.headers,
        transport=httpx.MockTransport(handler),
    )
    return engine


def tool(engine: EngineClient) -> Any:
    (found,) = [t for t in engine_tools(engine) if t.name == "find_matching_stars"]
    return found


async def test_matching_stars_returns_a_short_plain_summary() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=STARS_RESPONSE)

    result = await tool(engine_with(handler, key="secret")).ainvoke(
        {"star": "rohini", "pada": 2, "lang": "en", "limit": 2}
    )

    request = seen[0]
    assert request.url.path == "/v1/porondam/stars/rohini"
    assert dict(request.url.params) == {"pada": "2", "role": "bride", "lang": "en"}
    assert request.headers["X-Access-Key"] == "secret"
    assert result["star"] == "Rohini"
    assert result["provisional"] is True
    assert [m["star"] for m in result["best_matches"]] == ["Ardra", "Punarvasu"]
    second = result["best_matches"][1]
    assert second["factors_agree"] == "11 of 15"
    assert second["essential_checks_pass"] is False
    assert second["essential_checks"] == {"Rajju": True, "Vedha": False}


async def test_unknown_star_is_explained_to_the_model_not_raised() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("the engine should not be called")

    result = await tool(engine_with(handler)).ainvoke({"star": "sirius"})
    assert "Unknown birth star 'sirius'" in result


@pytest.mark.parametrize(
    ("status", "message"),
    [(500, "failed (500)"), (422, "rejected the request")],
)
async def test_engine_errors_become_a_message(status: int, message: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, text=json.dumps({"detail": "x"}))

    result = await tool(engine_with(handler)).ainvoke({"star": "rohini"})
    assert message in result


async def test_unreachable_engine_becomes_a_message() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    result = await tool(engine_with(handler)).ainvoke({"star": "rohini"})
    assert "could not be reached" in result
