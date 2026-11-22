"""The daily clean up of idle guests (docs/19, step 5): sidera.delete_idle_guests().

Anonymous Supabase users with nothing saved and unused for 7 days go, here and in Supabase Auth.
The function lives in supabase/migrations/20261122021500_delete_idle_guests.sql. These tests run
it against a test PostgreSQL built from the migrations, with a stand-in for Supabase's `auth`
tables (tests/pg.py). pg_cron, which runs it daily on Supabase, is checked on the file.
"""

import re
import uuid
from collections.abc import Iterator
from typing import Any

import psycopg
import pytest

from tests.pg import MIGRATIONS, drop_auth, migrate, need_postgres, stand_in_auth

MIGRATION = MIGRATIONS / "20261122021500_delete_idle_guests.sql"
OLD = "now() - interval '8 days'"
RECENT = "now() - interval '2 days'"


@pytest.fixture
def db() -> Iterator[psycopg.Connection[Any]]:
    url = need_postgres()
    stand_in_auth(url)
    migrate(url)
    with psycopg.connect(url, autocommit=True) as conn:
        yield conn
    drop_auth(url)


def auth_user(
    db: psycopg.Connection[Any], *, anonymous: bool = True, at: str = OLD, signed_in: str = OLD
) -> str:
    """A Supabase user, made, changed and last signed in at the times given (SQL)."""
    user_id = str(uuid.uuid4())
    db.execute(
        f"INSERT INTO auth.users (id, is_anonymous, created_at, updated_at, last_sign_in_at) "
        f"VALUES (%s, %s, {at}, {at}, {signed_in})",
        (user_id, anonymous),
    )
    return user_id


def app_user(
    db: psycopg.Connection[Any], user_id: str, kind: str = "guest", seen: str = OLD
) -> str:
    """The backend's row for the user, last seen at the time given (SQL)."""
    db.execute(
        f"INSERT INTO sidera.users (id, kind, created_at, last_seen_at) "
        f"VALUES (%s, %s, {OLD}, {seen})",
        (user_id, kind),
    )
    return user_id


def guest(db: psycopg.Connection[Any], seen: str = OLD) -> str:
    """An anonymous user who saved once, long ago, with both rows."""
    return app_user(db, auth_user(db), seen=seen)


def save(db: psycopg.Connection[Any], user_id: str) -> None:
    db.execute(
        "INSERT INTO sidera.saved_reports (id, user_id, kind, title, input, input_hash, "
        "snapshot, summary, rules, created_at, updated_at) "
        "VALUES (%s, %s, 'hadahan', '', '{}', %s, '{}', '{}', 'r', now(), now())",
        (str(uuid.uuid4()), user_id, str(uuid.uuid4())),
    )


def clean_up(db: psycopg.Connection[Any]) -> int:
    row = db.execute("SELECT sidera.delete_idle_guests()").fetchone()
    assert row is not None
    return int(row[0])


def exists(db: psycopg.Connection[Any], user_id: str) -> tuple[bool, bool]:
    """Whether the user is still in (Supabase Auth, sidera.users)."""
    row = db.execute(
        "SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = %s), "
        "EXISTS (SELECT 1 FROM sidera.users WHERE id = %s)",
        (user_id, user_id),
    ).fetchone()
    assert row is not None
    return bool(row[0]), bool(row[1])


def test_an_idle_guest_with_nothing_saved_goes_from_both_places(
    db: psycopg.Connection[Any],
) -> None:
    gone = guest(db)
    db.execute(
        "INSERT INTO sidera.coupon_misses (user_id, at) VALUES (%s, now() - interval '8 days')",
        (gone,),
    )
    db.execute(
        f"INSERT INTO auth.sessions (id, user_id, created_at, updated_at, refreshed_at) "
        f"VALUES (%s, %s, {OLD}, {OLD}, ({OLD}) AT TIME ZONE 'UTC')",
        (str(uuid.uuid4()), gone),
    )

    assert clean_up(db) == 1
    assert exists(db, gone) == (False, False)
    left = db.execute(
        "SELECT (SELECT count(*) FROM sidera.coupon_misses), (SELECT count(*) FROM auth.sessions)"
    ).fetchone()
    assert left == (0, 0)
    assert clean_up(db) == 0


def test_a_guest_with_a_saved_report_stays(db: psycopg.Connection[Any]) -> None:
    kept = guest(db)
    save(db, kept)
    assert clean_up(db) == 0
    assert exists(db, kept) == (True, True)


def test_a_guest_whose_free_reports_expired_goes_on_the_next_run(
    db: psycopg.Connection[Any],
) -> None:
    """The free report expiry job (docs/18) deletes the reports; this job then the guest."""
    user_id = guest(db)
    save(db, user_id)
    assert clean_up(db) == 0
    db.execute("DELETE FROM sidera.saved_reports WHERE user_id = %s", (user_id,))
    assert clean_up(db) == 1
    assert exists(db, user_id) == (False, False)


@pytest.mark.parametrize("recent", ["made", "signed in", "session renewed", "seen by backend"])
def test_a_guest_used_in_the_last_7_days_stays(db: psycopg.Connection[Any], recent: str) -> None:
    if recent == "made":
        user_id = app_user(db, auth_user(db, at=RECENT, signed_in=RECENT), seen=RECENT)
    elif recent == "signed in":
        user_id = app_user(db, auth_user(db, signed_in=RECENT))
    elif recent == "session renewed":
        user_id = guest(db)
        # refreshed_at is a time without zone in Supabase, in UTC.
        db.execute(
            f"INSERT INTO auth.sessions (id, user_id, created_at, updated_at, refreshed_at) "
            f"VALUES (%s, %s, {OLD}, {OLD}, ({RECENT}) AT TIME ZONE 'UTC')",
            (str(uuid.uuid4()), user_id),
        )
    else:
        user_id = guest(db, seen=RECENT)
    assert clean_up(db) == 0
    assert exists(db, user_id) == (True, True)


def test_google_accounts_are_never_touched(db: psycopg.Connection[Any]) -> None:
    google = app_user(db, auth_user(db, anonymous=False), kind="google")
    # Linked Google since the token was read: Supabase not yet updated, the backend already.
    linked = app_user(db, auth_user(db), kind="google")
    assert clean_up(db) == 0
    assert exists(db, google) == (True, True)
    assert exists(db, linked) == (True, True)


def test_a_guest_with_an_order_stays(db: psycopg.Connection[Any]) -> None:
    user_id = guest(db)
    db.execute(
        "INSERT INTO sidera.orders (id, user_id, report_kind, report_hash, price, currency, "
        "amount_paid, method, created_at) "
        "VALUES (%s, %s, 'hadahan', 'h', 80000, 'LKR', 0, 'coupon', now())",
        (str(uuid.uuid4()), user_id),
    )
    assert clean_up(db) == 0
    assert exists(db, user_id) == (True, True)


def test_a_guest_the_backend_never_saw_goes(db: psycopg.Connection[Any]) -> None:
    """Signed in anonymously, but the first Save never reached the backend."""
    user_id = auth_user(db)
    assert clean_up(db) == 1
    assert exists(db, user_id) == (False, False)


def test_a_guest_row_left_without_its_supabase_user_goes_when_idle(
    db: psycopg.Connection[Any],
) -> None:
    idle = app_user(db, str(uuid.uuid4()))
    recent = app_user(db, str(uuid.uuid4()), seen=RECENT)
    assert clean_up(db) == 1
    assert exists(db, idle) == (False, False)
    assert exists(db, recent) == (False, True)


def test_only_the_owner_may_run_it(db: psycopg.Connection[Any]) -> None:
    for role in ("anon", "authenticated", "service_role", "public"):
        row = db.execute(
            "SELECT has_function_privilege(%s, 'sidera.delete_idle_guests(interval)', 'EXECUTE')",
            (role,),
        ).fetchone()
        assert row == (False,), role


def test_pg_cron_runs_it_every_day_on_supabase() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    schedule = re.search(r"cron\.schedule\(\s*'([\w-]+)',\s*'([^']+)',\s*'([^']+)'", sql)
    assert schedule is not None
    name, when, command = schedule.groups()
    assert name == "sidera-delete-idle-guests"
    assert when.split()[2:] == ["*", "*", "*"]  # every day
    assert command == "select sidera.delete_idle_guests()"
    # Only where pg_cron is there, so plain PostgreSQL (CI) can run the migrations too.
    assert "pg_available_extensions where name = 'pg_cron'" in sql
