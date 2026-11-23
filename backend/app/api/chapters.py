"""The AI chapters of a paid report, written once and kept with it (docs/17, section 6a).

- `POST /v1/reports/chapters`: the chapters this account's paid report keeps in one language.
  The page reads them when the report opens, so they are there on every device.
- `POST /v1/reports/chapters/keep`: keeps one chapter. Only the website's server may, with the
  key it shares with the backend (X-Chat-Key, as for the chat limits), right after the AI wrote
  it: a visitor cannot put words of their own into a report. The first text stays; asking again
  gives that one back.

A report nobody paid for keeps nothing: its chapters stay in the browser.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.api.chat import chat_key
from app.api.deps import Chapters, Orders
from app.api.report_requests import HadahanReport, PorondamReport
from app.api.saved import PRIVATE, Current, CurrentSession, input_hash
from app.store.orders import Order, OrderStore

router = APIRouter(tags=["paid"])


class ChaptersIn(BaseModel):
    report: Annotated[HadahanReport | PorondamReport, Field(discriminator="kind")]
    language: Literal["en", "si"]


class ChaptersOut(BaseModel):
    """Chapter texts by id. Empty when the report is not paid for or has none yet."""

    chapters: dict[str, str]


class KeepIn(ChaptersIn):
    id: str = Field(max_length=40, pattern=r"^(chart|match)\.[a-z]+$")
    text: str = Field(min_length=1, max_length=8000)


class KeptOut(BaseModel):
    text: str


def _order(orders: OrderStore, session: CurrentSession, body: ChaptersIn) -> Order | None:
    if session.found is None:
        return None
    report_hash = input_hash(body.report.model_dump(mode="json"))
    return orders.paid_order(session.found.user.id, body.report.kind, report_hash)


@router.post("/v1/reports/chapters", response_model=ChaptersOut)
def kept_chapters(
    body: ChaptersIn, session: Current, orders: Orders, chapters: Chapters, response: Response
) -> ChaptersOut:
    """A POST, so the birth details stay out of the address."""
    response.headers.update(PRIVATE)
    order = _order(orders, session, body)
    return ChaptersOut(chapters=chapters.kept(order.id, body.language) if order else {})


@router.post("/v1/reports/chapters/keep", response_model=KeptOut, dependencies=[Depends(chat_key)])
def keep_chapter(
    body: KeepIn, session: Current, orders: Orders, chapters: Chapters, response: Response
) -> KeptOut:
    response.headers.update(PRIVATE)
    order = _order(orders, session, body)
    if order is None or session.found is None:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "not a paid report")
    text = chapters.keep(order.id, session.found.user.id, body.language, body.id, body.text)
    return KeptOut(text=text)
