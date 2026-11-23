"""The Astro chat rules (docs/18, section 5; docs/21): who may ask, and what is left.

- **Free:** 2 questions a week per browser, the week starting at its first question.
- **Paid:** each paid report adds a chat allowance, about 20 questions' worth, measured by the
  real cost the AI provider reports. It is kept until used. While an account has allowance left
  its questions are paid ones and use no free questions; once it is used up, the free weekly
  questions are there as for anyone.
- **Cost controls:** a burst limit per browser or account, a quiet weekly limit per network for
  free questions, a ceiling on what the whole site's free questions may cost in a day (paid
  chat goes on), and a hard daily ceiling per account.

Everything here is a pure function of the counts (app/store/chat.py) and the settings, so the
tests can set any moment. Money is in millionths of a US dollar.
"""

import datetime as dt
import zoneinfo
from dataclasses import dataclass
from typing import Literal

from app.config import Settings
from app.store.chat import MINUTE, WEEK, Counts, Kind

Reason = Literal[
    "burst",  # too many messages in a minute
    "free_used",  # this week's free questions are used
    "paid_used",  # the reports' chat and this week's free questions are used
    "network",  # the quiet per-network weekly limit
    "busy",  # the site's free chat has reached today's spending ceiling
    "account_day",  # the account's hard daily ceiling
]
MICROS = 1_000_000


def micros(usd: float) -> int:
    return round(usd * MICROS)


@dataclass(frozen=True)
class Allowance:
    """The chat that came with an account's paid reports."""

    reports: int
    total: int  # money
    spent: int

    @property
    def left(self) -> int:
        return max(0, self.total - self.spent)


@dataclass(frozen=True)
class Verdict:
    kind: Kind | None  # the kind of question allowed, or None
    reason: Reason | None = None
    until: dt.datetime | None = None  # when the refusal ends, if it does


def allowance(settings: Settings, paid_reports: int, counts: Counts) -> Allowance:
    per_report = settings.chat_report_questions * micros(settings.chat_answer_usd)
    return Allowance(reports=paid_reports, total=paid_reports * per_report, spent=counts.paid_spent)


def day_start(settings: Settings, now: dt.datetime) -> dt.datetime:
    """The start of today on the site's calendar, in UTC."""
    local = now.astimezone(zoneinfo.ZoneInfo(settings.chat_time_zone))
    midnight = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight.astimezone(dt.UTC)


def next_day(settings: Settings, now: dt.datetime) -> dt.datetime:
    zone = zoneinfo.ZoneInfo(settings.chat_time_zone)
    local = now.astimezone(zone).date() + dt.timedelta(days=1)
    return dt.datetime.combine(local, dt.time(), tzinfo=zone).astimezone(dt.UTC)


def decide(settings: Settings, paid_reports: int, counts: Counts) -> Verdict:
    """Whether the next question may be asked, and as which kind."""
    now = counts.now
    if counts.burst >= settings.chat_burst_per_minute:
        oldest = counts.burst_oldest or now
        return Verdict(None, "burst", oldest + MINUTE)

    paid = allowance(settings, paid_reports, counts)
    if paid.left > 0:
        if counts.paid_spent_today >= micros(settings.chat_account_daily_usd):
            return Verdict(None, "account_day", next_day(settings, now))
        return Verdict("paid")

    if counts.free_in_week >= settings.chat_free_per_week:
        week_ends = counts.week_start + WEEK if counts.week_start else None
        return Verdict(None, "paid_used" if paid_reports else "free_used", week_ends)
    if counts.free_spent_today >= micros(settings.chat_free_daily_usd):
        return Verdict(None, "busy", next_day(settings, now))
    if counts.network_in_week >= settings.chat_network_per_week:
        oldest = counts.network_oldest or now
        return Verdict(None, "network", oldest + WEEK)
    return Verdict("free")


@dataclass(frozen=True)
class Summary:
    """What the chat shows: plain words, never tokens or money."""

    mode: Kind  # which kind the next question would be
    free_limit: int
    free_left: int
    free_resets: dt.datetime | None  # when this week's free questions come back
    # The reports' chat, in questions: None when the account has no paid report.
    paid_questions_left: int | None
    paid_questions_total: int | None
    paid_used_share: float | None  # 0 to 1, for the bar and the note at 80%
    verdict: Verdict


def summary(settings: Settings, paid_reports: int, counts: Counts) -> Summary:
    verdict = decide(settings, paid_reports, counts)
    paid = allowance(settings, paid_reports, counts)
    answer = micros(settings.chat_answer_usd)
    free_left = max(0, settings.chat_free_per_week - counts.free_in_week)
    return Summary(
        mode="paid" if paid.left > 0 else "free",
        free_limit=settings.chat_free_per_week,
        free_left=free_left,
        free_resets=counts.week_start + WEEK if counts.week_start else None,
        paid_questions_left=paid.left // answer if paid_reports else None,
        paid_questions_total=paid.total // answer if paid_reports else None,
        paid_used_share=(
            min(1.0, paid.spent / paid.total) if paid_reports and paid.total else None
        ),
        verdict=verdict,
    )
