"""Check that a running backend answers every tool, not only the health check.

Used on the image in CI and on the deployed site, so a missing route or a broken deploy
is caught before a visitor finds it (QA report AST-02 to AST-04).

    uv run python scripts/smoke.py http://localhost:8000
    uv run python scripts/smoke.py https://example.vercel.app/api

Optional environment:
    SMOKE_ACCESS_KEY        sent as X-Access-Key, for a backend called directly
    SMOKE_STAGING_PASSWORD  sent as HTTP Basic auth, for a frontend behind the staging gate

Only the standard library is used, so it runs without the backend's dependencies.
"""

import base64
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.request
import zoneinfo
from collections.abc import Callable
from typing import Any

COLOMBO = 1248991
TIMEOUT = 90  # a free Render service can take most of a minute to wake

Check = Callable[[Any], str | None]


def headers() -> dict[str, str]:
    out = {"content-type": "application/json", "user-agent": "astronomia-smoke"}
    key = os.environ.get("SMOKE_ACCESS_KEY")
    if key:
        out["X-Access-Key"] = key
    password = os.environ.get("SMOKE_STAGING_PASSWORD")
    if password:
        out["authorization"] = "Basic " + base64.b64encode(f"smoke:{password}".encode()).decode()
    return out


def call(base: str, method: str, path: str, body: object | None) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(base + path, data=data, method=method, headers=headers())
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode(errors="replace")[:300]


def ok_status(answer: Any) -> str | None:
    return None if answer.get("status") == "ok" else f"status {answer.get('status')!r}"


def has(key: str) -> Check:
    return lambda answer: None if answer.get(key) else f"no {key!r} in the answer"


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    base = sys.argv[1].rstrip("/")
    today = dt.datetime.now(zoneinfo.ZoneInfo("Asia/Colombo")).date().isoformat()
    birth = {"date": "1990-01-15", "time": "23:59", "place_id": COLOMBO, "lang": "en"}
    stars = {
        "bride": {"nakshatra": "rohini", "pada": 2},
        "groom": {"nakshatra": "swati", "pada": 3},
    }
    child = {"child": {"nakshatra": "rohini", "pada": 1}, "months": 1, "lang": "en"}
    wedding = {**stars, "months": 3, "ceremonies": ["engagement", "poruwa", "homecoming"]}

    checks: list[tuple[str, str, str, object | None, Check]] = [
        ("health", "GET", "/healthz", None, has("status")),
        ("hadahan", "POST", "/v1/hadahan", birth, ok_status),
        ("porondam, stars", "POST", "/v1/porondam", {**stars, "lang": "en"}, has("match")),
        (
            "daily nakath, en",
            "GET",
            f"/v1/panchanga?date={today}&place_id={COLOMBO}&lang=en",
            None,
            has("sunrise"),
        ),
        (
            "daily nakath, si",
            "GET",
            f"/v1/panchanga?date={today}&place_id={COLOMBO}&lang=si",
            None,
            has("sunrise"),
        ),
        (
            "wedding, default venue",
            "POST",
            "/v1/wedding-nakath",
            {**wedding, "lang": "en"},
            ok_status,
        ),
        ("wedding, si", "POST", "/v1/wedding-nakath", {**wedding, "lang": "si"}, ok_status),
        ("first letters, default place", "POST", "/v1/first-letters", child, ok_status),
        (
            "first letters, chosen place",
            "POST",
            "/v1/first-letters",
            {**child, "place_id": COLOMBO},
            ok_status,
        ),
    ]

    failed = 0
    for name, method, path, body, check in checks:
        started = time.monotonic()
        try:
            code, answer = call(base, method, path, body)
            problem = check(answer) if code == 200 else f"HTTP {code}: {answer}"
        except Exception as error:  # a timeout or a refused connection
            problem = f"{type(error).__name__}: {error}"
        took = f"{time.monotonic() - started:.1f}s"
        print(f"{'FAIL' if problem else 'ok  '} {name} ({took}){': ' + problem if problem else ''}")
        failed += bool(problem)

    print(f"{len(checks) - failed} of {len(checks)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
