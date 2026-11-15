"""The assistant graph: the right tools are offered, and the skills are found."""

from typing import Any

import pytest
from langchain_core.messages import HumanMessage

from app.config import Settings
from app.graph import HIDDEN_TOOLS, build_agent, build_model
from app.tools.engine import EngineClient, engine_tools

from .conftest import RecordingModel

CONFIG: Any = {"configurable": {"thread_id": "t1"}}


def agent(settings: Settings, model: RecordingModel) -> Any:
    return build_agent(settings, engine_tools(EngineClient("http://engine.test")), model=model)


async def test_offers_engine_tools_and_skill_reading_but_no_writing(
    settings: Settings, model: RecordingModel
) -> None:
    await agent(settings, model).ainvoke({"messages": [HumanMessage("hi")]}, CONFIG)

    assert "find_matching_stars" in model.offered
    assert "read_file" in model.offered
    assert not HIDDEN_TOOLS & set(model.offered)
    assert "task" not in model.offered, "no subagents until a question needs one"


async def test_finds_every_skill_in_the_skills_folder(
    settings: Settings, model: RecordingModel
) -> None:
    graph = agent(settings, model)
    await graph.ainvoke({"messages": [HumanMessage("hi")]}, CONFIG)

    state = await graph.aget_state(CONFIG)
    names = {s["name"] for s in state.values["skills_metadata"]}
    assert {"explain-match", "sinhala-style", "star-matches"} <= names


async def test_system_prompt_lists_skills(settings: Settings) -> None:
    seen: list[str] = []

    class Capturing(RecordingModel):
        def _generate(self, messages: Any, *args: Any, **kwargs: Any) -> Any:
            seen.append(str(messages[0].content))
            return super()._generate(messages, *args, **kwargs)

    from langchain_core.messages import AIMessage

    model = Capturing(responses=[AIMessage(content="ok")])
    await agent(settings, model).ainvoke({"messages": [HumanMessage("hi")]}, CONFIG)

    system = seen[0]
    assert "You are the guide on Sidera" in system
    assert "/skills/explain-match/SKILL.md" in system


def test_openai_model_keeps_no_data_and_uses_low_effort(settings: Settings) -> None:
    model: Any = build_model(settings)
    assert model.model_name == "gpt-6-luna"
    assert model.store is False
    assert model.reasoning == {"effort": "low"}


def test_missing_openai_key_says_so_plainly(settings: Settings) -> None:
    from pydantic import SecretStr

    no_key = settings.model_copy(update={"openai_api_key": SecretStr("")})
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY is not set"):
        build_model(no_key)


def test_real_model_matches_the_profile_key(settings: Settings) -> None:
    # build_agent registers the harness profile under settings.model. Deep Agents finds it
    # by the model's own provider:name, so the two must agree, or every tool comes back.
    from deepagents._models import get_model_identifier, get_model_provider

    model = build_model(settings)
    assert f"{get_model_provider(model)}:{get_model_identifier(model)}" == settings.model
