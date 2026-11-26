"""What a run sends to the browser.

The chat sends the whole conversation back with every question, and both the website's chat
route and this service refuse a request that is too large (frontend/app/api/copilotkit/route.ts,
app/usage.py). Two things made it grow by tens of kilobytes a question, until the seventh or so
question about a chart got no answer:

- the text of the skill files the assistant read, which nobody sees in the chat, and
- the state, which held every message a second time.

Neither is needed in the browser. The messages are kept here, in the conversation's memory
(app/memory.py), and the AG-UI adapter takes them from there: a message the browser sends back
counts only when its id is not in memory, and the browser's copy of the state is replaced on
every run. So the browser gets a short note in place of a skill's text, and an empty state.

The note matters only when the memory is gone (this service restarted). The conversation is then
rebuilt from the browser's copy: every tool call still has its result, and the note tells the
model to open the file again. Every other result, such as the engine's facts that the chat draws
cards from, goes to the browser in full.
"""

from typing import Any

from ag_ui.core import (
    AssistantMessage,
    EventType,
    MessagesSnapshotEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
    ToolMessage,
)
from copilotkit import LangGraphAGUIAgent

# The tool that opens skill files (app/graph.py keeps only `ls` and `read_file`).
READS_FILES = "read_file"

FILE_NOTE = (
    "[This file was read earlier in the conversation. Its text is not kept here. "
    "Read the file again before relying on it.]"
)


def _short(content: Any) -> str:
    """A file's text as the note. Anything shorter, such as an error, is left as it is."""
    if isinstance(content, str) and len(content) <= len(FILE_NOTE):
        return content
    return FILE_NOTE


class ChatAgent(LangGraphAGUIAgent):
    """The AG-UI agent, without skill texts and conversation state in what it streams."""

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        # Calls of `read_file` seen in this run. The endpoint makes a fresh copy of the agent for
        # every request (`clone`), so nothing is shared between conversations.
        self._file_calls: set[str] = set()

    def get_state_snapshot(self, state: Any) -> dict[str, Any]:
        # Empty rather than left out, so a browser that still holds an old state drops it.
        return {}

    def _dispatch_event(self, event: Any) -> Any:
        match event:
            case ToolCallStartEvent(tool_call_name=name, tool_call_id=call) if name == READS_FILES:
                self._file_calls.add(call)
            case ToolCallResultEvent(tool_call_id=call) if call in self._file_calls:
                event = event.model_copy(update={"content": _short(event.content)})
            case MessagesSnapshotEvent(type=EventType.MESSAGES_SNAPSHOT):
                event = event.model_copy(update={"messages": self._without_files(event.messages)})
        return super()._dispatch_event(event)

    def _without_files(self, messages: list[Any]) -> list[Any]:
        calls = self._file_calls | {
            call.id
            for message in messages
            if isinstance(message, AssistantMessage)
            for call in message.tool_calls or []
            if call.function.name == READS_FILES
        }
        return [
            message.model_copy(update={"content": _short(message.content)})
            if isinstance(message, ToolMessage) and message.tool_call_id in calls
            else message
            for message in messages
        ]
