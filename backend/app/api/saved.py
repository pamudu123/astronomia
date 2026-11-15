"""My reports: results a visitor chose to save, and the quiet guest account that holds them.

Nobody signs up. The first Save makes a guest account: a random session code in an HttpOnly
cookie, tied to this browser. Every later call finds the account through that cookie. Google
sign in (docs/15, phase B) will turn a guest into a Google account and keep its reports.

Like share links, a saved report keeps the finished result in both languages, worked out again
on the server. It also keeps the request (the birth details as typed), because its owner opens
it again, downloads its PDF and shares it later. Each account sees only its own reports: any
other id is 404.
"""

import datetime as dt
import hashlib
import json
import threading
import time
import uuid
from collections import deque
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field, TypeAdapter

from app.api.deps import Accounts, PlacesDb
from app.api.porondam import PorondamResponse
from app.api.reports import HadahanReport, PorondamReport, ReportRequest
from app.api.snapshots import (
    SnapshotHadahan,
    hadahan_snapshot,
    open_hadahan,
    open_porondam,
    porondam_snapshot,
)
from app.config import Settings, get_settings
from app.explain.labels import Lang
from app.store.accounts import FoundSession, LimitReached, NewReport, SavedSummary
from app.tiers import save_access

router = APIRouter(tags=["saved"])

PRIVATE = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"}
NOT_FOUND = "no such saved report"
# Not secret: tells the site's header to show "My reports" without waking the backend.
HINT_COOKIE = "sidera_saved"
_REQUEST = TypeAdapter[HadahanReport | PorondamReport](HadahanReport | PorondamReport)


# Cookies


def session_cookie(settings: Settings) -> str:
    # The __Host- prefix makes the browser refuse the cookie unless it is https only, for the
    # whole site and for this host alone.
    return "__Host-sid" if settings.secure_cookies else "sid"


def _set_session(response: Response, settings: Settings, expires: dt.datetime, token: str) -> None:
    response.set_cookie(
        session_cookie(settings),
        token,
        expires=expires,
        path="/",
        secure=settings.secure_cookies,
        httponly=True,
        samesite="lax",
    )


def _set_hint(response: Response, settings: Settings, count: int, expires: dt.datetime) -> None:
    if count:
        response.set_cookie(
            HINT_COOKIE,
            "1",
            expires=expires,
            path="/",
            secure=settings.secure_cookies,
            samesite="lax",
        )
    else:
        response.delete_cookie(HINT_COOKIE, path="/", secure=settings.secure_cookies)


def _clear_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        session_cookie(settings), path="/", secure=settings.secure_cookies, httponly=True
    )
    response.delete_cookie(HINT_COOKIE, path="/", secure=settings.secure_cookies)


# Dependencies


SettingsDep = Annotated[Settings, Depends(get_settings)]


class SessionCookie:
    """The session behind this request's cookie, or None. Renews it once a day."""

    def __init__(self, token: str | None, found: FoundSession | None) -> None:
        self.token = token
        self.found = found


def current_session(
    request: Request, response: Response, accounts: Accounts, settings: SettingsDep
) -> SessionCookie:
    response.headers.update(PRIVATE)
    token = request.cookies.get(session_cookie(settings))
    if not token or len(token) > 128:
        return SessionCookie(None, None)
    found = accounts.find_session(token)
    if found is None:
        _clear_cookies(response, settings)  # expired or deleted: forget it
        return SessionCookie(None, None)
    if found.renewed:
        _set_session(response, settings, found.expires_at, token)
    return SessionCookie(token, found)


Current = Annotated[SessionCookie, Depends(current_session)]


def same_site(request: Request, settings: SettingsDep) -> None:
    """Refuses a change sent from another site's page (cross site request forgery).

    Browsers send Origin with every POST, PATCH and DELETE. It must be one of the site's own
    addresses, or the address the request was sent to (through the frontend's forward, that is
    the forwarded host). A request without Origin is not from a browser page, so it cannot carry
    a visitor's cookie by trickery.
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
    hadahan: HadahanCard | None = None
    porondam: PorondamCard | None = None


class SavedCreated(SavedOut):
    created: bool  # False when this result was already saved


class SavedList(BaseModel):
    reports: list[SavedOut]


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
    )
    if item.kind == "hadahan":
        out.hadahan = HadahanCard.model_validate(item.summary)
    else:
        out.porondam = PorondamCard.model_validate(item.summary)
    return out


def _input_hash(request: dict[str, Any]) -> str:
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
        input_hash=_input_hash(request),
        snapshot=snapshot,
        summary=summary,
        rules=rules,
    )


# Endpoints


@router.get("/v1/me", response_model=MeOut)
def me(session: Current, accounts: Accounts) -> MeOut:
    """The account on this browser, if any, and how many reports it keeps."""
    if session.found is None:
        return MeOut(kind=None, saved=0)
    user = session.found.user
    return MeOut(kind=user.kind, saved=accounts.count_saved(user.id))


@router.delete("/v1/me", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(same_site)])
def delete_me(
    session: Current, accounts: Accounts, settings: SettingsDep, response: Response
) -> None:
    """Deletes the account on this browser and every report it keeps."""
    if session.found is not None:
        accounts.delete_user(session.found.user.id)
    _clear_cookies(response, settings)


@router.post(
    "/v1/saved",
    response_model=SavedCreated,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(same_site), Depends(save_access)],
    responses={200: {"model": SavedCreated, "description": "Already saved"}},
)
def save_report(
    body: ReportRequest,
    request: Request,
    response: Response,
    session: Current,
    accounts: Accounts,
    db: PlacesDb,
    settings: SettingsDep,
    limiter: Annotated[RateLimit, Depends(guest_limit)],
) -> SavedCreated:
    """Saves a hadahan or a match to My reports. Makes a guest account if there is none."""
    report = _new_report(body, db)  # first, so a refused request makes no account
    if session.found is not None:
        user_id, expires = session.found.user.id, session.found.expires_at
    else:
        if not limiter.allow(_client_address(request)):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many new accounts")
        new = accounts.create_guest()
        user_id, expires = new.user.id, new.expires_at
        _set_session(response, settings, expires, new.token)
    try:
        item, created = accounts.save(user_id, report, settings.guest_saved_limit)
    except LimitReached as error:
        raise HTTPException(status.HTTP_409_CONFLICT, "saved report limit reached") from error
    _set_hint(response, settings, 1, expires)
    if not created:
        response.status_code = status.HTTP_200_OK
    return SavedCreated(**_out(item).model_dump(), created=created)


@router.get("/v1/saved", response_model=SavedList)
def list_saved(
    session: Current, accounts: Accounts, settings: SettingsDep, response: Response
) -> SavedList:
    """Every report this browser's account keeps, newest first."""
    if session.found is None:
        _set_hint(response, settings, 0, dt.datetime.now(dt.UTC))  # a stale hint goes
        return SavedList(reports=[])
    items = accounts.list_saved(session.found.user.id)
    _set_hint(response, settings, len(items), session.found.expires_at)
    return SavedList(reports=[_out(item) for item in items])


def _owned(session: SessionCookie) -> str:
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
    out = _out(SavedSummary(found.id, found.kind, found.title, found.summary, found.created_at))
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
    settings: SettingsDep,
    response: Response,
) -> None:
    """Deletes one saved report."""
    user_id = _owned(session)
    if not accounts.delete_saved(user_id, str(report_id)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND, headers=PRIVATE)
    expires = session.found.expires_at if session.found else dt.datetime.now(dt.UTC)
    _set_hint(response, settings, accounts.count_saved(user_id), expires)
