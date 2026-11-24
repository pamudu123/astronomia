"""Create, list and switch coupons on or off (docs/18, section 4). Run by the owner.

Codes live in the database, never in the website or the repository, so this script takes the
code on the command line and writes it straight to the database. It uses
ASTRONOMIA_DATABASE_URL (Supabase) when set, otherwise the local SQLite file the backend uses.

    uv run python scripts/coupons.py create pamudu --percent 100 --per-account 10 \\
        --total 200 --ends 2027-06-30 --note "testers, friends and family"
    uv run python scripts/coupons.py list
    uv run python scripts/coupons.py off pamudu
    uv run python scripts/coupons.py on pamudu
    uv run python scripts/coupons.py void <order id>

A code is kept in lower case with its spaces taken out. --ends is the last day the code works,
in Sri Lanka time: it stops at midnight at the end of that day. A 100% coupon unlocks a report
by itself; with any other, the rest is paid for first (docs/23).
"""

import argparse
import datetime as dt
import sys
import zoneinfo
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings
from app.store.orders import OrderStore, postgres_orders, sqlite_orders
from app.tiers.prices import REPORT_KINDS, ReportKind

COLOMBO = zoneinfo.ZoneInfo("Asia/Colombo")


def store() -> OrderStore:
    settings = get_settings()
    if settings.database_url:
        return postgres_orders(settings.database_url)
    print(f"(no ASTRONOMIA_DATABASE_URL: using {settings.orders_db})", file=sys.stderr)
    return sqlite_orders(settings.orders_db)


def end_of_day(text: str) -> dt.datetime:
    """The moment a code stops: midnight after the given day, in Sri Lanka."""
    day = dt.date.fromisoformat(text)
    return dt.datetime.combine(day + dt.timedelta(days=1), dt.time(), COLOMBO)


def kinds(text: str) -> list[ReportKind]:
    chosen = [part.strip() for part in text.split(",") if part.strip()]
    wrong = [part for part in chosen if part not in REPORT_KINDS]
    if wrong or not chosen:
        raise argparse.ArgumentTypeError(f"choose from {', '.join(REPORT_KINDS)}")
    return [kind for kind in REPORT_KINDS if kind in chosen]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)

    create = commands.add_parser("create", help="add a coupon")
    create.add_argument("code")
    create.add_argument("--percent", type=int, required=True, help="percent off, 1 to 100")
    create.add_argument(
        "--reports", type=kinds, default=list(REPORT_KINDS), help="hadahan, porondam or both"
    )
    create.add_argument("--total", type=int, default=None, help="uses in total (default: no limit)")
    create.add_argument("--per-account", type=int, default=1, help="uses per account (default 1)")
    create.add_argument("--ends", type=end_of_day, default=None, help="last day, YYYY-MM-DD")
    create.add_argument("--note", default="", help="what it is for")

    commands.add_parser("list", help="every coupon and how often it was used")
    for name, text in (("off", "switch a coupon off"), ("on", "switch a coupon back on")):
        commands.add_parser(name, help=text).add_argument("code")
    commands.add_parser("void", help="undo one unlock (misuse)").add_argument("order_id")

    args = parser.parse_args(argv)
    orders = store()

    if args.command == "create":
        try:
            coupon = orders.create_coupon(
                args.code,
                args.percent,
                args.reports,
                max_uses=args.total,
                max_uses_per_account=args.per_account,
                ends_at=args.ends,
                note=args.note,
            )
        except ValueError as error:
            print(f"Not created: {error}", file=sys.stderr)
            return 1
        print(f"Created {coupon.code}: {coupon.percent_off}% off {', '.join(coupon.kinds)}.")
        return 0

    if args.command == "list":
        for c in orders.list_coupons():
            total = "no limit" if c.max_uses is None else str(c.max_uses)
            ends = (
                c.ends_at.astimezone(COLOMBO).strftime("%Y-%m-%d %H:%M") if c.ends_at else "never"
            )
            print(
                f"{c.code:<20} {c.percent_off:>3}% {','.join(c.kinds):<17} "
                f"{'on ' if c.active else 'off'}  used {c.uses}/{total}, "
                f"{c.max_uses_per_account} per account, ends {ends}"
                + (f"  ({c.note})" if c.note else "")
            )
        return 0

    if args.command in ("on", "off"):
        if not orders.set_active(args.code, args.command == "on"):
            print(f"No coupon {args.code!r}.", file=sys.stderr)
            return 1
        print(f"{args.code} is {args.command}.")
        return 0

    if not orders.void(args.order_id):
        print(f"No paid order {args.order_id!r}.", file=sys.stderr)
        return 1
    print(f"Order {args.order_id} is void.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
