"""The follow-up suggester: one forced call to the chat's suggest tool, on the recent text."""

from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from pydantic import Field

from app.config import Settings
from app.suggest import PROMPT_FILE, RECENT_MESSAGES, SUGGEST_TOOL, build_suggester, recent_text

from .conftest import RecordingModel

CONFIG: Any = {"configurable": {"thread_id": "s1"}}

# The tool as CopilotKit sends it (core/src/suggestions: SUGGEST_TOOL).
FRONTEND_TOOL = {
    "name": SUGGEST_TOOL,
    "description": "Suggest what the user could say next",
    "parameters": {
        "type": "object",
        "properties": {
            "suggestions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"title": {"type": "string"}, "message": {"type": "string"}},
                    "required": ["title", "message"],
                },
            }
        },
        "required": ["suggestions"],
    },
}

SUGGESTIONS = [
    {"title": "What does my Rajju result mean?", "message": "What does my Rajju result mean?"},
    {"title": "Which day suits our wedding?", "message": "Which day suits our wedding?"},
]


class Capturing(RecordingModel):
    """Also remembers the tool choice and the messages each call was given."""

    tool_choice: Any = None
    seen: list[Any] = Field(default_factory=list)

    def bind_tools(self, tools: Any, **kwargs: Any) -> "Capturing":
        self.tool_choice = kwargs.get("tool_choice")
        super().bind_tools(tools, **kwargs)
        return self

    def _generate(self, messages: Any, *args: Any, **kwargs: Any) -> Any:
        self.seen = list(messages)
        return super()._generate(messages, *args, **kwargs)


def suggestion_call() -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[{"id": "c1", "name": SUGGEST_TOOL, "args": {"suggestions": SUGGESTIONS}}],
    )


async def test_forces_the_suggest_tool_on_the_recent_text(settings: Settings) -> None:
    model = Capturing(responses=[suggestion_call()])
    graph = build_suggester(settings, model=model)
    history = [
        HumanMessage("Is our match good?"),
        AIMessage(
            content="",
            tool_calls=[{"id": "t1", "name": "find_matching_stars", "args": {}}],
        ),
        ToolMessage(content='{"score": 14}', tool_call_id="t1"),
        AIMessage(content="Your match has 14 of 20 factors agreeing."),
        HumanMessage("Suggest what the user could say next."),
    ]

    result = await graph.ainvoke(
        {"messages": history, "copilotkit": {"actions": [FRONTEND_TOOL]}}, CONFIG
    )

    assert model.offered == [SUGGEST_TOOL]
    assert model.tool_choice == SUGGEST_TOOL
    # The guide's tool call and its result never reach this model.
    assert not any(isinstance(m, ToolMessage) for m in model.seen)
    assert not any(getattr(m, "tool_calls", None) for m in model.seen)
    # The browser receives the suggestions as the tool call.
    calls = [c for m in result["messages"] for c in getattr(m, "tool_calls", None) or []]
    assert calls[-1]["name"] == SUGGEST_TOOL
    assert calls[-1]["args"]["suggestions"] == SUGGESTIONS


def test_keeps_only_recent_written_messages() -> None:
    history: list[Any] = []
    for n in range(10):
        history += [HumanMessage(f"q{n}"), AIMessage(content=f"a{n}")]
    history.append(ToolMessage(content="raw", tool_call_id="x"))

    kept = recent_text(history)

    assert len(kept) == RECENT_MESSAGES
    assert [m.content for m in kept[-2:]] == ["q9", "a9"]


def test_prompt_asks_for_first_person_questions() -> None:
    prompt = PROMPT_FILE.read_text(encoding="utf-8")
    assert "First person" in prompt
    assert "Would you like" in prompt  # named as something never to write
    assert "මගේ" in prompt
