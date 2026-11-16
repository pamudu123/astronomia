"""Subagents the guide can hand work to with the `task` tool (docs/14, section 7).

The guide answers most questions itself. It delegates only when a question would crowd the
conversation: several reference notes to read, or several dates or places to look up. It can
start more than one at once (one per date, say), up to `max_subagent_calls` per question.

Each subagent has its own short prompt in `app/prompts/` and only the tools its job needs.
Add one: write its prompt, then add an entry below.
"""

from collections.abc import Sequence
from pathlib import Path

from deepagents import SubAgent
from langchain_core.tools import BaseTool

from app.clock import today_middleware

PROMPTS = Path(__file__).parent / "prompts"


def _prompt(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text(encoding="utf-8")


def _pick(tools: Sequence[BaseTool], names: set[str]) -> list[BaseTool]:
    return [t for t in tools if t.name in names]


def build_subagents(tools: Sequence[BaseTool], skills_path: str) -> list[SubAgent]:
    """The guide's subagents, given the engine tools to share out."""
    return [
        {
            "name": "researcher",
            "description": (
                "Reads several of the site's reference notes and returns the key facts. Use for "
                "background or custom questions that touch more than one topic, or that need a "
                "long reference read, so the conversation stays short."
            ),
            "system_prompt": _prompt("researcher"),
            "tools": [],
            "skills": [skills_path],
        },
        {
            "name": "date-checker",
            "description": (
                "Looks up the almanac for one date, a few dates, or a month, at one place. Use "
                "when a question covers several dates or places: start one per date or place, "
                "at the same time, and compare their answers."
            ),
            "system_prompt": _prompt("date-checker"),
            "tools": _pick(
                tools, {"find_place", "current_date", "good_times_for_day", "month_calendar"}
            ),
            # The guide passes exact dates, but the checker also knows today's.
            "middleware": [today_middleware],
        },
    ]
