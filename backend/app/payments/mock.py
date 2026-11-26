"""A stand-in payment provider, until a real one is connected. It takes no money.

The buyer chooses on a test page how the payment ends. This then behaves as a real provider
would: it signs a notice with a key only the server has, and the notice goes through the same
check and the same `settle` a real one will. It is off in production (Settings.checkout), and its
orders say `mock`, so they can be told from real sales and voided.
"""

import hashlib
import hmac
import json
import secrets

from app.payments import BadNotice, Notice
from app.store.orders import Outcome, Payment

NAME = "mock"


class MockProvider:
    def __init__(self, key: bytes | None = None) -> None:
        # Made anew each time the server starts. It never leaves the process.
        self._key = key or secrets.token_bytes(32)

    def _sign(self, body: bytes) -> str:
        return hmac.new(self._key, body, hashlib.sha256).hexdigest()

    def finish(self, payment: Payment, outcome: Outcome) -> tuple[bytes, str]:
        """The notice a provider would send once the buyer is done, and its signature."""
        body = json.dumps(
            {
                "payment_id": payment.id,
                "outcome": outcome,
                "amount": payment.amount,
                "currency": payment.price.currency,
                "reference": f"mock-{secrets.token_hex(8)}",
            }
        ).encode()
        return body, self._sign(body)

    def verify(self, body: bytes, signature: str) -> Notice:
        """The notice, if this provider signed it. Raises BadNotice."""
        if not hmac.compare_digest(self._sign(body), signature):
            raise BadNotice("wrong signature")
        try:
            found = json.loads(body)
            notice = Notice(
                payment_id=str(found["payment_id"]),
                outcome=found["outcome"],
                amount=int(found["amount"]),
                currency=str(found["currency"]),
                reference=str(found["reference"]),
            )
        except (ValueError, KeyError, TypeError) as error:
            raise BadNotice("not a notice") from error
        if notice.outcome not in ("paid", "failed", "cancelled"):
            raise BadNotice("unknown outcome")
        return notice
