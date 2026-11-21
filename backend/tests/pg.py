"""A test PostgreSQL made like the Supabase project: the repository's migrations, in order.

PostgreSQL tests run when ASTRONOMIA_TEST_DATABASE_URL is set (CI always sets it). They drop
and remake the `sidera` schema, so never point it at a database whose data matters.
"""

import os
from pathlib import Path

import psycopg
import pytest

PG_URL = os.environ.get("ASTRONOMIA_TEST_DATABASE_URL", "")
MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
# Roles every Supabase project has, which the migrations take rights away from.
SUPABASE_ROLES = ("anon", "authenticated", "service_role")


def need_postgres() -> str:
    if not PG_URL:
        pytest.skip("no test PostgreSQL (set ASTRONOMIA_TEST_DATABASE_URL)")
    return PG_URL


def migration_files() -> list[Path]:
    return sorted(MIGRATIONS.glob("*.sql"))


def drop_sidera(url: str) -> None:
    with psycopg.connect(url) as db:
        db.execute("DROP SCHEMA IF EXISTS sidera CASCADE")


def migrate(url: str) -> None:
    """A fresh `sidera` schema from the migrations, as on Supabase."""
    drop_sidera(url)
    with psycopg.connect(url) as db:
        for role in SUPABASE_ROLES:
            exists = db.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,)).fetchone()
            if exists is None:
                db.execute(f"CREATE ROLE {role} NOLOGIN")
        for path in migration_files():
            db.execute(path.read_text(encoding="utf-8").encode())
