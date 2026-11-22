"""PDF reports of a hadahan or a porondam match.

The report is worked out again on the server from the birth details in the request body, so
what prints always comes from the engine and never from numbers sent by the browser.

The one exception is the AI reading (docs/17): the chapters the person read on the page come
back with the request and print in their own section, labelled as an AI reading. They are
text the person already saw, not results.
"""

import datetime as dt

from fastapi import APIRouter, HTTPException, Response, status

from app.api.charts import build_hadahan
from app.api.deps import Orders, PlacesDb
from app.api.porondam import build_porondam
from app.api.report_requests import (
    NEEDS_CHOICE,
    HadahanPdf,
    HadahanReport,
    PdfRequest,
    PorondamPdf,
    PorondamReport,
    ReadingChapter,
    ReportRequest,
)
from app.api.saved import Current, SettingsDep, input_hash
from app.reports.render import render_hadahan, render_porondam
from app.tiers import report_access

# Kept importable from here, where they used to be defined.
__all__ = [
    "NEEDS_CHOICE",
    "HadahanPdf",
    "HadahanReport",
    "PdfRequest",
    "PorondamPdf",
    "PorondamReport",
    "ReadingChapter",
    "ReportRequest",
    "router",
]

router = APIRouter(tags=["reports"])


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
def report_pdf(
    body: PdfRequest, db: PlacesDb, session: Current, orders: Orders, settings: SettingsDep
) -> Response:
    """A print ready A4 report, in the language of the request (`lang`).

    The AI reading prints only in the full PDF of a paid report (docs/18, section 6); for any
    other report it is left out and the rest prints as before.
    """
    today = dt.datetime.now(dt.UTC).date()
    user = session.found.user if session.found else None
    report_hash = input_hash(body.model_dump(mode="json", exclude={"reading"}))
    access = report_access(orders, user, body.kind, report_hash, settings.paid_reports)
    reading = body.reading if access.allows("full_pdf") else []
    if isinstance(body, HadahanPdf):
        hadahan = build_hadahan(body.birth, db)
        if hadahan.response.status != "ok":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NEEDS_CHOICE)
        made_on = body.birth.as_of.date() if body.birth.as_of else today
        chapters = [(c.id, c.title, c.text) for c in reading]
        pdf = render_hadahan(hadahan, body.birth, body.name.strip(), made_on, chapters)
        return _pdf(pdf, "hadahan")

    match = build_porondam(body.match, db)
    if match.response.status != "ok":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NEEDS_CHOICE)
    chapters = [(c.id, c.title, c.text) for c in reading]
    return _pdf(render_porondam(match, body.match.lang, today, chapters), "porondam")
