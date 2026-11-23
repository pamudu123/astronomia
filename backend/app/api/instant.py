"""One rule for every field that names an instant ("now", "today") in a request.

An instant needs a UTC offset. Without one, "2026-11-17T00:00:00" is a different moment in every
time zone: the server's zone, the birth place's and the visitor's could each be meant. It is
refused with a clear 422 instead of being guessed. Any offset is accepted and kept as UTC, so two
ways of writing the same instant always give the same answer.
"""

import datetime as dt
from typing import Annotated

from pydantic import AfterValidator


def _utc(value: dt.datetime) -> dt.datetime:
    if value.utcoffset() is None:
        raise ValueError("give the time with its UTC offset, such as 2026-11-17T00:00:00Z")
    try:
        return value.astimezone(dt.UTC)
    except OverflowError as error:  # the first or last day a date can hold
        raise ValueError("date out of range") from error


Instant = Annotated[dt.datetime, AfterValidator(_utc)]
