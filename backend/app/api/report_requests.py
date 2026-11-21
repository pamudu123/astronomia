"""What a PDF report, a saved report and a share link are made from: the plain requests.

Kept apart from the endpoints so app/api/reports.py can use the account (app/api/saved.py)
while saved.py and the snapshots use these requests.
"""

from typing import Annotated, Literal

from fastapi import Body
from pydantic import BaseModel, Field

from app.api.charts import HadahanRequest
from app.api.porondam import PorondamRequest

NEEDS_CHOICE = "the birth time happened twice or not at all on that date: choose one first"


class ReadingChapter(BaseModel):
    """One AI chapter as the person read it. Long enough for the longest chapter."""

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
