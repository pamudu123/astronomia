"""Starts the real agent service (agent/app) for an evaluation run. Nothing is rewritten.

Everything is the project's own code: create_app, its prompts, skills, tools and settings. Added
around it, from the outside only:

- the clock is set with the project's own `clock.set_clock`, so "today" is the same in every run
- a meter (the project's `usage.Meter`) that notes each model call, tool call and token count for
  one request, read back at GET /eval/usage/<id>

The model is chosen as in production, by ASTRONOMIA_AGENT_MODEL and
ASTRONOMIA_AGENT_REASONING_EFFORT.
"""

import json
import os
import sys
import time
from typing import Any
from uuid import UUID

from evalkit.common import AGENT, AGENT_PORT, FROZEN_NOW

sys.path.insert(0, str(AGENT))
os.chdir(AGENT)

import uvicorn  # noqa: E402
from app import clock, usage  # noqa: E402
from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from langchain_core.messages import AIMessage  # noqa: E402
from langchain_core.outputs import ChatGeneration, LLMResult  # noqa: E402

HEADER = b"x-eval-id"
OPENROUTER_URL = "https://openrouter.ai/api/v1"


def openrouter_model(settings: Settings, key: str) -> Any:
    """A model from OpenRouter, given to create_app in place of the one build_model makes.

    The project's own build_model uses OpenAI's Responses API, which is not how OpenRouter serves
    other providers, so this one uses chat completions. The prompts, skills, tools and graph are
    the project's. Nothing is kept: OpenRouter is asked for providers that don't store prompts.
    """
    from langchain_openai import ChatOpenAI

    extra: dict[str, Any] = {"provider": {"data_collection": "deny"}, "usage": {"include": True}}
    effort = os.environ.get("EVAL_OPENROUTER_EFFORT", "none")
    extra["reasoning"] = {"enabled": False} if effort == "none" else {"effort": effort}
    if settings.model.startswith("openai:anthropic/"):
        # Anthropic caches only what it is asked to. OpenAI caches long prompts by itself.
        extra["cache_control"] = {"type": "ephemeral"}
    return ChatOpenAI(
        model=settings.model.removeprefix("openai:"), base_url=OPENROUTER_URL, api_key=key,
        use_responses_api=False, stream_usage=True, extra_body=extra, timeout=120,
    )


class EvalMeter(usage.Meter):
    """The project's meter, which also remembers each model and tool call."""

    def __init__(self) -> None:
        super().__init__()
        self.calls: list[dict[str, Any]] = []
        self.tools: list[dict[str, Any]] = []
        self._started: dict[UUID, float] = {}

    def on_chat_model_start(self, serialized: Any, messages: Any, *, run_id: UUID, **kwargs: Any) -> None:
        self._started[run_id] = time.perf_counter()

    def on_llm_end(self, response: LLMResult, *, run_id: UUID, **kwargs: Any) -> None:
        super().on_llm_end(response, run_id=run_id, **kwargs)
        for generations in response.generations:
            for g in generations:
                if isinstance(g, ChatGeneration) and isinstance(g.message, AIMessage):
                    u: Any = g.message.usage_metadata or {}
                    self.calls.append({
                        "seconds": round(time.perf_counter() - self._started.get(run_id, time.perf_counter()), 2),
                        "model": g.message.response_metadata.get("model_name") or g.message.response_metadata.get("model"),
                        "input": u.get("input_tokens", 0),
                        "cached": (u.get("input_token_details") or {}).get("cache_read", 0),
                        "output": u.get("output_tokens", 0),
                        "reasoning": (u.get("output_token_details") or {}).get("reasoning", 0),
                    })

    def on_tool_start(self, serialized: Any, input_str: str, *, run_id: UUID, inputs: Any = None, **kwargs: Any) -> None:
        self._started[run_id] = time.perf_counter()
        self.tools.append({"run": str(run_id), "name": (serialized or {}).get("name"), "input": str(inputs or input_str)[:300]})

    def on_tool_end(self, output: Any, *, run_id: UUID, **kwargs: Any) -> None:
        for t in self.tools:
            if t["run"] == str(run_id):
                t["seconds"] = round(time.perf_counter() - self._started.get(run_id, time.perf_counter()), 2)
                t["status"] = str(getattr(output, "status", "success"))

    def on_tool_error(self, error: BaseException, *, run_id: UUID, **kwargs: Any) -> None:
        for t in self.tools:
            if t["run"] == str(run_id):
                t["status"] = f"error: {str(error)[:200]}"


class Measure:
    """ASGI wrapper: meters requests that carry an eval id."""

    def __init__(self, app: Any) -> None:
        self.app = app
        self.seen: dict[str, dict[str, Any]] = {}

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        if scope["type"] == "http" and scope["path"].startswith("/eval/usage/"):
            found = self.seen.pop(scope["path"].rsplit("/", 1)[1], None)
            body = json.dumps(found).encode()
            await send({"type": "http.response.start", "status": 200, "headers": [(b"content-type", b"application/json")]})
            await send({"type": "http.response.body", "body": body})
            return
        eval_id = dict(scope.get("headers") or []).get(HEADER, b"").decode()
        if not eval_id:
            await self.app(scope, receive, send)
            return
        meter = EvalMeter()
        token = usage._current.set(meter)
        try:
            await self.app(scope, receive, send)
        finally:
            usage._current.reset(token)
            self.seen[eval_id] = {
                "calls": meter.calls,
                "tools": [{k: v for k, v in t.items() if k != "run"} for t in meter.tools],
                "input": meter.tokens.input, "cached": meter.tokens.cached, "output": meter.tokens.output,
            }


if __name__ == "__main__":
    clock.set_clock(lambda: FROZEN_NOW)
    if key := os.environ.pop("EVAL_OPENROUTER_KEY", ""):
        settings = Settings()
        chat_model = openrouter_model(settings, key)
        service = create_app(settings, model=chat_model, explain_model=chat_model)
    else:
        service = create_app()
    uvicorn.run(Measure(service), port=AGENT_PORT, log_level="warning")
