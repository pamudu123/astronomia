"""Astro chat limits on the AI service's side (docs/18 section 5, docs/21).

The backend keeps the rules and the counts. This service makes sure nothing skips them:

- **No question without the backend's yes.** Every chat run (`POST /agent`) and follow-up run
  (`POST /agent/suggest`) must carry a question id (X-Sidera-Turn) that the backend gave the
  website's chat route. The run first takes the question up with the backend, which allows each
  question to be answered once and to get its follow-up buttons once. Without that, the run is
  refused before any model is called. So calling this service directly, even with its access
  key, gets no answer the limits did not allow.
- **Real cost.** Every model call in the run, the guide's, its helpers' and the follow-ups', is
  counted from the token usage the AI provider reports. When the run ends, the tokens and their
  cost go to the backend against the question. Only numbers travel: never the text.
- **Length.** The backend says how long a message may be; a longer one is refused.

All of this is on only when ASTRONOMIA_AGENT_CHAT_KEY is set (it is required in production).
"""

import contextvars
import json
import logging
import threading
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, LLMResult
from langchain_core.tracers.context import register_configure_hook
from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import Settings

log = logging.getLogger(__name__)

TURN_HEADER = "X-Sidera-Turn"
CHAT_KEY_HEADER = "X-Chat-Key"
Purpose = Literal["answer", "suggest"]
PURPOSES: dict[str, Purpose] = {"/agent": "answer", "/agent/suggest": "suggest"}
# A run carries the conversation and the page's summary. Far above what the site sends.
MAX_BODY = 512 * 1024


# Measuring


@dataclass(frozen=True)
class Tokens:
    input: int = 0  # every input token, cached ones included
    cached: int = 0  # input tokens read from the provider's cache, billed at a lower price
    output: int = 0  # reasoning included

    def __add__(self, other: "Tokens") -> "Tokens":
        return Tokens(
            self.input + other.input, self.cached + other.cached, self.output + other.output
        )


class Meter(BaseCallbackHandler):
    """Adds up the token usage of every model call made while it is the current meter."""

    def __init__(self) -> None:
        super().__init__()
        self._lock = threading.Lock()
        self.tokens = Tokens()

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        found = Tokens()
        for generations in response.generations:
            for generation in generations:
                if not isinstance(generation, ChatGeneration):
                    continue
                message = generation.message
                usage = message.usage_metadata if isinstance(message, AIMessage) else None
                if not usage:
                    continue
                details = usage.get("input_token_details") or {}
                found = found + Tokens(
                    input=int(usage.get("input_tokens", 0)),
                    cached=int(details.get("cache_read", 0) or 0),
                    output=int(usage.get("output_tokens", 0)),
                )
        with self._lock:
            self.tokens = self.tokens + found


# The meter for the run in progress. LangChain adds it to every model call made in this context,
# helpers included, because the run's tasks inherit the context.
_current: contextvars.ContextVar[Meter | None] = contextvars.ContextVar(
    "sidera_chat_meter", default=None
)
register_configure_hook(_current, inheritable=True)


def cost_micros(tokens: Tokens, settings: Settings) -> int:
    """What the tokens cost, in millionths of a US dollar, at the prices in settings (US dollars
    per million tokens). A price per million tokens is exactly millionths of a dollar a token."""
    fresh = max(0, tokens.input - tokens.cached)
    cost = (
        fresh * settings.price_input
        + min(tokens.cached, tokens.input) * settings.price_cached_input
        + tokens.output * settings.price_output
    )
    return round(cost)


# Talking to the backend


@dataclass(frozen=True)
class Granted:
    kind: Literal["free", "paid"]
    max_length: int


class Ledger:
    """The backend's chat endpoints: take a question up, report what it cost."""

    def __init__(self, settings: Settings, http: httpx.AsyncClient | None = None) -> None:
        headers = {CHAT_KEY_HEADER: settings.chat_key.get_secret_value()}
        if key := settings.backend_access_key.get_secret_value():
            headers["X-Access-Key"] = key
        self.http = http or httpx.AsyncClient(
            base_url=settings.backend_url, headers=headers, timeout=15.0
        )
        self.settings = settings

    async def start(self, turn: str, purpose: Purpose) -> Granted | None:
        try:
            response = await self.http.post(
                f"/v1/chat/turns/{turn}/start", json={"purpose": purpose}
            )
        except httpx.HTTPError as error:
            log.warning("chat limits: the backend could not be reached: %s", error)
            return None
        if response.status_code != 200:
            if response.status_code != 409:
                log.warning("chat limits: start answered %s", response.status_code)
            return None
        body = response.json()
        return Granted(kind=body["kind"], max_length=int(body["max_length"]))

    async def report(self, turn: str, tokens: Tokens) -> None:
        usage = {
            "input_tokens": tokens.input,
            "cached_tokens": tokens.cached,
            "output_tokens": tokens.output,
            "cost_micros": cost_micros(tokens, self.settings),
        }
        try:
            response = await self.http.post(f"/v1/chat/turns/{turn}/usage", json=usage)
            if response.status_code != 204:
                log.warning("chat limits: usage answered %s", response.status_code)
        except httpx.HTTPError as error:
            # The answer is already with the person. The question still counts; its cost is lost.
            log.warning("chat limits: usage not recorded: %s", error)

    async def aclose(self) -> None:
        await self.http.aclose()


# The gate


def _text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
    return ""


def longest_message(body: bytes) -> int:
    """The length of the longest message the person wrote in this run, in characters."""
    try:
        data = json.loads(body)
    except ValueError:
        return 0
    messages = data.get("messages") if isinstance(data, dict) else None
    if not isinstance(messages, list):
        return 0
    lengths = [
        len(_text(m.get("content")))
        for m in messages
        if isinstance(m, dict) and m.get("role") == "user"
    ]
    return max(lengths, default=0)


def _valid_turn(value: str) -> bool:
    try:
        uuid.UUID(value)
    except ValueError:
        return False
    return True


class ChatLimitMiddleware:
    """Refuses a chat or follow-up run the backend did not allow, and reports what it cost."""

    def __init__(self, app: ASGIApp, ledger: Ledger) -> None:
        self.app = app
        self.ledger = ledger

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        purpose = PURPOSES.get(scope.get("path", "")) if scope["type"] == "http" else None
        if purpose is None or scope.get("method") != "POST":
            await self.app(scope, receive, send)
            return

        turn = Headers(scope=scope).get(TURN_HEADER, "")
        if not _valid_turn(turn):
            await _refuse(scope, receive, send, 402, "no question allowed")
            return
        body = await _read(receive)
        if body is None:
            await _refuse(scope, receive, send, 413, "too large")
            return
        granted = await self.ledger.start(turn, purpose)
        if granted is None:
            await _refuse(scope, receive, send, 402, "no question allowed")
            return
        if purpose == "answer" and longest_message(body) > granted.max_length:
            await _refuse(scope, receive, send, 413, "message too long")
            return

        meter = Meter()
        token = _current.set(meter)
        try:
            await self.app(scope, _replay(body, receive), send)
        finally:
            _current.reset(token)
            await self.ledger.report(turn, meter.tokens)


async def _read(receive: Receive) -> bytes | None:
    """The whole request body, or None when it is larger than MAX_BODY."""
    chunks: list[bytes] = []
    size = 0
    while True:
        message = await receive()
        if message["type"] != "http.request":
            break
        chunk = message.get("body", b"")
        size += len(chunk)
        if size > MAX_BODY:
            return None
        chunks.append(chunk)
        if not message.get("more_body", False):
            break
    return b"".join(chunks)


def _replay(body: bytes, receive: Receive) -> Callable[[], Awaitable[Message]]:
    sent = False

    async def again() -> Message:
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        return await receive()

    return again


async def _refuse(scope: Scope, receive: Receive, send: Send, code: int, detail: str) -> None:
    await JSONResponse({"detail": detail}, status_code=code)(scope, receive, send)
