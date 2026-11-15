"""The agent service: the assistant served over AG-UI, for the website's CopilotKit chat.

POST /agent   AG-UI run (server-sent events)
GET  /healthz health check, always open

Run with `uvicorn app.main:create_app --factory`. The app is built when the server starts,
not on import, so importing this module (tests, CI) needs no OpenAI key.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from fastapi import FastAPI

from app import __version__
from app.config import Settings, get_settings
from app.graph import build_agent
from app.security import AccessKeyMiddleware
from app.tools.engine import EngineClient, engine_tools

AGENT_NAME = "guide"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    engine = EngineClient(settings.backend_url, settings.backend_access_key.get_secret_value())
    graph = build_agent(settings, engine_tools(engine))

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.aclose()

    app = FastAPI(
        title="Astronomia Agent",
        version=__version__,
        description="The AI assistant, served over AG-UI.",
        lifespan=lifespan,
    )
    if key := settings.access_key.get_secret_value():
        app.add_middleware(AccessKeyMiddleware, key=key)

    @app.get("/healthz", tags=["meta"])
    def healthz() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    add_langgraph_fastapi_endpoint(
        app,
        LangGraphAGUIAgent(
            name=AGENT_NAME,
            description="Explains results on the page in plain words.",
            graph=graph,
            # The raw LangGraph events are only for debugging and make every event large.
            emit_raw_events=False,
        ),
        "/agent",
    )
    return app
