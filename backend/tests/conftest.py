from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import deps, saved
from app.geo.build import build
from app.main import create_app
from app.store.accounts import AccountStore, sqlite_accounts
from app.store.shares import ShareStore
from tests import auth


@pytest.fixture(scope="session")
def places_db(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Build the place index once per test run, in a temporary folder."""
    return build(tmp_path_factory.mktemp("geo") / "places.sqlite")


@pytest.fixture
def shares(tmp_path: Path) -> ShareStore:
    """A fresh share store for each test, in a temporary folder."""
    return ShareStore(tmp_path / "shares.sqlite")


@pytest.fixture
def accounts(tmp_path: Path) -> AccountStore:
    """A fresh account store for each test, in a temporary folder."""
    return sqlite_accounts(tmp_path / "accounts.sqlite")


class FakeAdmin:
    """Stands in for Supabase's admin API: remembers whom it was asked to delete."""

    def __init__(self) -> None:
        self.deleted: list[str] = []
        self.fail = False

    def delete_user(self, user_id: str) -> None:
        if self.fail:
            raise OSError("supabase is down")
        self.deleted.append(user_id)


@pytest.fixture
def admin() -> FakeAdmin:
    return FakeAdmin()


@pytest.fixture
def client(
    places_db: Path, shares: ShareStore, accounts: AccountStore, admin: FakeAdmin
) -> TestClient:
    app = create_app()
    app.dependency_overrides[deps.places_db] = lambda: places_db
    app.dependency_overrides[deps.share_store] = lambda: shares
    app.dependency_overrides[deps.account_store] = lambda: accounts
    limit = saved.RateLimit(30)
    app.dependency_overrides[saved.guest_limit] = lambda: limit
    tokens = auth.checker()  # stand-in Supabase keys (tests/auth.py)
    app.dependency_overrides[deps.token_checker] = lambda: tokens
    app.dependency_overrides[deps.supabase_admin] = lambda: admin
    return TestClient(app)
