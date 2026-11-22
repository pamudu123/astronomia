"""PDF reports of a hadahan or a porondam match.

The report is worked out again on the server from the birth details in the request body, so
what prints always comes from the engine and never from numbers sent by the browser.

The one exception is the AI reading (docs/17): the chapters the person read on the page come
back with the request and print in their own section, labelled as an AI reading. They are
text the person already saw, not results.
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


class ReadingChapter(BaseModel):
    """One AI chapter as the person read it. Long enough for the longest chapter.

    The id (`chart.periods`) picks the chapter's picture and diagram; a chapter without one
    prints with a general picture.
    """

    id: str | None = Field(default=None, max_length=40, pattern=r"^[a-z]+\.[a-z]+$")
    title: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=8000)


# A full chart reading is 12 chapters, plus the 3 topic-only ones.
Reading = Annotated[list[ReadingChapter], Field(default_factory=list, max_length=16)]


class HadahanReport(BaseModel):
    kind: Literal["hadahan"]
    name: str = Field(default="", max_length=60)
    birth: HadahanRequest


class PorondamReport(BaseModel):
    kind: Literal["porondam"]
    match: PorondamRequest


ReportRequest = Annotated[HadahanReport | PorondamReport, Body(discriminator="kind")]


# The PDF alone also takes the AI reading. Saved reports and share links keep the plain
# requests above: they store results to work out again, never AI text.
class HadahanPdf(HadahanReport):
    reading: Reading


class PorondamPdf(PorondamReport):
    reading: Reading


PdfRequest = Annotated[HadahanPdf | PorondamPdf, Body(discriminator="kind")]


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
def report_pdf(body: PdfRequest, db: PlacesDb) -> Response:
    """A print ready A4 report, in the language of the request (`lang`)."""
    today = dt.datetime.now(dt.UTC).date()
    if isinstance(body, HadahanPdf):
        hadahan = build_hadahan(body.birth, db)
        if hadahan.response.status != "ok":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NEEDS_CHOICE)
        made_on = body.birth.as_of.date() if body.birth.as_of else today
        chapters = [(c.id, c.title, c.text) for c in body.reading]
        pdf = render_hadahan(hadahan, body.birth, body.name.strip(), made_on, chapters)
        return _pdf(pdf, "hadahan")

    match = build_porondam(body.match, db)
    if match.response.status != "ok":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NEEDS_CHOICE)
    chapters = [(c.id, c.title, c.text) for c in body.reading]
    return _pdf(render_porondam(match, body.match.lang, today, chapters), "porondam")
