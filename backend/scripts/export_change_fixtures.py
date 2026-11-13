"""Save the planet change answers the frontend tests use, in tests/e2e/fixtures.

Run after changing the change engine or its labels:
    uv run python scripts/export_change_fixtures.py
"""

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.main import create_app  # noqa: E402

FIXTURES = BACKEND.parent / "frontend" / "tests" / "e2e" / "fixtures"
BIRTH = {
    "date": "1995-04-19",
    "time": "14:35",
    "place_id": 1241622,
    "as_of": "2026-11-13T00:00:00Z",
}
PAGES = [("rahu-ketu-2026-12", "makara"), ("saturn-2027-06", "vrishabha")]


def save(name: str, body: object) -> None:
    text = json.dumps(body, ensure_ascii=False, indent=2) + "\n"
    (FIXTURES / name).write_text(text, encoding="utf-8")


def main() -> None:
    client = TestClient(create_app())
    for lang in ("en", "si"):
        save(f"changes-{lang}.json", client.get(f"/v1/changes?lang={lang}").json())
        birth = {**BIRTH, "lang": lang}
        save(
            f"changes-personal-{lang}.json", client.post("/v1/changes/personal", json=birth).json()
        )
        for change, lagna in PAGES:
            hub = client.get(f"/v1/changes/{change}?lang={lang}").json()
            save(f"changes-{change}-{lang}.json", hub)
            page = client.get(f"/v1/changes/{change}/{lagna}?lang={lang}").json()
            save(f"changes-{change}-{lagna}-{lang}.json", page)
            mine = client.post(f"/v1/changes/{change}/personal", json=birth).json()
            save(f"changes-{change}-personal-{lang}.json", mine)
    print(f"wrote fixtures to {FIXTURES}")


if __name__ == "__main__":
    main()
