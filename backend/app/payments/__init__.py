"""Payment providers (docs/15, docs/23).

A provider takes the money and then tells this server, in a signed notice, what became of it.
Only such a notice unlocks a report (app/store/orders.py, `settle`): never the buyer's browser,
and never a page the buyer comes back to.

No real provider is connected yet. `mock` stands in for one. To connect a real one: add its
module with a `verify` that turns its signed call into a `Notice`, an endpoint for that call,
and its name to `Settings.payment_provider`. The rest of the flow stays as it is.
"""

from dataclasses import dataclass

from app.store.orders import Outcome


class BadNotice(Exception):
    """The notice is not from the provider, or makes no sense. Nothing may change."""


@dataclass(frozen=True)
class Notice:
    """What a provider says about one payment, once its signature has been checked."""

    payment_id: str
    outcome: Outcome
    amount: int  # cents
    currency: str
    reference: str  # the provider's own number for it
