"""Diagrams in the chat (docs/24): the model names one, and the website draws it.

`show_visual` carries a diagram's name and nothing else. The chart or match itself never comes
here: the browser draws it from the result it already holds, the same one the page shows.

The page says in its context (`visuals`) which diagrams it can draw, and an id for the result
on screen. The tool answers with that id, so the diagram with an answer is always the result
the question was about, even when the person has since opened another one.

This is an agent tool and not a CopilotKit frontend tool on purpose. A frontend tool ends the
run and starts a second one for the answer, and the website counts every run as a question
(docs/21). One question stays one run.
"""

import json
from collections.abc import Mapping
from typing import Annotated, Any, Literal

from langchain.tools import ToolRuntime
from langchain_core.tools import BaseTool, StructuredTool, ToolException
from pydantic import BaseModel, ConfigDict, Field

Visual = Literal["pillars", "wheel", "houses", "periods", "mars", "people", "ring", "checks"]

SHOW_VISUAL = "show_visual"


def offered(state: Mapping[str, Any]) -> tuple[str | None, frozenset[str]]:
    """The id of the result on the person's page, and the diagrams that page can draw."""
    for item in (state.get("copilotkit") or {}).get("context") or []:
        value = item.get("value") if isinstance(item, Mapping) else getattr(item, "value", None)
        try:
            page = json.loads(value) if isinstance(value, str) else value
        except ValueError:
            continue
        visuals = page.get("visuals") if isinstance(page, Mapping) else None
        if isinstance(visuals, Mapping) and isinstance(visuals.get("offers"), list):
            return str(visuals.get("id")), frozenset(map(str, visuals["offers"]))
    return None, frozenset()


class ShowVisualArgs(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    visual: Annotated[Visual, Field(description="One of the page's `visuals.offers`.")]
    houses: Annotated[
        list[Annotated[int, Field(ge=1, le=12)]],
        Field(max_length=4, description="Only for `houses`: the houses the answer is about."),
    ] = []
    # Filled in by LangGraph, never by the model.
    runtime: ToolRuntime


async def show_visual(
    visual: Visual, runtime: ToolRuntime, houses: list[int] | None = None
) -> dict[str, Any]:
    page, offers = offered(runtime.state)
    if page is None or visual not in offers:
        raise ToolException(
            "The page can't draw that. Answer in words, and don't mention a diagram."
        )
    result: dict[str, Any] = {"shown": visual, "page": page}
    if visual == "houses" and houses:
        result["houses"] = sorted(set(houses))
    return result


def tools() -> list[BaseTool]:
    return [
        StructuredTool.from_function(
            coroutine=show_visual,
            name=SHOW_VISUAL,
            description=(
                "Draws one diagram of the chart or match on the person's page, with your "
                "answer. `pillars`: the chart at a glance. `houses`: the 12 parts of life, with "
                "the ones you talk about lit. `periods`: the life periods bar. `wheel`: the "
                "planets in the sky at birth. `mars`: the Mars check. `people`: the couple's "
                "stars. `ring`: the factors that agree. `checks`: Rajju, Vedha and the Mars "
                "check. Call it in the same step as reading a skill."
            ),
            args_schema=ShowVisualArgs,
            handle_tool_error=True,
        )
    ]
