"""Diagrams in the chat (docs/24): only what the page offers, at most one, no chart data."""

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from app.config import Settings
from app.main import create_app
from app.tools.visuals import offered
from tests.conftest import RecordingModel

CHART = {
    "page": "chart_result",
    "language": "en",
    "visuals": {"id": "v1", "offers": ["pillars", "houses", "periods"]},
}


def call(visual: str, id: str = "t1", **args: Any) -> dict[str, Any]:
    return {"id": id, "name": "show_visual", "args": {"visual": visual, **args}}


def run(client: TestClient, page: dict[str, Any], question: str = "Hi") -> list[str]:
    """Asks one question and gives back each tool result the browser receives."""
    response = client.post(
        "/agent",
        json={
            "threadId": "a",
            "runId": question,
            "messages": [{"id": question, "role": "user", "content": question}],
            "state": {},
            "tools": [],
            "context": [{"description": "The page", "value": json.dumps(page)}],
            "forwardedProps": {},
        },
    )
    assert "RUN_ERROR" not in response.text
    events = [json.loads(x[5:]) for x in response.text.splitlines() if x.startswith("data:")]
    return [e["content"] for e in events if e["type"] == "TOOL_CALL_RESULT"]


def client_with(settings: Settings, *calls: list[dict[str, Any]]) -> TestClient:
    answers = [
        message
        for tool_calls in calls
        for message in (AIMessage(content="", tool_calls=tool_calls), AIMessage(content="Done."))
    ]
    model = RecordingModel(responses=answers)
    return TestClient(create_app(settings, model=model, explain_model=model))


def test_shows_a_diagram_the_page_offers_by_name_only(settings: Settings) -> None:
    client = client_with(settings, [call("houses", houses=[11, 10, 10])])

    (result,) = run(client, CHART)

    assert json.loads(result) == {"shown": "houses", "page": "v1", "houses": [10, 11]}


def test_houses_are_only_for_the_houses_diagram(settings: Settings) -> None:
    (result,) = run(client_with(settings, [call("periods", houses=[10])]), CHART)

    assert json.loads(result) == {"shown": "periods", "page": "v1"}


@pytest.mark.parametrize(
    "page",
    [
        {"page": "home", "language": "en"},
        {"page": "match_result", "visuals": {"id": "v2", "offers": ["ring"]}},
    ],
)
def test_refuses_a_diagram_the_page_does_not_offer(
    settings: Settings, page: dict[str, Any]
) -> None:
    (result,) = run(client_with(settings, [call("periods")]), page)

    assert "can't draw that" in result


@pytest.mark.parametrize("args", [{"visual": "tarot"}, {"visual": "houses", "houses": [13]}])
def test_refuses_unknown_names_and_houses(settings: Settings, args: dict[str, Any]) -> None:
    # The model hears what was wrong; nothing reaches the browser to draw.
    assert not any('"shown"' in r for r in run(client_with(settings, [call(**args)]), CHART))


def test_follows_the_page_of_each_question(settings: Settings) -> None:
    client = client_with(settings, [call("periods", "t1")], [call("periods", "t2")])
    other = {**CHART, "visuals": {"id": "v2", "offers": ["periods"]}}

    (first,) = run(client, CHART, "One")
    second = run(client, other, "Two")[-1]

    assert json.loads(first)["page"] == "v1"
    assert json.loads(second)["page"] == "v2"


def test_at_most_one_diagram_in_an_answer(settings: Settings) -> None:
    results = run(client_with(settings, [call("periods", "t1"), call("pillars", "t2")]), CHART)

    assert sum('"shown"' in r for r in results) == 1


def test_ignores_context_it_does_not_understand() -> None:
    nothing: tuple[None, frozenset[str]] = (None, frozenset())
    assert offered({}) == nothing
    assert offered({"copilotkit": {"context": [{"value": "not json"}]}}) == nothing
    assert offered({"copilotkit": {"context": [{"value": "[1]"}]}}) == nothing
