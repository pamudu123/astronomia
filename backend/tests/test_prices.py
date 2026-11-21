"""The price list (docs/18, section 4): LKR 800 in Sri Lanka, USD 2.50 everywhere else."""

import pytest

from app.tiers.prices import Price, ReportKind, discounted, normalise_country, price_for


@pytest.mark.parametrize("kind", ["hadahan", "porondam"])
def test_one_report_costs_800_rupees_at_home_and_250_cents_abroad(kind: ReportKind) -> None:
    assert price_for(kind, "LK") == Price(80_000, "LKR")
    assert price_for(kind, "GB") == Price(250, "USD")
    assert price_for(kind, "IN") == Price(250, "USD")


def test_a_coupon_takes_a_percentage_off_rounded_to_the_cent() -> None:
    assert discounted(Price(80_000, "LKR"), 20) == Price(64_000, "LKR")
    assert discounted(Price(250, "USD"), 20) == Price(200, "USD")
    assert discounted(Price(250, "USD"), 33) == Price(168, "USD")  # 167.5 rounds up
    assert discounted(Price(250, "USD"), 100) == Price(0, "USD")
    assert discounted(Price(250, "USD"), 0) == Price(250, "USD")
    with pytest.raises(ValueError):
        discounted(Price(250, "USD"), 101)


def test_countries_are_two_letters_or_nothing() -> None:
    assert normalise_country(" lk ") == "LK"
    assert normalise_country("XX") is None  # Vercel's "unknown"
    assert normalise_country("") is None
    assert normalise_country(None) is None
    assert normalise_country("LKA") is None
