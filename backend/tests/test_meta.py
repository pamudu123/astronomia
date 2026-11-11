import logging

import pytest
from fastapi.testclient import TestClient


def test_healthz(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_meta_lists_languages(client: TestClient) -> None:
    body = client.get("/v1/meta").json()
    assert body["languages"] == ["si", "en"]
    assert body["default_language"] == "en"
    assert body["version"]


def test_access_log_has_no_query_string(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="astronomia.access"):
        client.get("/v1/meta?name=Nimali&date=1995-04-19")
    messages = " ".join(r.getMessage() for r in caplog.records if r.name == "astronomia.access")
    assert "/v1/meta" in messages
    assert "Nimali" not in messages
    assert "1995" not in messages
