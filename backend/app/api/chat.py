"""Astro chat limits (docs/18, section 5; docs/21): what is left, asking, and what it cost.

Only the website's server and the AI service call these, with the chat key (X-Chat-Key). The
site's /api forward never adds that key, so a visitor cannot ask here for a question of their
own, start one, or change what one cost.

1. The website's chat route asks `POST /v1/chat/turns` before passing a message to the AI
   service, naming the browser (the random id in its chat cookie), its network address and,
   through its sign in token, the account. The rules (app/tiers/chat.py) allow a free or paid
   question, or refuse with a reason and a date.
2. The AI service runs only questions this backend allowed: `POST .../start` takes the question
   up once (and its follow-up buttons once).
3. When the answer is written, the AI service reports the tokens and their cost
   (`POST .../usage`).

`POST /v1/chat/status` says what is left, in questions, for the chat to show.
"""

import datetime as dt
import hashlib
import hmac
import ipaddress
import logging
import secrets
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.deps import Accounts, Chats, Orders, Tokens
from app.api.saved import PRIVATE, SettingsDep
from app.auth import BadToken, KeysUnavailable, bearer_token
from app.config import Settings
from app.store.chat import ChatStore, Counts, Kind, Usage, Who
from app.store.orders import OrderStore
from app.tiers.chat import Reason, Summary, Verdict, day_start, decide, micros, summary

log = logging.getLogger(__name__)
KEY_HEADER = "X-Chat-Key"


def chat_key(settings: SettingsDep, given: Annotated[str, Header(alias=KEY_HEADER)] = "") -> None:
    if not settings.chat_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "chat limits are not set up")
    if not secrets.compare_digest(given.encode(), settings.chat_key.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "chat key needed")


router = APIRouter(prefix="/v1/chat", tags=["chat"], dependencies=[Depends(chat_key)])


# Shapes


class Asker(BaseModel):
    # The random id in the browser's chat cookie, made by the website.
    browser: str = Field(pattern=r"^[A-Za-z0-9-]{8,64}$")
    # The visitor's network address as the website saw it. Only a keyed hash of it is kept.
    address: str = Field(default="", max_length=100)


class Ask(Asker):
    length: int = Field(ge=0, description="Characters in the message")


class FreeOut(BaseModel):
    limit: int
    left: int
    resets_at: dt.datetime | None = Field(description="When this week's questions come back")


class PaidOut(BaseModel):
    """The chat that came with the account's paid reports, in questions, never money."""

    questions_left: int
    questions_total: int
    used_share: float = Field(ge=0, le=1)


class Blocked(BaseModel):
    """Why the next question cannot be asked now.

    - burst: too many messages in a minute
    - free_used: this week's free questions are used
    - paid_used: the chat that came with the account's reports, and this week's free ones, are used
    - network: the quiet weekly limit for one network
    - busy: the site's free chat has reached today's spending ceiling
    - account_day: the account's daily ceiling
    """

    reason: Reason
    until: dt.datetime | None


class ChatStatus(BaseModel):
    mode: Kind
    max_length: int
    free: FreeOut
    paid: PaidOut | None = Field(description="None: the account has no paid report")
    blocked: Blocked | None


class TurnOut(BaseModel):
    turn: str
    kind: Kind
    status: ChatStatus


class ChatRefusal(BaseModel):
    reason: Reason | Literal["too_long"]
    until: dt.datetime | None
    status: ChatStatus


class StartIn(BaseModel):
    purpose: Literal["answer", "suggest"] = "answer"


class StartOut(BaseModel):
    kind: Kind
    max_length: int = Field(description="The longest message allowed, in characters")


class UsageIn(BaseModel):
    input_tokens: int = Field(ge=0)
    cached_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(ge=0)
    cost_micros: int = Field(ge=0, description="Millionths of a US dollar")


# Helpers


def network_of(address: str) -> str:
    """The network an address belongs to: the address itself for IPv4, its /64 for IPv6 (one
    home or phone usually holds a whole /64)."""
    try:
        ip = ipaddress.ip_address(address.strip())
    except ValueError:
        return "unknown"
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped:
            return str(ip.ipv4_mapped)
        return str(ipaddress.IPv6Network((ip, 64), strict=False))
    return str(ip)


def network_hash(address: str, settings: Settings) -> str:
    """A keyed hash of the network, so the database never holds an address and the hash cannot
    be reversed by trying every address without the key."""
    digest = hmac.new(settings.chat_key.encode(), network_of(address).encode(), hashlib.sha256)
    return digest.hexdigest()[:32]


def _paid_user(request: Request, accounts: Accounts, tokens: Tokens) -> str | None:
    """The account behind the sign in token, if any. A token that fails the check counts as no
    account: the chat goes on with free questions rather than stopping. No account is made here."""
    token = bearer_token(request.headers.get("authorization"))
    if token is None or tokens is None:
        return None
    try:
        caller = tokens.check(token)
    except (BadToken, KeysUnavailable):
        return None
    if caller.kind != "google":  # only a Google account can hold paid reports
        return None
    user = accounts.find_user(caller.id, caller.kind)
    return user.id if user else None


def _who(asker: Asker, user_id: str | None, settings: Settings) -> Who:
    return Who(
        browser=asker.browser, network=network_hash(asker.address, settings), user_id=user_id
    )


def _status(settings: Settings, found: Summary) -> ChatStatus:
    verdict = found.verdict
    paid = None
    if found.paid_questions_total is not None:
        paid = PaidOut(
            questions_left=found.paid_questions_left or 0,
            questions_total=found.paid_questions_total,
            used_share=found.paid_used_share or 0.0,
        )
    return ChatStatus(
        mode=found.mode,
        max_length=settings.chat_max_length,
        free=FreeOut(limit=found.free_limit, left=found.free_left, resets_at=found.free_resets),
        paid=paid,
        blocked=(Blocked(reason=verdict.reason, until=verdict.until) if verdict.reason else None),
    )


def _look(chats: ChatStore, who: Who, paid_reports: int, settings: Settings) -> ChatStatus:
    counts = chats.counts(who, day_start(settings, chats.clock()), micros(settings.chat_answer_usd))
    return _status(settings, summary(settings, paid_reports, counts))


def _paid_reports(orders: OrderStore, user_id: str | None) -> int:
    return orders.paid_count(user_id) if user_id else 0


# Endpoints


@router.post("/status", response_model=ChatStatus)
def chat_status(
    body: Asker,
    request: Request,
    response: Response,
    accounts: Accounts,
    tokens: Tokens,
    orders: Orders,
    chats: Chats,
    settings: SettingsDep,
) -> ChatStatus:
    """What is left for this browser and account, in questions."""
    response.headers.update(PRIVATE)
    user_id = _paid_user(request, accounts, tokens)
    return _look(chats, _who(body, user_id, settings), _paid_reports(orders, user_id), settings)


@router.post(
    "/turns",
    response_model=TurnOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        413: {"model": ChatRefusal, "description": "The message is too long (too_long)"},
        429: {"model": ChatRefusal, "description": "A limit says no: the reason and until when"},
    },
)
def ask(
    body: Ask,
    request: Request,
    response: Response,
    accounts: Accounts,
    tokens: Tokens,
    orders: Orders,
    chats: Chats,
    settings: SettingsDep,
) -> TurnOut | JSONResponse:
    """Allows one question, free or paid, and records it; or says which limit stops it."""
    response.headers.update(PRIVATE)
    user_id = _paid_user(request, accounts, tokens)
    who = _who(body, user_id, settings)
    paid_reports = _paid_reports(orders, user_id)
    if body.length > settings.chat_max_length:
        refusal = ChatRefusal(
            reason="too_long", until=None, status=_look(chats, who, paid_reports, settings)
        )
        return JSONResponse(refusal.model_dump(mode="json"), 413, headers=PRIVATE)

    def choose(counts: Counts) -> tuple[Kind | None, Verdict]:
        verdict = decide(settings, paid_reports, counts)
        return verdict.kind, verdict

    now = chats.clock()
    turn, _, verdict = chats.begin(
        who, day_start(settings, now), micros(settings.chat_answer_usd), choose
    )
    after = _look(chats, who, paid_reports, settings)
    if turn is None or verdict.kind is None or verdict.reason is not None:
        refusal = ChatRefusal(
            reason=verdict.reason or "free_used", until=verdict.until, status=after
        )
        return JSONResponse(refusal.model_dump(mode="json"), 429, headers=PRIVATE)
    return TurnOut(turn=turn, kind=verdict.kind, status=after)


@router.post(
    "/turns/{turn_id}/start",
    response_model=StartOut,
    responses={409: {"description": "Unknown, already taken up, or too old"}},
)
def start(turn_id: uuid.UUID, body: StartIn, chats: Chats, settings: SettingsDep) -> StartOut:
    """The AI service takes up a question this backend allowed: once for the answer, once for
    its follow-up buttons."""
    kind = chats.start(str(turn_id), body.purpose)
    if kind is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "no such question to answer")
    return StartOut(kind=kind, max_length=settings.chat_max_length)


@router.post(
    "/turns/{turn_id}/usage",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"description": "No question taken up with this id"}},
)
def usage(turn_id: uuid.UUID, body: UsageIn, chats: Chats) -> None:
    """What one run (an answer, or its follow-up buttons) cost, as the AI provider reported."""
    recorded = chats.record(
        str(turn_id),
        Usage(
            input_tokens=body.input_tokens,
            cached_tokens=body.cached_tokens,
            output_tokens=body.output_tokens,
            cost_micros=body.cost_micros,
        ),
    )
    if not recorded:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no such question")
