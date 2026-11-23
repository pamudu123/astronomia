"""Chat limits on the AI service's side (docs/21): no run without the backend's yes, real cost."""

import json
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, LLMResult
from pydantic import SecretStr

from app.config import Settings
from app.main import create_app
from app.usage import Granted, Ledger, Meter, Purpose, Tokens, cost_micros, longest_message
from tests.conftest import RecordingModel

TURN = "6f1d2b9e-8a40-4c55-9d3b-0a1b2c3d4e5f"


class FakeLedger(Ledger):
    """Stands in for the backend's chat endpoints."""

    def __init__(self, settings: Settings, allow: bool = True, max_length: int = 1000) -> None:
        super().__init__(settings, http=httpx.AsyncClient())
        self.allow = allow
        self.max_length = max_length
        self.started: list[tuple[str, Purpose]] = []
        self.reported: list[tuple[str, Tokens]] = []

    async def start(self, turn: str, purpose: Purpose) -> Granted | None:
        self.started.append((turn, purpose))
        return Granted("free", self.max_length) if self.allow else None

    async def report(self, turn: str, tokens: Tokens) -> None:
        self.reported.append((turn, tokens))


def answer_with_usage(text: str = "Hello.") -> AIMessage:
    return AIMessage(
        content=text,
        usage_metadata={
            "input_tokens": 1200,
            "output_tokens": 80,
            "total_tokens": 1280,
            "input_token_details": {"cache_read": 1000},
        },
    )


def run_body(message: str = "What is my nakatha?") -> dict[str, Any]:
    return {
        "threadId": "thread-1",
        "runId": "run-1",
        "messages": [{"id": "m1", "role": "user", "content": message}],
        "state": {},
        "tools": [],
        "context": [],
        "forwardedProps": {},
    }


@pytest.fixture
def limited(settings: Settings) -> Settings:
    return settings.model_copy(update={"chat_key": SecretStr("chat-key")})


def app_with(settings: Settings, ledger: FakeLedger, model: RecordingModel) -> TestClient:
    return TestClient(create_app(settings, model=model, ledger=ledger))


# Measuring


def test_the_meter_adds_up_every_model_call() -> None:
    meter = Meter()
    for _ in range(2):
        meter.on_llm_end(LLMResult(generations=[[ChatGeneration(message=answer_with_usage())]]))
    # A call without usage (some stand-in models) adds nothing.
    meter.on_llm_end(LLMResult(generations=[[ChatGeneration(message=AIMessage("x"))]]))
    assert meter.tokens == Tokens(input=2400, cached=2000, output=160)


def test_cost_uses_the_cached_price_for_cached_tokens(settings: Settings) -> None:
    priced = settings.model_copy(
        update={"price_input": 1.0, "price_cached_input": 0.1, "price_output": 4.0}
    )
    # 200 fresh x 1.0 + 1000 cached x 0.1 + 80 out x 4.0 = 620 millionths of a dollar.
    assert cost_micros(Tokens(input=1200, cached=1000, output=80), priced) == 620


def test_the_longest_message_the_person_wrote() -> None:
    body = run_body("a" * 30)
    body["messages"] += [
        {"id": "m2", "role": "assistant", "content": "b" * 5000},
        {"id": "m3", "role": "user", "content": [{"type": "text", "text": "c" * 40}]},
    ]
    assert longest_message(json.dumps(body).encode()) == 40
    assert longest_message(b"not json") == 0


# The gate


def test_a_run_without_a_question_from_the_backend_is_refused(limited: Settings) -> None:
    model = RecordingModel(responses=[answer_with_usage()])
    ledger = FakeLedger(limited)
    client = app_with(limited, ledger, model)

    assert client.post("/agent", json=run_body()).status_code == 402
    assert (
        client.post("/agent", json=run_body(), headers={"X-Sidera-Turn": "nope"}).status_code == 402
    )
    assert client.post("/agent/suggest", json=run_body()).status_code == 402
    assert ledger.started == []
    assert model.i == 0  # no model call was made


def test_a_question_the_backend_refuses_gets_no_answer(limited: Settings) -> None:
    model = RecordingModel(responses=[answer_with_usage()])
    ledger = FakeLedger(limited, allow=False)
    client = app_with(limited, ledger, model)

    refused = client.post("/agent", json=run_body(), headers={"X-Sidera-Turn": TURN})
    assert refused.status_code == 402
    assert ledger.started == [(TURN, "answer")]
    assert ledger.reported == []
    assert model.i == 0


def test_an_allowed_question_is_answered_and_its_cost_reported(limited: Settings) -> None:
    model = RecordingModel(responses=[answer_with_usage("Your nakatha is Rohini.")])
    ledger = FakeLedger(limited)
    client = app_with(limited, ledger, model)

    response = client.post("/agent", json=run_body(), headers={"X-Sidera-Turn": TURN})
    assert response.status_code == 200
    assert "Rohini" in response.text
    assert ledger.started == [(TURN, "answer")]
    assert ledger.reported == [(TURN, Tokens(input=1200, cached=1000, output=80))]


def test_follow_up_buttons_need_the_same_question(limited: Settings) -> None:
    model = RecordingModel(responses=[answer_with_usage()])
    ledger = FakeLedger(limited)
    client = app_with(limited, ledger, model)
    client.post("/agent/suggest", json=run_body(), headers={"X-Sidera-Turn": TURN})
    assert ledger.started == [(TURN, "suggest")]
    assert len(ledger.reported) == 1


def test_a_long_message_is_refused(limited: Settings) -> None:
    model = RecordingModel(responses=[answer_with_usage()])
    ledger = FakeLedger(limited, max_length=10)
    client = app_with(limited, ledger, model)
    refused = client.post("/agent", json=run_body("x" * 11), headers={"X-Sidera-Turn": TURN})
    assert refused.status_code == 413
    assert model.i == 0


def test_the_access_key_is_checked_before_the_backend_is_asked(limited: Settings) -> None:
    locked = limited.model_copy(update={"access_key": SecretStr("k")})
    ledger = FakeLedger(locked)
    client = app_with(locked, ledger, RecordingModel(responses=[answer_with_usage()]))
    assert (
        client.post("/agent", json=run_body(), headers={"X-Sidera-Turn": TURN}).status_code == 401
    )
    assert ledger.started == []


def test_without_a_chat_key_there_are_no_limits(settings: Settings) -> None:
    # Local runs: no backend to ask. The run reaches the agent route as before.
    client = TestClient(create_app(settings, model=RecordingModel(responses=[AIMessage("Hi.")])))
    assert client.post("/agent", json=run_body()).status_code == 200


def test_production_needs_the_chat_key(settings: Settings) -> None:
    production = settings.model_copy(update={"environment": "production"})
    with pytest.raises(RuntimeError, match="ASTRONOMIA_AGENT_CHAT_KEY"):
        create_app(production)


def test_health_stays_open(limited: Settings) -> None:
    client = app_with(limited, FakeLedger(limited), RecordingModel(responses=[AIMessage("x")]))
    assert client.get("/healthz").status_code == 200


async def test_the_ledger_talks_to_the_backend_with_the_chat_key(limited: Settings) -> None:
    seen: list[httpx.Request] = []

    def backend(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path.endswith("/start"):
            return httpx.Response(200, json={"kind": "paid", "max_length": 1000})
        return httpx.Response(204)

    keyed = limited.model_copy(update={"backend_access_key": SecretStr("backend-key")})
    http = httpx.AsyncClient(
        base_url="http://engine.test",
        transport=httpx.MockTransport(backend),
        headers={"X-Chat-Key": "chat-key", "X-Access-Key": "backend-key"},
    )
    ledger = Ledger(keyed, http=http)
    assert await ledger.start(TURN, "answer") == Granted("paid", 1000)
    await ledger.report(TURN, Tokens(input=10, cached=0, output=5))
    assert [r.url.path for r in seen] == [
        f"/v1/chat/turns/{TURN}/start",
        f"/v1/chat/turns/{TURN}/usage",
    ]
    usage = json.loads(seen[1].content)
    assert set(usage) == {"input_tokens", "cached_tokens", "output_tokens", "cost_micros"}
    await ledger.aclose()


def test_the_ledger_sends_the_keys_it_is_given(limited: Settings) -> None:
    keyed = limited.model_copy(update={"backend_access_key": SecretStr("backend-key")})
    ledger = Ledger(keyed)
    assert ledger.http.headers["X-Chat-Key"] == "chat-key"
    assert ledger.http.headers["X-Access-Key"] == "backend-key"


async def test_a_backend_that_cannot_be_reached_allows_nothing(limited: Settings) -> None:
    def down(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    http = httpx.AsyncClient(base_url="http://engine.test", transport=httpx.MockTransport(down))
    ledger = Ledger(limited, http=http)
    assert await ledger.start(TURN, "answer") is None
    await ledger.report(TURN, Tokens())  # logged, not raised
