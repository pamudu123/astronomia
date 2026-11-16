"""The follow-up suggester: writes the question buttons shown under each answer.

The chat (CopilotKit) asks for suggestions after every answer. It sends the conversation
and the page context to this agent with a frontend tool, `copilotkitSuggest`, and reads the
suggestions from the tool call. Running the full guide for that would cost a whole agent
loop; this is a single model call with the tool forced:

- `CopilotKitMiddleware` offers the frontend tool to the model, adds the page context
  ("App Context"), and ends the run when the model calls the tool, so the browser gets it.
- `_followup_call` keeps only the recent text of the conversation (no engine tool calls,
  which the model has no tools for) and forces the `copilotkitSuggest` tool. It also names
  the language of Astro's last answer, so the buttons match the answer, not the page
  (QA ASTRO-04: a Sinhala answer on an English page had English buttons).
"""

from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.state import CompiledStateGraph

from app.config import Settings
from app.graph import build_model

PROMPT_FILE = Path(__file__).parent / "prompts" / "suggest.md"

# The frontend tool CopilotKit sends with every suggestion request.
SUGGEST_TOOL = "copilotkitSuggest"

# Enough of the conversation to follow the thread, and to avoid repeating earlier questions.
RECENT_MESSAGES = 8

# The Sinhala block of Unicode.
SINHALA = range(0x0D80, 0x0E00)


def _text(message: AnyMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    return " ".join(
        part.get("text", "") if isinstance(part, dict) else str(part) for part in content
    )


def recent_text(messages: list[AnyMessage]) -> list[AnyMessage]:
    """The person's messages and Astro's written answers, most recent last.

    Tool calls and tool results are dropped: they belong to the guide's tools, which this
    model doesn't have, and the answers already say what they found.
    """
    kept: list[AnyMessage] = []
    for message in messages:
        text = _text(message).strip()
        if not text:
            continue
        if isinstance(message, HumanMessage):
            kept.append(HumanMessage(content=text))
        elif isinstance(message, AIMessage):
            kept.append(AIMessage(content=text))
    return kept[-RECENT_MESSAGES:]


def answer_language(messages: list[AnyMessage]) -> str | None:
    """'si' or 'en': the language of Astro's last written answer, by its letters.

    Mostly Sinhala letters means Sinhala; a few English words (a star's name, "Rahu kalaya")
    don't change that. None when there is no answer yet.
    """
    for message in reversed(messages):
        if not isinstance(message, AIMessage):
            continue
        letters = [ch for ch in _text(message) if ch.isalpha()]
        if not letters:
            continue
        sinhala = sum(ord(ch) in SINHALA for ch in letters)
        return "si" if sinhala / len(letters) >= 0.3 else "en"
    return None


def language_note(language: str) -> str:
    name = "Sinhala" if language == "si" else "English"
    return (
        "# Language of these suggestions\n\n"
        f"Astro's last answer is in {name}. Write every suggestion in {name}, whatever the "
        f"page's language. This overrides any other note about language."
    )


@wrap_model_call
async def _followup_call(
    request: ModelRequest[Any],
    handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
) -> ModelResponse[Any]:
    offered = {getattr(t, "name", None) or t.get("name") for t in request.tools}  # type: ignore[union-attr]
    messages = recent_text(request.messages)
    overrides: dict[str, Any] = {"messages": messages}
    if SUGGEST_TOOL in offered:
        overrides["tool_choice"] = SUGGEST_TOOL
    if language := answer_language(messages):
        base = request.system_prompt
        note = language_note(language)
        overrides["system_message"] = SystemMessage(content=f"{base}\n\n{note}" if base else note)
    return await handler(request.override(**overrides))


def build_suggester(
    settings: Settings,
    *,
    model: BaseChatModel | None = None,
    checkpointer: BaseCheckpointSaver[Any] | None = None,
) -> CompiledStateGraph[Any, Any, Any, Any]:
    """The suggester graph. `model` and `checkpointer` can be swapped in tests."""
    # Typed loosely: each middleware declares its own state type, which mypy can't join.
    middleware: list[Any] = [CopilotKitMiddleware(), _followup_call]
    return create_agent(
        model=model or build_model(settings),
        tools=[],
        system_prompt=PROMPT_FILE.read_text(encoding="utf-8"),
        # The tool choice goes on after CopilotKit has added the frontend tool.
        middleware=middleware,
        # The AG-UI adapter reads the thread's state, so the graph needs a checkpointer.
        checkpointer=checkpointer or InMemorySaver(),
        name="suggest",
    )
