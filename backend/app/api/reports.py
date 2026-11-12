"""PDF reports of a hadahan or a porondam match.

The report is worked out again on the server from the birth details in the request body, so
what prints always comes from the engine and never from numbers sent by the browser.
"""

import datetime as dt
from typing import Annotated, Literal

from fastapi import APIRouter, Body, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.api.charts import HadahanRequest, build_hadahan
from app.api.deps import PlacesDb
from app.api.porondam import PorondamRequest, build_porondam
from app.reports.render import render_hadahan, render_porondam

router = APIRouter(tags=["reports"])

NEEDS_CHOICE = "the birth time happened twice or not at all on that date: choose one first"


class HadahanReport(BaseModel):
    kind: Literal["hadahan"]
    name: str = Field(default="", max_length=60)
    birth: HadahanRequest


class PorondamReport(BaseModel):
    kind: Literal["porondam"]
    match: PorondamRequest


ReportRequest = Annotated[HadahanReport | PorondamReport, Body(discriminator="kind")]


def _pdf(content: bytes, kind: str) -> Response:
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="astronomia-{kind}.pdf"',
            "Cache-Control": "no-store",
        },
    )


@router.post(
    "/v1/reports/pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}, "description": "The report"}},
)
def report_pdf(body: ReportRequest, db: PlacesDb) -> Response:
    """A print ready A4 report, in the language of the request (`lang`)."""
    today = dt.datetime.now(dt.UTC).date()
    if isinstance(body, HadahanReport):
        hadahan = build_hadahan(body.birth, db)
        if hadahan.response.status != "ok":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NEEDS_CHOICE)
        made_on = body.birth.as_of.date() if body.birth.as_of else today
        return _pdf(render_hadahan(hadahan, body.birth, body.name.strip(), made_on), "hadahan")

    match = build_porondam(body.match, db)
    if match.response.status != "ok":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NEEDS_CHOICE)
    return _pdf(render_porondam(match, body.match.lang, today), "porondam")
