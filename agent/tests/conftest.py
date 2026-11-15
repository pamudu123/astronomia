from collections.abc import Sequence
from typing import Any

import pytest
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage
from pydantic import Field

from app.config import Settings


class RecordingModel(FakeMessagesListChatModel):
    """A stand-in chat model that replies from a list and remembers the tools it was offered.

    It reports itself as openai:gpt-6-luna, so Deep Agents applies the same harness profile
    as in production (profiles are matched by provider and model name).
    """

    offered: list[str] = Field(default_factory=list)
    descriptions: dict[str, str] = Field(default_factory=dict)
    model_name: str = "gpt-6-luna"

    def _get_ls_params(self, stop: list[str] | None = None, **kwargs: Any) -> Any:
        return {**super()._get_ls_params(stop=stop, **kwargs), "ls_provider": "openai"}

    def bind_tools(self, tools: Sequence[Any], **kwargs: Any) -> "RecordingModel":
        def field(tool: Any, name: str) -> Any:
            return getattr(tool, name, None) or tool.get(name)

        self.offered = [field(t, "name") for t in tools]
        self.descriptions = {field(t, "name"): field(t, "description") or "" for t in tools}
        return self


@pytest.fixture
def settings() -> Settings:
    # Explicit values, so a developer's agent/.env never leaks into the tests.
    return Settings(
        _env_file=None,
        OPENAI_API_KEY="test-key",
        model="openai:gpt-6-luna",
        backend_url="http://engine.test",
    )


@pytest.fixture
def model() -> RecordingModel:
    return RecordingModel(responses=[AIMessage(content="Hello.")])
