import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage, ToolMessage
from langchain_core.outputs import ChatGenerationChunk
from pydantic import SecretStr

from app.config import Settings
from app.main import create_app
from tests.conftest import RecordingModel


def test_health_is_open(settings: Settings) -> None:
    client = TestClient(create_app(settings))
    assert client.get("/healthz").json()["status"] == "ok"


def test_agent_needs_the_access_key_when_one_is_set(settings: Settings) -> None:
    locked = settings.model_copy(update={"access_key": SecretStr("k")})
    client = TestClient(create_app(locked))

    assert client.get("/healthz").status_code == 200
    assert client.post("/agent", json={}).status_code == 401
    wrong = {b"X-Access-Key": "ké".encode("latin-1")}  # non-ASCII must not crash the check
    assert client.post("/agent", json={}, headers=wrong).status_code == 401
    # With the key, the request reaches the agent route (and fails validation on the empty body).
    assert client.post("/agent", json={}, headers={"X-Access-Key": "k"}).status_code == 422


def test_suggest_route_is_locked_the_same_way(settings: Settings) -> None:
    locked = settings.model_copy(update={"access_key": SecretStr("k")})
    client = TestClient(create_app(locked))

    assert client.post("/agent/suggest", json={}).status_code == 401
    assert client.post("/agent/suggest", json={}, headers={"X-Access-Key": "k"}).status_code == 422


def test_an_answer_with_many_lookups_finishes(settings: Settings) -> None:
    # Each lookup is a round of several graph steps. LangGraph's default of 25 steps ended a run
    # after five model calls, with an error after the answer (or no answer at all).
    lookup = [
        AIMessage(
            content="",
            tool_calls=[{"id": f"t{n}", "name": "current_date", "args": {}}],
        )
        for n in range(8)
    ]
    model = RecordingModel(responses=[*lookup, AIMessage(content="All looked up.")])
    client = TestClient(create_app(settings, model=model, explain_model=model))

    response = client.post(
        "/agent",
        json={
            "threadId": "many",
            "runId": "r1",
            "messages": [{"id": "m1", "role": "user", "content": "Compare these days."}],
            "state": {},
            "tools": [],
            "context": [],
            "forwardedProps": {},
        },
    )

    assert "RUN_ERROR" not in response.text
    assert "All looked up." in response.text
    assert "RUN_FINISHED" in response.text


class Helping(RecordingModel):
    """A guide that starts three helpers at once; each helper streams its own words."""

    async def _astream(
        self, messages: list[BaseMessage], *args: Any, **kwargs: Any
    ) -> AsyncIterator[ChatGenerationChunk]:
        if "date checker" in str(messages[0].content):
            words = [f"helper-{n} " for n in range(4)]
        elif any(isinstance(m, ToolMessage) for m in messages):
            words = ["The guide's ", "own answer."]
        else:
            calls: Any = [
                {
                    "id": f"t{n}",
                    "name": "task",
                    "args": json.dumps({"description": "a day", "subagent_type": "date-checker"}),
                    "index": n,
                }
                for n in range(3)
            ]
            yield ChatGenerationChunk(message=AIMessageChunk(content="", tool_call_chunks=calls))
            return
        for word in words:
            await asyncio.sleep(0)
            yield ChatGenerationChunk(message=AIMessageChunk(content=word))


def test_a_helpers_own_words_stay_out_of_the_chat(settings: Settings) -> None:
    # Helpers run at the same time: streamed into the chat, their words came out mixed together.
    model = Helping(responses=[AIMessage(content="unused")])
    client = TestClient(create_app(settings, model=model, explain_model=model))

    response = client.post(
        "/agent",
        json={
            "threadId": "helpers",
            "runId": "r1",
            "messages": [{"id": "m1", "role": "user", "content": "Compare three days."}],
            "state": {},
            "tools": [],
            "context": [],
            "forwardedProps": {},
        },
    )

    events = [json.loads(x[5:]) for x in response.text.splitlines() if x.startswith("data:")]
    written = "".join(e["delta"] for e in events if e["type"] == "TEXT_MESSAGE_CONTENT")
    assert written == "The guide's own answer."
    # The chat still knows helpers are at work (the status line), and the guide got their reports.
    started = [e["toolCallName"] for e in events if e["type"] == "TOOL_CALL_START"]
    assert started == ["task"] * 3
    results = [e["content"] for e in events if e["type"] == "TOOL_CALL_RESULT"]
    assert len(results) == 3 and all("helper-0" in r for r in results)
    assert events[-1]["type"] == "RUN_FINISHED"
