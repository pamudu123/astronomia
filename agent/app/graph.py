"""Builds the assistant: one Deep Agents agent with skills, engine tools and page context.

What goes where:

- `app/prompts/guide.md`: who the assistant is and the rules for every answer. Always loaded.
- `skills/<name>/SKILL.md`: guidance for one topic. The agent sees each skill's one-line
  description and reads the full file only when the topic comes up (Deep Agents skills).
  Adding a topic means adding a folder, not changing code.
- `app/tools/`: facts from the calculation engine, one module per topic.
- `app/subagents.py`: helpers the guide can hand work to (`task` tool), capped per question.
- Page context: CopilotKit's middleware adds what the person sees on the page to every
  model call, under "App Context".

Deep Agents features are switched on only when a question needs them (docs/14, section 7).
There is no file writing and no general-purpose subagent.
"""

from collections.abc import Sequence
from pathlib import Path
from typing import Any

from copilotkit import CopilotKitMiddleware
from deepagents import (
    FilesystemPermission,
    GeneralPurposeSubagentProfile,
    HarnessProfile,
    create_deep_agent,
    register_harness_profile,
)
from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.state import CompiledStateGraph

from app.clock import today_middleware
from app.config import Settings
from app.subagents import build_subagents
from app.tools.visuals import SHOW_VISUAL

AGENT_ROOT = Path(__file__).resolve().parents[1]
SKILLS_DIR = AGENT_ROOT / "skills"
PROMPT_FILE = Path(__file__).parent / "prompts" / "guide.md"

# Where skills appear inside the agent's virtual file system.
SKILLS_PATH = "/skills/"

# Built-in Deep Agents tools a public chat does not need. The agent keeps `ls` and
# `read_file`, which is how it opens skills.
HIDDEN_TOOLS = frozenset({"write_file", "edit_file", "delete", "glob", "grep", "execute"})


def build_model(settings: Settings) -> BaseChatModel:
    """The chat model named in settings."""
    kwargs: dict[str, Any] = {}
    if settings.model.startswith("openai:"):
        key = settings.openai_api_key.get_secret_value()
        if not key:
            # One clear line in the host's logs instead of a long OpenAI traceback.
            raise RuntimeError("OPENAI_API_KEY is not set. Add it to the agent's environment.")
        kwargs = {
            # Responses API without storing anything on OpenAI's side (privacy, docs/14 s.11).
            # Reasoning is passed back encrypted, so multi-step turns still work.
            "use_responses_api": True,
            "store": False,
            "include": ["reasoning.encrypted_content"],
            "reasoning": {"effort": settings.reasoning_effort},
            "api_key": key,
        }
    model: BaseChatModel = init_chat_model(settings.model, **kwargs)
    return model


def system_prompt() -> str:
    return PROMPT_FILE.read_text(encoding="utf-8")


def build_agent(
    settings: Settings,
    tools: Sequence[BaseTool],
    *,
    model: BaseChatModel | None = None,
    checkpointer: BaseCheckpointSaver[Any] | None = None,
) -> CompiledStateGraph[Any, Any, Any, Any]:
    """The assistant graph. `model` and `checkpointer` can be swapped in tests."""
    model = model or build_model(settings)
    # Profiles are looked up by provider:model, so register one for the configured model.
    register_harness_profile(
        settings.model,
        HarnessProfile(
            excluded_tools=HIDDEN_TOOLS,
            general_purpose_subagent=GeneralPurposeSubagentProfile(enabled=False),
        ),
    )
    # Scratch files live in the conversation state. /skills/ is the repository folder,
    # read only.
    # Typed loosely: each middleware declares its own state type, which mypy can't join.
    middleware: list[Any] = [
        CopilotKitMiddleware(),
        # Today's date on every call, so "today" is the real day (QA ASTRO-01).
        today_middleware,
        # A cap on helpers per question, so one message can't start a costly fan-out.
        ToolCallLimitMiddleware(tool_name="task", run_limit=settings.max_subagent_calls),
        # At most one diagram in an answer (docs/24).
        ToolCallLimitMiddleware(tool_name=SHOW_VISUAL, run_limit=1),
    ]
    backend = CompositeBackend(
        default=StateBackend(),
        routes={SKILLS_PATH: FilesystemBackend(root_dir=SKILLS_DIR, virtual_mode=True)},
    )
    return create_deep_agent(
        model=model,
        tools=list(tools),
        system_prompt=system_prompt(),
        skills=[SKILLS_PATH],
        backend=backend,
        permissions=[
            FilesystemPermission(operations=["write"], paths=[f"{SKILLS_PATH}**"], mode="deny")
        ],
        subagents=build_subagents(tools, SKILLS_PATH),
        middleware=middleware,
        checkpointer=checkpointer or InMemorySaver(),
        name="guide",
    )
