"""Paying for what a coupon does not cover (docs/23).

- `POST /v1/checkout` starts a payment. The amount is worked out here, from the price list and the
  coupon, never taken from the page.
- `GET /v1/payments/{id}` is what the page asks while it waits for the result.
- `POST /v1/payments/{id}/mock` is the stand-in provider's test page (app/payments/mock.py). It
  takes no money, and is not there unless `Settings.checkout` is "mock".

A payment unlocks nothing until its provider's signed notice says it was paid: `_take` is the only
way there. A real provider's webhook will check its own signature and call the same `_take`.
"""

import uuid
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.api.deps import Orders, PlacesDb
from app.api.paid import (
    PAYMENT_NOT_AVAILABLE,
    Country,
    Guard,
    PriceOut,
    buyer,
    buyer_network,
)
from app.api.report_requests import HadahanReport, PorondamReport
from app.api.saved import Current, RateLimit, SettingsDep, _new_report, same_site
from app.payments import BadNotice, Notice
from app.payments import mock as mock_provider
from app.payments.mock import MockProvider
from app.store.orders import (
    AlreadyPaid,
    CouponRefused,
    NothingToPay,
    Outcome,
    Payment,
    PaymentStatus,
    WrongPayment,
)
from app.tiers.prices import ReportKind, price_for

router = APIRouter(tags=["paid"])

NO_PAYMENT = "no such payment"


@lru_cache
def mock_payments() -> MockProvider:
    return MockProvider()


@lru_cache
def _payment_limit(limit: int) -> RateLimit:
    return RateLimit(limit)


def payment_limit(settings: SettingsDep) -> RateLimit:
    return _payment_limit(settings.payments_per_hour)


class Checkout(BaseModel):
    report: Annotated[HadahanReport | PorondamReport, Field(discriminator="kind")]
    code: str | None = Field(default=None, max_length=100)


class PaymentOut(BaseModel):
    id: uuid.UUID
    kind: ReportKind
    status: PaymentStatus
    price: PriceOut  # before the coupon
    percent_off: int
    amount: PriceOut  # what is to be paid
    provider: Literal["mock"]


class MockResult(BaseModel):
    outcome: Outcome


def _out(payment: Payment) -> PaymentOut:
    currency = payment.price.currency
    return PaymentOut(
        id=uuid.UUID(payment.id),
        kind=payment.report_kind,
        status=payment.status,
        price=PriceOut(amount=payment.price.amount, currency=currency),
        percent_off=payment.percent_off,
        amount=PriceOut(amount=payment.amount, currency=currency),
        provider="mock",
    )


def _take(orders: Orders, provider: str, notice: Notice) -> Payment:
    """Acts on a notice whose signature was checked."""
    return orders.settle(
        provider,
        notice.payment_id,
        notice.outcome,
        notice.amount,
        notice.currency,
        notice.reference,
    )


@router.post(
    "/v1/checkout",
    response_model=PaymentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(same_site)],
    responses={
        401: {"description": "No account: the page makes a guest first"},
        402: {"description": "There is no way to pay yet (payment_not_available)"},
        409: {"description": "already_paid, nothing_to_pay, free_now, or why a coupon is refused"},
        429: {"description": "Too many wrong codes, or too many payments, in the last hour"},
    },
)
def start(
    body: Checkout,
    request: Request,
    session: Current,
    orders: Orders,
    guard: Guard,
    db: PlacesDb,
    country: Country,
    settings: SettingsDep,
    limiter: Annotated[RateLimit, Depends(payment_limit)],
) -> PaymentOut:
    """Starts a payment for one report. Nothing is unlocked by this."""
    user = buyer(session)
    if not settings.paid_reports:  # everyone has every feature: there is nothing to sell
        raise HTTPException(status.HTTP_409_CONFLICT, "free_now")
    if settings.checkout is None:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, PAYMENT_NOT_AVAILABLE)
    code = (body.code or "").strip() or None
    if code:
        guard.check()
    if not limiter.allow(buyer_network(request)):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many payments")
    report = _new_report(body.report, db)  # nobody pays for a report that cannot be made
    kind = body.report.kind
    try:
        payment = orders.start_payment(
            user.id, code, kind, report.input_hash, price_for(kind, country), settings.checkout
        )
    except AlreadyPaid as error:
        raise HTTPException(status.HTTP_409_CONFLICT, "already_paid") from error
    except NothingToPay as error:
        raise HTTPException(status.HTTP_409_CONFLICT, "nothing_to_pay") from error
    except CouponRefused as refused:
        guard.refused(refused.reason)
        raise HTTPException(status.HTTP_409_CONFLICT, refused.reason) from refused
    return _out(payment)


def _mine(orders: Orders, session: Current, payment_id: uuid.UUID) -> Payment:
    payment = None
    if session.found is not None:
        payment = orders.payment(session.found.user.id, str(payment_id))
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_PAYMENT)
    return payment


@router.get("/v1/payments/{payment_id}", response_model=PaymentOut)
def payment_status(payment_id: uuid.UUID, session: Current, orders: Orders) -> PaymentOut:
    """Where one of this account's payments stands."""
    return _out(_mine(orders, session, payment_id))


@router.post(
    "/v1/payments/{payment_id}/mock",
    response_model=PaymentOut,
    dependencies=[Depends(same_site)],
    responses={
        404: {"description": "No such payment, or the mock provider is off"},
        409: {"description": "The payment is over"},
    },
)
def finish_mock_payment(
    payment_id: uuid.UUID,
    body: MockResult,
    session: Current,
    orders: Orders,
    settings: SettingsDep,
    provider: Annotated[MockProvider, Depends(mock_payments)],
) -> PaymentOut:
    """The stand-in provider: ends a test payment as the buyer chose, and tells this server so
    with a signed notice, as a real provider would. No money is taken."""
    if settings.checkout != mock_provider.NAME:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_PAYMENT)
    payment = _mine(orders, session, payment_id)
    if payment.provider != mock_provider.NAME:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NO_PAYMENT)
    if payment.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "payment_over")
    try:
        notice = provider.verify(*provider.finish(payment, body.outcome))
        return _out(_take(orders, mock_provider.NAME, notice))
    except (BadNotice, WrongPayment) as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bad notice") from error
