"""The agent service: the assistant served over AG-UI, for the website's CopilotKit chat.

POST /agent          AG-UI run (server-sent events): the guide, who answers
POST /agent/suggest  AG-UI run: the follow-up questions shown under each answer
POST /agent/explain  plain text stream: one chapter of a full reading, or an explain button
GET  /healthz        health check, always open

Run with `uvicorn app.main:create_app --factory`. The app is built when the server starts,
not on import, so importing this module (tests, CI) needs no OpenAI key.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langchain_core.language_models import BaseChatModel

from app import __version__
from app.config import Settings, get_settings
from app.explain import ExplainRequest, stream_chapter
from app.graph import build_agent, build_model
from app.security import AccessKeyMiddleware
from app.suggest import build_suggester
from app.tools import EngineClient, engine_tools

AGENT_NAME = "guide"
SUGGEST_NAME = "suggest"


def create_app(
    settings: Settings | None = None, *, explain_model: BaseChatModel | None = None
) -> FastAPI:
    """`explain_model` can be swapped in tests."""
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
    add_langgraph_fastapi_endpoint(
        app,
        LangGraphAGUIAgent(
            name=SUGGEST_NAME,
            description="Writes the follow-up questions shown under each answer.",
            graph=build_suggester(settings),
            emit_raw_events=False,
        ),
        "/agent/suggest",
    )

    writer = explain_model or build_model(settings)

    @app.post("/agent/explain", tags=["explain"])
    async def explain(request: ExplainRequest) -> StreamingResponse:
        # Plain text, so the website can show the chapter as it is written. No caching
        # headers: the website keeps each chapter for the visit itself (docs/17, section 5).
        return StreamingResponse(
            stream_chapter(writer, request),
            media_type="text/plain; charset=utf-8",
            headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
        )

    return app
