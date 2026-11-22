"""Conversations kept in memory are deleted after a fixed idle time (app/memory.py)."""

import asyncio
import datetime as dt
from typing import Any

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, HumanMessage

from app.config import Settings
from app.graph import build_agent
from app.main import create_app
from app.memory import ExpiringMemorySaver, run_sweeper
from app.tools import EngineClient, engine_tools

from .conftest import RecordingModel

START = dt.datetime(2026, 11, 21, 9, 0, tzinfo=dt.UTC)
LIMIT = dt.timedelta(minutes=30)


class Clock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.time = START

    def __call__(self) -> dt.datetime:
        return self.time

    def advance(self, **delta: float) -> None:
        self.time += dt.timedelta(**delta)


def config(thread: str) -> Any:
    return {"configurable": {"thread_id": thread}}


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def memory(clock: Clock) -> ExpiringMemorySaver:
    return ExpiringMemorySaver(LIMIT, now=clock)


def agent(settings: Settings, memory: ExpiringMemorySaver, replies: int = 4) -> Any:
    model = RecordingModel(responses=[AIMessage(content=f"Reply {i}.") for i in range(replies)])
    return build_agent(
        settings,
        engine_tools(EngineClient("http://engine.test")),
        model=model,
        checkpointer=memory,
    )


async def say(graph: Any, thread: str, text: str) -> None:
    await graph.ainvoke({"messages": [HumanMessage(text)]}, config(thread))


async def said(graph: Any, thread: str) -> list[str]:
    """The person's messages the agent remembers on this thread."""
    state = await graph.aget_state(config(thread))
    messages = state.values.get("messages", [])
    return [str(m.content) for m in messages if isinstance(m, HumanMessage)]


async def test_a_conversation_is_remembered_while_in_use(
    settings: Settings, memory: ExpiringMemorySaver, clock: Clock
) -> None:
    graph = agent(settings, memory)
    await say(graph, "t1", "first")
    # Each message restarts the idle time: 25 + 25 minutes is more than the limit in total.
    clock.advance(minutes=25)
    await say(graph, "t1", "second")
    clock.advance(minutes=25)

    assert await said(graph, "t1") == ["first", "second"]


async def test_an_idle_conversation_is_dropped_and_the_next_message_starts_afresh(
    settings: Settings, memory: ExpiringMemorySaver, clock: Clock
) -> None:
    graph = agent(settings, memory)
    await say(graph, "t1", "my question")
    clock.advance(minutes=30)

    assert await said(graph, "t1") == []
    await say(graph, "t1", "a new question")
    assert await said(graph, "t1") == ["a new question"]


async def test_only_the_idle_conversations_are_dropped(
    settings: Settings, memory: ExpiringMemorySaver, clock: Clock
) -> None:
    graph = agent(settings, memory)
    await say(graph, "old", "old question")
    clock.advance(minutes=20)
    await say(graph, "recent", "recent question")
    clock.advance(minutes=15)

    assert memory.sweep() == ["old"]
    assert memory.conversations() == 1
    assert await said(graph, "recent") == ["recent question"]


async def test_a_sweep_drops_idle_conversations_without_any_new_request(
    settings: Settings, memory: ExpiringMemorySaver, clock: Clock
) -> None:
    graph = agent(settings, memory)
    await say(graph, "t1", "hello")
    clock.advance(minutes=29, seconds=59)
    assert memory.sweep() == []

    clock.advance(seconds=1)
    assert memory.sweep() == ["t1"]
    assert memory.conversations() == 0
    # Nothing about the thread is left behind.
    assert not memory.writes and not memory.blobs and not memory.storage


async def test_the_sweeper_runs_on_its_own(memory: ExpiringMemorySaver, clock: Clock) -> None:
    calls: list[int] = []

    def sweep() -> list[str]:
        calls.append(1)
        return []

    memory.sweep = sweep  # type: ignore[method-assign]
    task = asyncio.create_task(run_sweeper([memory], every=dt.timedelta(milliseconds=5)))
    await asyncio.sleep(0.05)
    task.cancel()

    assert len(calls) >= 2


def test_the_limit_is_a_setting(settings: Settings) -> None:
    assert Settings(_env_file=None).conversation_idle_minutes == 30
    assert settings.model_copy(update={"conversation_idle_minutes": 10}).conversation_idle_minutes
    with pytest.raises(ValueError):
        Settings(_env_file=None, conversation_idle_minutes=0)
    with pytest.raises(ValueError):
        ExpiringMemorySaver(dt.timedelta(0))


def test_the_app_uses_the_setting(settings: Settings) -> None:
    app = create_app(settings.model_copy(update={"conversation_idle_minutes": 7}))
    with TestClient(app) as client:  # runs the lifespan, which starts and stops the sweeper
        assert client.get("/healthz").status_code == 200

    # One memory for the guide, one for the follow-up suggester.
    assert [m.idle_timeout for m in app.state.memories] == [dt.timedelta(minutes=7)] * 2


def test_the_default_clock_is_the_app_clock() -> None:
    from app import clock as app_clock

    app_clock.set_clock(lambda: START)
    try:
        saver = ExpiringMemorySaver(LIMIT)
        saver._use(config("t1"))
        app_clock.set_clock(lambda: START + LIMIT)
        assert saver.sweep() == ["t1"]
    finally:
        app_clock.set_clock(None)
