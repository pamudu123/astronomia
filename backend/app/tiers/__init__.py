"""Decides what a user is entitled to (docs/18, section 6).

Free shows the facts and a one line reason; a paid report adds depth. Only single reports are
sold, so "paid" is always about one report: an account has paid for a report when it holds a
paid order for that report's kind and request hash (app/store/orders.py).

The paid features are switched on by ASTRONOMIA_PAID_REPORTS. While it is off (the default,
until Google sign in is live), everyone gets every feature, as before. The website's canUse()
(frontend/lib/entitlements.ts) and the AI route (frontend/app/api/explain) read the features
from here, so nothing paid can be reached by calling the API directly.
"""

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from app.tiers.prices import ReportKind

if TYPE_CHECKING:  # app.store.orders imports the price list from this package
    from app.store.accounts import User
    from app.store.orders import OrderStore

Feature = Literal["ai_reading", "ai_explain", "full_detail", "full_pdf"]

# What a paid report adds: the AI reading in chapters, the explain buttons, the full detail
# (every Kuja dosha cancellation rule) and the PDF with all of it.
PAID_FEATURES: tuple[Feature, ...] = ("ai_reading", "ai_explain", "full_detail", "full_pdf")
# There is no checkout yet (no payment provider accepts astrology, docs/15): only coupons that
# take 100% off can unlock a report. Discount coupons show their price but cannot be used.
CHECKOUT_AVAILABLE = False


@dataclass(frozen=True)
class ReportAccess:
    paid: bool
    order_id: str | None
    features: tuple[Feature, ...]

    def allows(self, feature: Feature) -> bool:
        return feature in self.features


def report_access(
    orders: "OrderStore",
    user: "User | None",
    kind: ReportKind,
    report_hash: str,
    paid_reports_on: bool,
) -> ReportAccess:
    """Whether this account has paid for this report, and what it may use on it."""
    order = orders.paid_order(user.id, kind, report_hash) if user is not None else None
    paid = order is not None
    features = PAID_FEATURES if paid or not paid_reports_on else ()
    return ReportAccess(paid=paid, order_id=order.id if order else None, features=features)


def save_access() -> None:
    """Who may save a result to My reports. The one backend place for that check.

    Everyone may save: free results are kept on this browser, paid ones in the account
    (docs/18, section 3). Whether a saved report is paid comes from `report_access` and is
    recorded with it. Reports already saved stay readable either way, because only
    POST /v1/saved depends on this.
    """
