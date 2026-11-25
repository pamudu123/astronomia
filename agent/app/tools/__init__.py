"""Engine tools, one module per topic. Add a topic: write `tools(engine)` in a new module and
list it here."""

from langchain_core.tools import BaseTool

from app.tools import calendar, naming, planets, porondam, visuals
from app.tools.engine import EngineClient

__all__ = ["EngineClient", "assistant_tools", "engine_tools"]


def engine_tools(engine: EngineClient) -> list[BaseTool]:
    """Every engine tool the assistant can use."""
    return [
        *porondam.tools(engine),
        *calendar.tools(engine),
        *naming.tools(engine),
        *planets.tools(engine),
    ]


def assistant_tools(engine: EngineClient) -> list[BaseTool]:
    """Everything the guide can call: the engine's lookups, and the page's diagrams."""
    return [*engine_tools(engine), *visuals.tools()]
