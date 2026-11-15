from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import Settings
from app.main import create_app


def test_health_is_open(settings: Settings) -> None:
    client = TestClient(create_app(settings))
    assert client.get("/healthz").json()["status"] == "ok"


def test_agent_needs_the_access_key_when_one_is_set(settings: Settings) -> None:
    locked = settings.model_copy(update={"access_key": SecretStr("k")})
    client = TestClient(create_app(locked))

    assert client.get("/healthz").status_code == 200
    assert client.post("/agent", json={}).status_code == 401
    wrong = {b"X-Access-Key": "ké".encode("latin-1")}  # non-ASCII must not crash the check
    assert client.post("/agent", json={}, headers=wrong).status_code == 401
    # With the key, the request reaches the agent route (and fails validation on the empty body).
    assert client.post("/agent", json={}, headers={"X-Access-Key": "k"}).status_code == 422
