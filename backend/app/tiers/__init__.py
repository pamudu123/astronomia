"""Decides what a user is entitled to and trims results to the free level."""


def save_access() -> None:
    """Who may save a result to My reports. The one backend place for that check.

    Everyone may save for now. Once payments exist, only paid reports can be saved: this then
    looks at the account and the purchase and raises 402 for a result that was not bought
    (docs/16, phase C). Reports already saved stay readable either way, because only
    POST /v1/saved depends on this.
    """
