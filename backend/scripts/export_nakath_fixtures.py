"""Save the nakath answers the frontend tests use, in frontend/tests/e2e/fixtures.

Run after changing the nakath engine or its labels:
    uv run python scripts/export_nakath_fixtures.py
"""

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.main import create_app  # noqa: E402

FIXTURES = BACKEND.parent / "frontend" / "tests" / "e2e" / "fixtures"
COLOMBO = 1248991


def save(name: str, body: object) -> None:
    text = json.dumps(body, ensure_ascii=False, indent=2) + "\n"
    (FIXTURES / name).write_text(text, encoding="utf-8")


def main() -> None:
    client = TestClient(create_app())
    for lang in ("en", "si"):
        for year, zone, name in [
            (2027, "Asia/Colombo", "colombo"),
            (2027, "Australia/Melbourne", "melbourne"),
            (2027, "Europe/London", "london"),
            (2028, "Asia/Colombo", "colombo"),
        ]:
            body = client.get(f"/v1/avurudu/{year}", params={"timezone": zone, "lang": lang})
            save(f"avurudu-{year}-{name}-{lang}.json", body.json())
        for day in ("2027-04-14", "2027-04-15"):
            body = client.get(
                "/v1/panchanga", params={"date": day, "place_id": COLOMBO, "lang": lang}
            )
            save(f"panchanga-{day}-colombo-{lang}.json", body.json())
    body = client.get(
        "/v1/panchanga", params={"date": "2027-04-14", "place_id": 2643743, "lang": "en"}
    )
    save("panchanga-2027-04-14-london-en.json", body.json())
    print(f"wrote fixtures to {FIXTURES}")


if __name__ == "__main__":
    main()
