"""What a run streams to the browser: no skill texts and no state, so a long chat keeps working.

These tests play the browser's part as the AG-UI client does: apply the run's last messages and
state, then send both back with the next question.
"""

import json
from typing import Any

from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import Field

from app.config import Settings
from app.graph import SKILLS_DIR
from app.main import create_app
from app.usage import MAX_BODY
from app.wire import FILE_NOTE

from .conftest import RecordingModel

SKILL = "/skills/personal-reading/reference.md"
# A line of that file, to look for where it must and must not be.
SKILL_TEXT = (SKILLS_DIR / "personal-reading" / "reference.md").read_text("utf-8").splitlines()[0]
# The questions a paid report includes (docs/18).
PAID_QUESTIONS = 20


class Seeing(RecordingModel):
    """Also remembers the messages each call was given."""

    seen: list[list[AnyMessage]] = Field(default_factory=list)

    def _generate(self, messages: Any, *args: Any, **kwargs: Any) -> Any:
        self.seen.append(list(messages))
        return super()._generate(messages, *args, **kwargs)


def call(name: str, number: int, **args: Any) -> AIMessage:
    return AIMessage(content="", tool_calls=[{"id": f"t{number}", "name": name, "args": args}])


def answer(number: int) -> AIMessage:
    return AIMessage(content=f"Answer {number}. " + "What the chart says about this. " * 60)


def reading(number: int) -> list[AIMessage]:
    """The model's side of one question: it reads a long skill file, then answers."""
    return [
        call("read_file", number, file_path=SKILL, offset=0, limit=2000),
        answer(number),
    ]


class Browser:
    """The chat in the browser: keeps the conversation and sends it all with every question."""

    def __init__(self, client: TestClient) -> None:
        self.client = client
        self.messages: list[dict[str, Any]] = []
        self.state: Any = {}
        self.events: list[dict[str, Any]] = []
        self.size = 0

    def ask(self, text: str) -> None:
        self.messages.append({"id": f"u{len(self.messages)}", "role": "user", "content": text})
        body = json.dumps(
            {
                "threadId": "chat-1",
                "runId": f"run-{len(self.messages)}",
                "messages": self.messages,
                "state": self.state,
                "tools": [],
                "context": [{"description": "Page", "value": "x" * 4000}],
                "forwardedProps": {},
            }
        )
        self.size = len(body.encode())
        response = self.client.post(
            "/agent", content=body, headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        self.events = [
            json.loads(line.removeprefix("data: "))
            for line in response.text.splitlines()
            if line.startswith("data: ")
        ]
        assert self.events[-1]["type"] == "RUN_FINISHED", self.events[-1]
        for event in self.events:
            if event["type"] == "MESSAGES_SNAPSHOT":
                self.messages = event["messages"]
            elif event["type"] == "STATE_SNAPSHOT":
                self.state = event["snapshot"]

    def of(self, kind: str) -> list[dict[str, Any]]:
        return [event for event in self.events if event["type"] == kind]

    def results(self) -> list[str]:
        return [m["content"] for m in self.messages if m["role"] == "tool"]


def service(settings: Settings, replies: list[AIMessage]) -> tuple[TestClient, Seeing]:
    model = Seeing(responses=replies)
    return TestClient(create_app(settings, model=model, explain_model=model)), model


def tool_results(messages: list[AnyMessage]) -> list[str]:
    return [str(m.content) for m in messages if isinstance(m, ToolMessage)]


class Reader(Seeing):
    """Reads the long skill file for every question, then answers it. Anything else it is asked
    is Deep Agents shortening its own old messages, which a chat this long can need."""

    def _generate(self, messages: Any, *args: Any, **kwargs: Any) -> Any:
        super()._generate(messages, *args, **kwargs)
        last = messages[-1]
        number = len(self.seen)  # makes each call id its own
        reply = AIMessage(content="A summary.")
        if isinstance(last, ToolMessage):
            reply = answer(number)
        elif str(last.content).startswith("Question"):
            reply = reading(number)[0]
        return ChatResult(generations=[ChatGeneration(message=reply)])


def test_a_paid_reports_whole_chat_stays_far_under_the_limit(settings: Settings) -> None:
    model = Reader(responses=[AIMessage(content="")])
    client = TestClient(create_app(settings, model=model, explain_model=model))
    browser = Browser(client)

    for n in range(1, PAID_QUESTIONS + 1):
        browser.ask(f"Question {n}")
        assert browser.messages[-1]["content"].startswith("Answer")
        # The assistant itself has the text it read for this question.
        assert SKILL_TEXT in tool_results(model.seen[-1])[-1]

    # Every question and answer is there. Each reading alone is tens of kilobytes; before, about
    # seven of them reached the limit.
    assert sum(m["role"] == "user" for m in browser.messages) == PAID_QUESTIONS
    assert browser.size < MAX_BODY / 4


def test_the_text_of_a_skill_and_the_state_are_not_streamed(settings: Settings) -> None:
    client, _ = service(settings, reading(1))
    browser = Browser(client)
    browser.ask("What about my career?")

    assert SKILL_TEXT not in json.dumps(browser.events, ensure_ascii=False)
    assert [event["content"] for event in browser.of("TOOL_CALL_RESULT")] == [FILE_NOTE]
    assert browser.results() == [FILE_NOTE]
    assert browser.of("STATE_SNAPSHOT")
    assert all(event["snapshot"] == {} for event in browser.of("STATE_SNAPSHOT"))
    # The chat's "reading notes" line still has its call.
    assert [event["toolCallName"] for event in browser.of("TOOL_CALL_START")] == ["read_file"]


def test_an_engine_result_reaches_the_browser_in_full(settings: Settings) -> None:
    # The date tool needs no backend; the cards' tools go the same way.
    client, model = service(settings, [call("current_date", 1), AIMessage(content="Today.")])
    browser = Browser(client)
    browser.ask("What is the date?")

    sent = tool_results(model.seen[-1])
    assert [event["content"] for event in browser.of("TOOL_CALL_RESULT")] == sent
    assert browser.results() == sent
    assert FILE_NOTE not in sent


def test_a_file_error_is_left_as_it_is(settings: Settings) -> None:
    client, model = service(
        settings,
        [call("read_file", 1, file_path="/skills/none.md"), AIMessage(content="Sorry.")],
    )
    browser = Browser(client)
    browser.ask("What about my career?")

    assert browser.results() == tool_results(model.seen[-1])
    assert "not found" in browser.results()[0]


def test_the_chat_goes_on_after_the_service_restarts(settings: Settings) -> None:
    client, _ = service(settings, reading(1))
    browser = Browser(client)
    browser.ask("What about my career?")

    # A new service has no memory of the conversation: it has only what the browser sends.
    browser.client, model = service(settings, reading(2))
    browser.ask("And money?")

    first = model.seen[0]
    asked = [str(m.content) for m in first if isinstance(m, HumanMessage)]
    assert asked == ["What about my career?", "And money?"]
    # Every tool call has its result, as the model needs, and the result says to read again.
    calls = [c["id"] for m in first if isinstance(m, AIMessage) for c in m.tool_calls]
    assert calls == [m.tool_call_id for m in first if isinstance(m, ToolMessage)] == ["t1"]
    assert tool_results(first) == [FILE_NOTE]
    # Read again, the text is there for the model, and still not in the browser.
    assert SKILL_TEXT in tool_results(model.seen[1])[-1]
    assert browser.results() == [FILE_NOTE, FILE_NOTE]


def test_a_browser_that_still_holds_an_old_state_drops_it(settings: Settings) -> None:
    client, model = service(settings, reading(1))
    browser = Browser(client)
    browser.state = {"messages": [{"id": "old", "type": "human", "content": "y" * 1000}]}
    browser.ask("What about my career?")

    assert browser.state == {}
    # And the copy in it was never read.
    assert not any("yyyy" in str(m.content) for m in model.seen[-1])
