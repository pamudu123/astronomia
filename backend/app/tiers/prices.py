"""The price list (docs/18, section 4). Prices live here on the server, never in the website.

Only single reports are sold: each hadahan or porondam report on its own. Buyers in Sri Lanka
pay in rupees, everyone else in US dollars. Amounts are in the smallest unit of the currency
(cents), as payment providers count them, so no money is ever a float.
"""

from dataclasses import dataclass
from typing import Literal

ReportKind = Literal["hadahan", "porondam"]
Currency = Literal["LKR", "USD"]

REPORT_KINDS: tuple[ReportKind, ...] = ("hadahan", "porondam")
HOME_COUNTRY = "LK"


@dataclass(frozen=True)
class Price:
    amount: int  # cents
    currency: Currency


# One report, by where the buyer is: Sri Lanka, or anywhere else.
PRICES: dict[ReportKind, dict[Literal["home", "abroad"], Price]] = {
    "hadahan": {"home": Price(80_000, "LKR"), "abroad": Price(250, "USD")},
    "porondam": {"home": Price(80_000, "LKR"), "abroad": Price(250, "USD")},
}


def normalise_country(country: str | None) -> str | None:
    """A two letter country code in capitals, or None when there is none to go by."""
    code = (country or "").strip().upper()
    return code if len(code) == 2 and code.isalpha() and code != "XX" else None


def price_for(kind: ReportKind, country: str) -> Price:
    """The price of one report for a buyer in `country` (two letters, for example LK)."""
    return PRICES[kind]["home" if country == HOME_COUNTRY else "abroad"]


def discounted(price: Price, percent_off: int) -> Price:
    """The price after a coupon, rounded to the nearest cent. 100% off is 0."""
    if not 0 <= percent_off <= 100:
        raise ValueError("percent_off must be between 0 and 100")
    return Price((price.amount * (100 - percent_off) + 50) // 100, price.currency)
