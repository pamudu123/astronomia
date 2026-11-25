from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
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
