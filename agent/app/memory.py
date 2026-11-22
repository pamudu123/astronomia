"""Conversation memory with a fixed idle time limit (legal review, docs/09-launch.md).

The chat keeps each conversation (a LangGraph thread) in this service's memory, so the guide
remembers earlier messages. "Lost when the service restarts" is not a retention limit, so a
conversation nobody has used for `idle_timeout` is deleted:

- on every read or write of any conversation, before the read or write happens, and
- by `sweep()`, which the app runs about once a minute (`run_sweeper`), so a quiet service
  drops old conversations too.

A message on a dropped conversation starts it afresh: the thread has no saved state, as if it
were new. The website also starts a new chat after the same idle time
(frontend/components/assistant/IdleReset.tsx), so it does not send the old messages back.

The clock is `app.clock.now`, which tests can swap, or one passed in.
"""

import asyncio
import datetime as dt
import logging
import threading
from collections.abc import Callable, Iterator, Mapping, Sequence
from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
)
from langgraph.checkpoint.memory import InMemorySaver

from app import clock

logger = logging.getLogger(__name__)

# How often the app looks for idle conversations when no requests come in.
SWEEP_EVERY = dt.timedelta(minutes=1)


def _thread_id(config: RunnableConfig | None) -> str | None:
    if not config:
        return None
    value = config.get("configurable", {}).get("thread_id")
    return str(value) if value is not None else None


class ExpiringMemorySaver(InMemorySaver):
    """An in-memory checkpointer that deletes a conversation once it has been idle too long.

    "Idle" means no checkpoint was read or written for that conversation. Every run reads its
    thread first, so each message counts as use.
    """

    def __init__(
        self,
        idle_timeout: dt.timedelta,
        *,
        now: Callable[[], dt.datetime] | None = None,
    ) -> None:
        if idle_timeout <= dt.timedelta(0):
            raise ValueError("idle_timeout must be positive")
        super().__init__()
        self.idle_timeout = idle_timeout
        self._now = now or clock.now
        self._last_used: dict[str, dt.datetime] = {}
        # The sync methods can be called from worker threads as well as the event loop.
        self._lock = threading.RLock()

    # ---- the time limit ----

    def sweep(self) -> Sequence[str]:
        """Deletes every conversation idle for `idle_timeout` or longer. Returns their ids."""
        with self._lock:
            cutoff = self._now() - self.idle_timeout
            expired = [thread for thread, used in self._last_used.items() if used <= cutoff]
            for thread in expired:
                self.delete_thread(thread)
            # A thread written without a known time (should not happen) is dated now, so it
            # still expires one idle period later.
            for thread in list(self.storage):
                self._last_used.setdefault(thread, self._now())
        if expired:
            # Counts only: thread ids are random, but nothing about a conversation is logged.
            logger.info("Dropped %d idle conversation(s) from memory", len(expired))
        return expired

    def _use(self, config: RunnableConfig | None) -> None:
        """Drops idle conversations, then marks this one as used now."""
        with self._lock:
            self.sweep()
            if thread := _thread_id(config):
                self._last_used[thread] = self._now()

    def conversations(self) -> int:
        """How many conversations are in memory (tests, health)."""
        with self._lock:
            return len(self.storage)

    # ---- the checkpointer, each call counted as use ----

    def get_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        with self._lock:
            self._use(config)
            return super().get_tuple(config)

    def list(
        self,
        config: RunnableConfig | None,
        *,
        filter: dict[str, Any] | None = None,
        before: RunnableConfig | None = None,
        limit: int | None = None,
    ) -> Iterator[CheckpointTuple]:
        with self._lock:
            self._use(config)
            # Collected under the lock, so a sweep can't change the storage mid-listing.
            items = list(super().list(config, filter=filter, before=before, limit=limit))
        yield from items

    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        with self._lock:
            self._use(config)
            return super().put(config, checkpoint, metadata, new_versions)

    def put_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:
        with self._lock:
            self._use(config)
            super().put_writes(config, writes, task_id, task_path)

    def get_delta_channel_history(
        self, *, config: RunnableConfig, channels: Sequence[str]
    ) -> Mapping[str, Any]:
        with self._lock:
            self._use(config)
            return super().get_delta_channel_history(config=config, channels=channels)

    def delete_thread(self, thread_id: str) -> None:
        with self._lock:
            super().delete_thread(thread_id)
            self._last_used.pop(str(thread_id), None)

    # InMemorySaver's async methods (aget_tuple, alist, aput, ...) call the sync ones above.


async def run_sweeper(
    savers: Sequence[ExpiringMemorySaver], every: dt.timedelta = SWEEP_EVERY
) -> None:
    """Sweeps the savers forever, `every` apart. Started and cancelled by the app's lifespan."""
    while True:
        await asyncio.sleep(every.total_seconds())
        for saver in savers:
            try:
                saver.sweep()
            except Exception:  # pragma: no cover - a failed sweep must not stop the next one
                logger.exception("Sweeping idle conversations failed")
