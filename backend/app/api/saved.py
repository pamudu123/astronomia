"""My reports: results a visitor chose to save, and the account that holds them (docs/19).

Nobody fills in a sign up form. The first Save signs the browser in to Supabase anonymously, and
every account call then carries that user's access token (`Authorization: Bearer`), which is
checked here (app/auth.py). "Continue with Google" links Google to the same Supabase user, so
the id and every report stay. The backend keeps one `users` row per Supabase user.

Like share links, a saved report keeps the finished result in both languages, worked out again
on the server. It also keeps the request (the birth details as typed), because its owner opens
it again, downloads its PDF and shares it later. Each account sees only its own reports: any
other id is 404.
"""

import datetime as dt
import hashlib
import json
import logging
import threading
import time
import uuid
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field, TypeAdapter

from app.api.deps import Accounts, Admin, Chapters, Chats, Orders, PlacesDb, Tokens
from app.api.porondam import PorondamResponse
from app.api.report_requests import HadahanReport, PorondamReport, ReportRequest
from app.api.snapshots import (
    SnapshotHadahan,
    hadahan_snapshot,
    open_hadahan,
    open_porondam,
    porondam_snapshot,
)
from app.auth import BadToken, Caller, KeysUnavailable, TokenChecker, bearer_token
from app.config import Settings, get_settings
from app.explain.labels import Lang
from app.store.accounts import LimitReached, NewReport, SavedSummary, User
from app.tiers import report_access, save_access

router = APIRouter(tags=["saved"])
log = logging.getLogger(__name__)

PRIVATE = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"}
NOT_FOUND = "no such saved report"
# Not secret: tells the site's header to show "My reports" without waking the backend.
HINT_COOKIE = "sidera_saved"
HINT_DAYS = 365
_REQUEST = TypeAdapter[HadahanReport | PorondamReport](HadahanReport | PorondamReport)


# The hint cookie


def _set_hint(response: Response, settings: Settings, count: int) -> None:
    if count:
        response.set_cookie(
            HINT_COOKIE,
            "1",
            max_age=HINT_DAYS * 24 * 3600,
            path="/",
            secure=settings.secure_cookies,
            samesite="lax",
        )
    else:
        response.delete_cookie(HINT_COOKIE, path="/", secure=settings.secure_cookies)


# Dependencies


SettingsDep = Annotated[Settings, Depends(get_settings)]


@dataclass(frozen=True)
class SignedIn:
    user: User  # id: the Supabase user id; kind: "guest" or "google"
    caller: Caller  # what the access token said


@dataclass(frozen=True)
class CurrentSession:
    """Who is calling. `found` is None when the request carries no access token."""

    found: SignedIn | None


def _refused(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        detail,
        headers={**PRIVATE, "WWW-Authenticate": 'Bearer error="invalid_token"'},
    )


def check_token(token: str, checker: TokenChecker | None) -> Caller:
    """The caller a token names, or the right refusal."""
    if checker is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "sign in is not set up")
    try:
        return checker.check(token)
    except BadToken as error:
        raise _refused("sign in again") from error
    except KeysUnavailable as error:
        log.warning("supabase signing keys unavailable: %s", error)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "sign in is unavailable"
        ) from error


def same_site(request: Request, settings: SettingsDep) -> None:
    """Refuses a change sent from another site's page (cross site request forgery).

    Browsers send Origin with every POST, PATCH and DELETE. It must be one of the site's own
    addresses, or the address the request was sent to (through the frontend's forward, that is
    the forwarded host). Calls now carry an access token in a header, which another site's page
    cannot add, so this is a second lock rather than the only one.
    """
    origin = request.headers.get("origin")
    if origin is None or origin in settings.site_origins:
        return
    host = origin.split("://", 1)[-1]
    sent_to = {request.headers.get("x-forwarded-host"), request.headers.get("host")}
    if host not in sent_to:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "request from another site")


class RateLimit:
    """At most `limit` events per key in an hour. Kept in memory: one backend process."""

    def __init__(self, limit: int, clock: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit
        self.clock = clock
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = self.clock()
        with self._lock:
            events = self._events.setdefault(key, deque())
            while events and events[0] <= now - 3600:
                events.popleft()
            if len(events) >= self.limit:
                return False
            events.append(now)
            if len(self._events) > 10_000:  # forget quiet addresses
                self._events = {k: v for k, v in self._events.items() if v}
            return True


@lru_cache
def _guest_limit(limit: int) -> RateLimit:
    return RateLimit(limit)


def guest_limit(settings: SettingsDep) -> RateLimit:
    return _guest_limit(settings.guests_per_hour)


def _client_address(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",", 1)[0].strip()
    return first or (request.client.host if request.client else "unknown")


def current_session(
    request: Request,
    response: Response,
    accounts: Accounts,
    tokens: Tokens,
    limiter: Annotated[RateLimit, Depends(guest_limit)],
) -> CurrentSession:
    """The signed in user behind this request's access token, or nobody.

    No token: nobody (`found` is None). A token that fails the check: 401, so the page signs in
    again. A good token whose user has not called before gets its `users` row now; new guests
    are limited per address, on top of Supabase's own limit on anonymous sign ins.
    """
    response.headers.update(PRIVATE)
    token = bearer_token(request.headers.get("authorization"))
    if token is None:
        return CurrentSession(None)
    caller = check_token(token, tokens)
    user = accounts.find_user(caller.id, caller.kind)
    if user is None:
        if caller.kind == "guest" and not limiter.allow(_client_address(request)):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many new accounts")
        user = accounts.add_user(caller.id, caller.kind)
    return CurrentSession(SignedIn(user=user, caller=caller))


Current = Annotated[CurrentSession, Depends(current_session)]


def signed_in(session: Current) -> SignedIn:
    """The signed in user, or 401 for a request with no access token."""
    if session.found is None:
        raise _refused("sign in first")
    return session.found


# Shapes


class HadahanCard(BaseModel):
    name: str
    date: dt.date
    lagna: str
    rashi: str
    nakshatra: str


class PorondamCard(BaseModel):
    bride: str
    groom: str
    passed: int
    total: int
    mode: Literal["full", "quick"]


class SavedOut(BaseModel):
    id: uuid.UUID
    kind: Literal["hadahan", "porondam"]
    title: str  # empty: the page names it from the people in it
    created_at: dt.datetime
    paid: bool = False  # unlocked with an order (docs/18): kept in the account, with every feature
    # When a free report is deleted (7 days after saving). None for a paid report: it is kept.
    expires_at: dt.datetime | None = None
    hadahan: HadahanCard | None = None
    porondam: PorondamCard | None = None


class SavedCreated(SavedOut):
    created: bool  # False when this result was already saved


class SavedList(BaseModel):
    reports: list[SavedOut]
    free_limit: int  # how many free reports the account may keep at a time
    # Whether "Get the full report" is offered, so a free report can be kept for good.
    paid_reports: bool


class SavedDetail(SavedOut):
    request: Annotated[HadahanReport | PorondamReport, Field(discriminator="kind")]
    hadahan_result: SnapshotHadahan | None = None
    porondam_result: PorondamResponse | None = None


class Rename(BaseModel):
    title: str = Field(max_length=80)


class MeOut(BaseModel):
    kind: Literal["guest", "google"] | None  # None: no account on this browser
    saved: int


def _out(item: SavedSummary) -> SavedOut:
    out = SavedOut(
        id=uuid.UUID(item.id),
        kind="hadahan" if item.kind == "hadahan" else "porondam",
        title=item.title,
        created_at=item.created_at,
        paid=item.paid,
        expires_at=item.expires_at,
    )
    if item.kind == "hadahan":
        out.hadahan = HadahanCard.model_validate(item.summary)
    else:
        out.porondam = PorondamCard.model_validate(item.summary)
    return out


def input_hash(request: dict[str, Any]) -> str:
    """The same result saved again has the same hash. The language it was viewed in is left
    out: the report is kept in both."""

    def strip(value: Any) -> Any:
        if isinstance(value, dict):
            return {k: strip(v) for k, v in value.items() if k != "lang"}
        return value

    canonical = json.dumps(strip(request), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _new_report(body: HadahanReport | PorondamReport, db: Path) -> NewReport:
    request = body.model_dump(mode="json")
    if isinstance(body, HadahanReport):
        snapshot = hadahan_snapshot(body, db)
        en = snapshot["result"]["en"]
        chart = en["chart"]
        summary: dict[str, Any] = {
            "name": snapshot["name"],
            "date": snapshot["date"],
            "lagna": chart["lagna"]["sign"],
            "rashi": chart["moon"]["sign"],
            "nakshatra": chart["moon"]["nakshatra"],
        }
        rules = en["kuja"]["rule_set"]
    else:
        snapshot = porondam_snapshot(body, db)
        en = snapshot["result"]["en"]
        summary = {
            "bride": en["bride"]["name"],
            "groom": en["groom"]["name"],
            "passed": en["match"]["score"]["passed"],
            "total": en["match"]["score"]["total"],
            "mode": en["bride"]["mode"],
        }
        rules = en["match"]["rule_set"]
    return NewReport(
        kind=body.kind,
        input=request,
        input_hash=input_hash(request),
        snapshot=snapshot,
        summary=summary,
        rules=rules,
    )


# Endpoints


@router.get("/v1/me", response_model=MeOut)
def me(session: Current, accounts: Accounts) -> MeOut:
    """The signed in account, if any, and how many reports it keeps."""
    if session.found is None:
        return MeOut(kind=None, saved=0)
    user = session.found.user
    return MeOut(kind=user.kind, saved=accounts.count_saved(user.id))


@router.delete(
    "/v1/me",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(same_site)],
    responses={502: {"description": "Reports deleted; Supabase could not delete the sign in yet"}},
)
def delete_me(
    me: Annotated[SignedIn, Depends(signed_in)],
    accounts: Accounts,
    chats: Chats,
    chapters: Chapters,
    admin: Admin,
    settings: SettingsDep,
    response: Response,
) -> None:
    """Deletes the signed in account: every report it keeps with its AI chapters, and its
    chat usage, then its Supabase sign in.

    The page signs out of this browser afterwards. If Supabase cannot be reached, the reports
    are already gone and 502 asks the page to try again.
    """
    chats.forget_user(me.user.id)
    chapters.forget_user(me.user.id)
    accounts.delete_user(me.user.id)
    _set_hint(response, settings, 0)
    if admin is None:
        if settings.environment == "development":
            return  # a developer's own computer, without the secret key
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "account deletion is not set up")
    try:
        admin.delete_user(me.user.id)
    except OSError as error:  # urllib's errors are OSErrors
        log.warning("could not delete supabase user: %s", error)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "try again") from error


class GuestMerge(BaseModel):
    # The access token of the anonymous user this browser was signed in as before Google.
    guest_token: str = Field(min_length=1, max_length=8192)


class MergeOut(BaseModel):
    moved: int  # reports moved from the guest
    saved: int  # reports the account keeps now


@router.post(
    "/v1/me/merge-guest",
    response_model=MergeOut,
    dependencies=[Depends(same_site)],
)
def merge_guest(
    body: GuestMerge,
    me: Annotated[SignedIn, Depends(signed_in)],
    accounts: Accounts,
    tokens: Tokens,
    admin: Admin,
    settings: SettingsDep,
    response: Response,
) -> MergeOut:
    """Moves a guest's reports into the Google account that just signed in, then removes the guest.

    For a guest who presses "Continue with Google" with a Google account that already exists
    (from another phone): Supabase cannot link it, so the page signs in with Google and calls
    this with both tokens. Both are checked, so only the browser that holds the guest's sign in
    can move its reports.
    """
    if me.user.kind != "google":
        raise HTTPException(status.HTTP_409_CONFLICT, "sign in with Google first")
    # Not 401: that would say the Google sign in itself was refused.
    if tokens is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "sign in is not set up")
    try:
        guest = tokens.check(body.guest_token)
    except BadToken as error:
        raise HTTPException(status.HTTP_409_CONFLICT, "the guest sign in has expired") from error
    except KeysUnavailable as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "sign in is unavailable"
        ) from error
    if guest.kind != "guest":
        raise HTTPException(status.HTTP_409_CONFLICT, "that is not a guest")
    if guest.id == me.user.id:
        return MergeOut(moved=0, saved=accounts.count_saved(me.user.id))
    moved = accounts.move_reports(guest.id, me.user.id)
    if admin is not None:
        try:
            admin.delete_user(guest.id)
        except OSError as error:  # its reports have moved; the daily clean up removes it later
            log.warning("could not delete merged guest from supabase: %s", error)
    saved = accounts.count_saved(me.user.id)
    _set_hint(response, settings, saved)
    return MergeOut(moved=moved, saved=saved)


@router.post(
    "/v1/saved",
    response_model=SavedCreated,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(same_site), Depends(save_access)],
    responses={
        200: {"model": SavedCreated, "description": "Already saved"},
        409: {"description": "free_limit: free reports are full; paid_limit: the safety limit"},
    },
)
def save_report(
    body: ReportRequest,
    response: Response,
    me: Annotated[SignedIn, Depends(signed_in)],
    accounts: Accounts,
    db: PlacesDb,
    settings: SettingsDep,
    orders: Orders,
) -> SavedCreated:
    """Saves a hadahan or a match to My reports. The page signs in (anonymously) first.

    A free result is deleted 7 days after saving, and an account keeps at most
    `free_saved_limit` of them at a time. A report this account paid for is kept as paid, for
    as long as the account exists (docs/18, section 3).
    """
    report = _new_report(body, db)
    access = report_access(orders, me.user, body.kind, report.input_hash, settings.paid_reports)
    limit = settings.paid_saved_limit if access.paid else settings.free_saved_limit
    try:
        item, created = accounts.save(me.user.id, report, limit, access.order_id)
    except LimitReached as error:
        full = "paid_limit" if access.paid else "free_limit"
        raise HTTPException(status.HTTP_409_CONFLICT, full) from error
    _set_hint(response, settings, 1)
    if not created:
        response.status_code = status.HTTP_200_OK
    return SavedCreated(**_out(item).model_dump(), created=created)


@router.get("/v1/saved", response_model=SavedList)
def list_saved(
    session: Current, accounts: Accounts, settings: SettingsDep, response: Response
) -> SavedList:
    """Every report the signed in account keeps, newest first. Free reports past their 7 days
    are deleted, not listed."""
    items = [] if session.found is None else accounts.list_saved(session.found.user.id)
    _set_hint(response, settings, len(items))  # with nobody signed in, a stale hint goes
    return SavedList(
        reports=[_out(item) for item in items],
        free_limit=settings.free_saved_limit,
        paid_reports=settings.paid_reports,
    )


def _owned(session: CurrentSession) -> str:
    if session.found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND, headers=PRIVATE)
    return session.found.user.id


@router.get("/v1/saved/{report_id}", response_model=SavedDetail)
def open_saved(
    report_id: uuid.UUID,
    session: Current,
    accounts: Accounts,
    lang: Annotated[Lang, Query()] = "en",
) -> SavedDetail:
    """One saved report in one language, with the request it was made from."""
    found = accounts.get_saved(_owned(session), str(report_id))
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND, headers=PRIVATE)
    out = _out(
        SavedSummary(
            found.id,
            found.kind,
            found.title,
            found.summary,
            found.created_at,
            found.paid,
            found.expires_at,
        )
    )
    detail = SavedDetail(**out.model_dump(), request=_REQUEST.validate_python(found.input))
    if found.kind == "hadahan":
        detail.hadahan_result = open_hadahan(found.snapshot, lang)
    else:
        detail.porondam_result = open_porondam(found.snapshot, lang)
    return detail


@router.patch(
    "/v1/saved/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(same_site)],
)
def rename_saved(report_id: uuid.UUID, body: Rename, session: Current, accounts: Accounts) -> None:
    """Gives a saved report a name. An empty name goes back to the names in it."""
    if not accounts.rename(_owned(session), str(report_id), body.title.strip()):
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND, headers=PRIVATE)


@router.delete(
    "/v1/saved/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(same_site)],
)
def delete_saved(
    report_id: uuid.UUID,
    session: Current,
    accounts: Accounts,
    chapters: Chapters,
    settings: SettingsDep,
    response: Response,
) -> None:
    """Deletes one saved report, with the AI chapters a paid one keeps. The order stays, so the
    same report can be opened and read again."""
    user_id = _owned(session)
    order_id = accounts.order_of(user_id, str(report_id))
    if order_id is not None:
        chapters.forget_order(order_id, user_id)
    if not accounts.delete_saved(user_id, str(report_id)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND, headers=PRIVATE)
    _set_hint(response, settings, accounts.count_saved(user_id))
