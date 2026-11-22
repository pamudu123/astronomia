"""Share links: a snapshot of one result, created only when the visitor presses Share.

The server works the result out again from the birth details, then keeps the finished result
in both languages. The request itself (place id, coordinates, time zone) is not kept. Names and
birth details (date, time, place) are left out unless the visitor chooses to show them: what is
hidden is removed before the snapshot is stored, so it never reaches the store or the recipient.
"""

import datetime as dt
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Header, HTTPException, Path, Query, Response, status
from pydantic import BaseModel

from app.api.deps import PlacesDb, Shares
from app.api.porondam import PorondamResponse
from app.api.report_requests import HadahanReport, PorondamReport
from app.api.snapshots import (
    SharedHadahan,
    hadahan_snapshot,
    open_porondam,
    open_shared_hadahan,
    porondam_snapshot,
)
from app.config import get_settings
from app.explain.labels import Lang
from app.store.shares import DeleteRefused

router = APIRouter(tags=["shares"])

Code = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{16,64}$")]
# Shares must not be indexed, kept by a shared cache or CDN, or leak their code in a referrer.
PRIVATE = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
}
GONE = "this link has expired or was deleted"


# Names and birth details (date, time, place) stay hidden unless the visitor turns them on
# (legal review, docs/09-launch.md "Before going public").
class ShareHadahan(HadahanReport):
    show_names: bool = False
    show_birth: bool = False


class SharePorondam(PorondamReport):
    show_names: bool = False
    show_birth: bool = False


ShareRequest = Annotated[ShareHadahan | SharePorondam, Body(discriminator="kind")]


class ShareCreated(BaseModel):
    code: str
    delete_token: str  # keep it: only this deletes the link
    expires_at: dt.datetime


class ShareOut(BaseModel):
    kind: Literal["hadahan", "porondam"]
    created_at: dt.datetime
    expires_at: dt.datetime
    names_hidden: bool
    birth_hidden: bool
    hadahan: SharedHadahan | None = None
    porondam: PorondamResponse | None = None


@router.post("/v1/shares", status_code=status.HTTP_201_CREATED, response_model=ShareCreated)
def create_share(
    body: ShareRequest, db: PlacesDb, shares: Shares, response: Response
) -> ShareCreated:
    """Keep a snapshot of a hadahan or a match and return its link code."""
    response.headers.update(PRIVATE)
    hide_names, hide_birth = not body.show_names, not body.show_birth
    if isinstance(body, ShareHadahan):
        snapshot = hadahan_snapshot(body, db, hide_names, hide_birth)
    else:
        snapshot = porondam_snapshot(body, db, hide_names, hide_birth)
    snapshot["names_hidden"] = hide_names
    snapshot["birth_hidden"] = hide_birth
    created = shares.create(body.kind, snapshot, get_settings().share_days)
    return ShareCreated(
        code=created.code, delete_token=created.delete_token, expires_at=created.expires_at
    )


@router.get("/v1/shares/{code}", response_model=ShareOut)
def open_share(
    code: Code, shares: Shares, response: Response, lang: Annotated[Lang, Query()] = "en"
) -> ShareOut:
    """The shared result in one language. Unknown, expired and deleted links are all 404."""
    response.headers.update(PRIVATE)
    found = shares.get(code)
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, GONE, headers=PRIVATE)
    payload = found.payload
    out = ShareOut(
        kind="hadahan" if found.kind == "hadahan" else "porondam",
        created_at=found.created_at,
        expires_at=found.expires_at,
        names_hidden=bool(payload["names_hidden"]),
        # Links made before birth details could be hidden kept them.
        birth_hidden=bool(payload.get("birth_hidden", False)),
    )
    if found.kind == "hadahan":
        out.hadahan = open_shared_hadahan(payload, lang)
    else:
        out.porondam = open_porondam(payload, lang)
    return out


@router.delete("/v1/shares/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_share(
    code: Code,
    shares: Shares,
    delete_token: Annotated[str, Header(alias="X-Delete-Token", max_length=128)],
) -> Response:
    """Delete a link. Needs the delete token given when it was created, in a header."""
    try:
        deleted = shares.delete(code, delete_token)
    except DeleteRefused as error:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "wrong delete token", headers=PRIVATE
        ) from error
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, GONE, headers=PRIVATE)
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=PRIVATE)
