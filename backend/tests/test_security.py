"""The staging access key."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.config import get_settings
from app.main import create_app


@pytest.fixture
def locked(places_db: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("ASTRONOMIA_ACCESS_KEY", "k" * 32)
    get_settings.cache_clear()
    app = create_app()
    app.dependency_overrides[deps.places_db] = lambda: places_db
    yield TestClient(app)
    get_settings.cache_clear()


def test_requests_need_the_key(locked: TestClient) -> None:
    assert locked.get("/v1/meta").status_code == 401
    assert locked.get("/v1/meta", headers={"X-Access-Key": "wrong"}).status_code == 401
    assert locked.get("/v1/meta", headers={"X-Access-Key": "k" * 32}).status_code == 200
    assert locked.get("/docs").status_code == 401


def test_the_health_check_stays_open(locked: TestClient) -> None:
    assert locked.get("/healthz").status_code == 200


def test_without_a_key_setting_everything_is_open(client: TestClient) -> None:
    assert client.get("/v1/meta").status_code == 200
