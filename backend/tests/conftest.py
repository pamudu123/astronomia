from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.geo.build import build
from app.main import create_app
from app.store.shares import ShareStore


@pytest.fixture(scope="session")
def places_db(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Build the place index once per test run, in a temporary folder."""
    return build(tmp_path_factory.mktemp("geo") / "places.sqlite")


@pytest.fixture
def shares(tmp_path: Path) -> ShareStore:
    """A fresh share store for each test, in a temporary folder."""
    return ShareStore(tmp_path / "shares.sqlite")


@pytest.fixture
def client(places_db: Path, shares: ShareStore) -> TestClient:
    app = create_app()
    app.dependency_overrides[deps.places_db] = lambda: places_db
    app.dependency_overrides[deps.share_store] = lambda: shares
    return TestClient(app)
