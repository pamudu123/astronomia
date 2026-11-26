"""Paid reports: the price, coupons and unlocking one report (docs/18, sections 4 and 6).

Only single reports are sold, at LKR 800 in Sri Lanka and USD 2.50 elsewhere (app/tiers/prices).
A coupon that leaves nothing to pay unlocks a report at once, here. Anything left to pay goes
through a payment (app/api/checkout.py), and nothing unlocks until it is paid.

Nobody has to sign in: buying on a browser with no account makes a guest, as the first Save does,
and the report belongs to that guest. "Continue with Google" afterwards turns the guest into a
Google account, or moves its reports and orders into one (app/api/saved.py). A coupon can be
tried with no account at all. Wrong codes are limited per account and per network address, so
codes cannot be guessed one after another, nor by making one guest after another.

A report is named by its kind and the hash of its request, the same hash My reports keeps
(app/api/saved.py), so a report bought here is the same report when it is saved or opened.
"""

from functools import lru_cache
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field

from app.api.chat import network_of
from app.api.deps import Accounts, Orders, PlacesDb
from app.api.report_requests import HadahanReport, PorondamReport, ReportRequest
from app.api.saved import (
    Current,
    CurrentSession,
    RateLimit,
    SavedOut,
    SettingsDep,
    _client_address,
    _new_report,
    _out,
    _set_hint,
    input_hash,
    same_site,
)
from app.config import Settings
from app.store.accounts import LimitReached, User
from app.store.orders import CouponRefused, Order, OrderStore, PaymentNeeded, Refusal
from app.tiers import Feature, report_access
from app.tiers.prices import (
    Currency,
    Price,
    ReportKind,
    discounted,
    normalise_country,
    price_for,
)

router = APIRouter(tags=["paid"])

# Vercel puts the visitor's country in this header on every request it forwards.
COUNTRY_HEADER = "x-vercel-ip-country"
SIGN_IN = "sign in first"
TOO_MANY = "too many wrong codes: try again in an hour"
PAYMENT_NOT_AVAILABLE = "payment_not_available"
PAYMENT_NEEDED = "payment_needed"


def buyer_country(request: Request, settings: SettingsDep) -> str:
    """Where the buyer is, for the price: Vercel's country, or the site's default."""
    found = normalise_country(request.headers.get(COUNTRY_HEADER))
    return found or normalise_country(settings.default_country) or "LK"


Country = Annotated[str, Depends(buyer_country)]


@lru_cache
def _miss_limit(limit: int) -> RateLimit:
    return RateLimit(limit)


def miss_limit(settings: SettingsDep) -> RateLimit:
    """Wrong codes per network address."""
    return _miss_limit(settings.coupon_misses_per_hour_address)


def buyer_network(request: Request) -> str:
    return network_of(_client_address(request))


class CouponGuard:
    """Stops codes being guessed. Counts wrong codes for the account, when there is one, and for
    the network address."""

    def __init__(
        self,
        request: Request,
        session: Current,
        orders: Orders,
        settings: SettingsDep,
        limiter: Annotated[RateLimit, Depends(miss_limit)],
    ) -> None:
        self._user = session.found.user if session.found else None
        self._orders = orders
        self._settings = settings
        self._limiter = limiter
        self._network = buyer_network(request)

    def check(self) -> None:
        """429 once there were too many wrong codes, even for the right code."""
        account = self._user is not None and (
            self._orders.misses_last_hour(self._user.id) >= self._settings.coupon_misses_per_hour
        )
        if account or self._limiter.full(self._network):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY)

    def refused(self, reason: Refusal) -> None:
        if reason != "unknown":
            return
        self._limiter.allow(self._network)
        if self._user is not None:
            self._orders.record_miss(self._user.id)


Guard = Annotated[CouponGuard, Depends()]


# Shapes


class PriceOut(BaseModel):
    amount: int = Field(description="In the smallest unit of the currency: cents")
    currency: Currency


class ReportPrice(BaseModel):
    kind: ReportKind
    country: str
    price: PriceOut
    # Off: paid features are switched off on the server and everyone has every feature.
    paid_reports: bool


class AccessOut(BaseModel):
    """What the person may use on one report, and what it costs to unlock."""

    paid: bool
    features: list[Feature]
    # Off while paid features are switched off on the server: then everyone has every feature.
    paid_reports: bool
    # None: no account on this browser. Buying one makes a guest.
    account: Literal["guest", "google"] | None
    price: PriceOut
    # How the price is paid. None: it cannot be paid yet, so only a free code unlocks the report.
    # mock: a stand-in that takes no money (app/payments/mock.py).
    checkout: Literal["mock"] | None


class ApplyCoupon(BaseModel):
    kind: ReportKind
    code: str = Field(max_length=100)


class CouponQuote(BaseModel):
    """The price after a coupon, or why the coupon does not work.

    - free: nothing left to pay, the report can be unlocked now
    - discount: something is left to pay
    - payment_not_available: something is left to pay, and there is no way to pay it yet
    - unknown: no such code (counts as a wrong guess)
    - ended: switched off or past its end date
    - wrong_report: not for this kind of report
    - used_up: no uses left in total
    - account_limit: this account has used it as many times as it may
    """

    result: Literal["free", "discount", "payment_not_available"] | Refusal
    percent_off: int | None = None
    price: PriceOut
    discount: PriceOut | None = None  # what the coupon takes off
    new_price: PriceOut | None = None  # what is left to pay


class Unlock(BaseModel):
    report: Annotated[HadahanReport | PorondamReport, Field(discriminator="kind")]
    code: str = Field(max_length=100)


class OrderOut(BaseModel):
    id: str
    kind: ReportKind
    price: PriceOut
    percent_off: int
    amount_paid: PriceOut
    method: Literal["coupon", "payment"]


class Unlocked(BaseModel):
    order: OrderOut
    saved: SavedOut | None  # None when My reports was full: the report is paid all the same
    access: AccessOut


def _price(price: Price) -> PriceOut:
    return PriceOut(amount=price.amount, currency=price.currency)


def _order(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        kind=order.report_kind,
        price=_price(order.price),
        percent_off=order.percent_off,
        amount_paid=PriceOut(amount=order.amount_paid, currency=order.price.currency),
        method=order.method,
    )


def buyer(session: CurrentSession) -> User:
    """The account that buys: a guest or a Google account."""
    if session.found is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, SIGN_IN)
    return session.found.user


def _access(
    orders: OrderStore,
    session: CurrentSession,
    kind: ReportKind,
    report_hash: str,
    country: str,
    settings: Settings,
) -> AccessOut:
    user = session.found.user if session.found else None
    access = report_access(orders, user, kind, report_hash, settings.paid_reports)
    return AccessOut(
        paid=access.paid,
        features=list(access.features),
        paid_reports=settings.paid_reports,
        account=user.kind if user else None,
        price=_price(price_for(kind, country)),
        checkout=settings.checkout,
    )


# Endpoints


@router.get("/v1/price", response_model=ReportPrice)
def report_price(
    kind: Annotated[ReportKind, Query()], country: Country, settings: SettingsDep
) -> ReportPrice:
    """The price of one report for this buyer: LKR in Sri Lanka, USD everywhere else."""
    return ReportPrice(
        kind=kind,
        country=country,
        price=_price(price_for(kind, country)),
        paid_reports=settings.paid_reports,
    )


@router.post("/v1/reports/access", response_model=AccessOut)
def access(
    body: ReportRequest,
    session: Current,
    orders: Orders,
    country: Country,
    settings: SettingsDep,
) -> AccessOut:
    """Whether this browser's account has paid for this report, and what it may use on it.

    A POST, so the birth details stay out of the address."""
    report_hash = input_hash(body.model_dump(mode="json"))
    return _access(orders, session, body.kind, report_hash, country, settings)


@router.post("/v1/coupons/apply", response_model=CouponQuote, dependencies=[Depends(same_site)])
def apply_coupon(
    body: ApplyCoupon,
    session: Current,
    orders: Orders,
    guard: Guard,
    country: Country,
    settings: SettingsDep,
) -> CouponQuote:
    """The price of one report after a coupon. Uses nothing up: Unlock or a payment does that."""
    guard.check()
    user = session.found.user if session.found else None
    price = price_for(body.kind, country)
    try:
        coupon = orders.check_coupon(user.id if user else None, body.code, body.kind)
    except CouponRefused as refused:
        guard.refused(refused.reason)
        return CouponQuote(result=refused.reason, price=_price(price))
    final = discounted(price, coupon.percent_off)
    result: Literal["free", "discount", "payment_not_available"] = "free"
    if final.amount > 0:
        result = "discount" if settings.checkout else "payment_not_available"
    return CouponQuote(
        result=result,
        percent_off=coupon.percent_off,
        price=_price(price),
        discount=PriceOut(amount=price.amount - final.amount, currency=price.currency),
        new_price=_price(final),
    )


@router.post(
    "/v1/reports/unlock",
    response_model=Unlocked,
    dependencies=[Depends(same_site)],
    responses={
        401: {"description": "No account: the page makes a guest first"},
        402: {"description": "The coupon leaves something to pay: nothing is unlocked"},
        409: {"description": "The coupon was refused: the reason, as in CouponQuote"},
        429: {"description": "Too many wrong codes in the last hour"},
    },
)
def unlock(
    body: Unlock,
    response: Response,
    session: Current,
    accounts: Accounts,
    orders: Orders,
    guard: Guard,
    db: PlacesDb,
    country: Country,
    settings: SettingsDep,
) -> Unlocked:
    """Unlocks one report with a coupon that leaves nothing to pay, and keeps it in My reports
    as paid.

    A report already paid for gives back its order and uses nothing."""
    user = buyer(session)
    guard.check()
    report = _new_report(body.report, db)  # the request is checked before a coupon is used
    kind = body.report.kind
    try:
        order, _ = orders.redeem(
            user.id, body.code, kind, report.input_hash, price_for(kind, country)
        )
    except CouponRefused as refused:
        guard.refused(refused.reason)
        raise HTTPException(status.HTTP_409_CONFLICT, refused.reason) from refused
    except PaymentNeeded as needed:
        detail = PAYMENT_NEEDED if settings.checkout else PAYMENT_NOT_AVAILABLE
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, detail) from needed
    saved: SavedOut | None
    try:
        item, _ = accounts.save(user.id, report, settings.paid_saved_limit, order.id)
        saved = _out(item)
        _set_hint(response, settings, 1)  # the "My reports" hint in the header
    except LimitReached:
        saved = None
    return Unlocked(
        order=_order(order),
        saved=saved,
        access=_access(orders, session, kind, report.input_hash, country, settings),
    )
