"""What the PostgreSQL stores share: the private `sidera` schema and one way to connect.

On PostgreSQL (Supabase) the tables are made by the migrations in `supabase/migrations/`, never
by the app. A store checks its tables are there when it starts, so a database the migrations
have not reached fails at once with a clear message, not on a visitor's first Save.
"""

from collections.abc import Iterable
from typing import Any

import psycopg

SCHEMA = "sidera"


class MissingTables(RuntimeError):
    """The database lacks tables the backend needs: the migrations have not been applied."""


def table(name: str) -> str:
    """A table's name in the app's schema."""
    return f"{SCHEMA}.{name}"


def connect(url: str) -> psycopg.Connection[Any]:
    # The connection's context manager commits on success and rolls back on error.
    return psycopg.connect(url, connect_timeout=10)


def require_tables(url: str, names: Iterable[str]) -> None:
    """Raises MissingTables unless every named table is in the app's schema."""
    with connect(url) as db:
        missing = [
            table(name)
            for name in names
            if db.execute("SELECT to_regclass(%s)", (table(name),)).fetchone() == (None,)
        ]
    if missing:
        raise MissingTables(
            f"PostgreSQL has no {', '.join(missing)}. Apply supabase/migrations/ to this database."
        )
