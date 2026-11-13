"""Save the baby name answers the frontend tests use (tests/e2e/fixtures).

Every birth here is made up. Run after changing the letter table, the engine or its labels:
    uv run python scripts/export_baby_fixtures.py
"""

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.main import create_app  # noqa: E402

FIXTURES = BACKEND.parent / "frontend" / "tests" / "e2e" / "fixtures"
KANDY = 1241622


def save(name: str, body: object) -> None:
    text = json.dumps(body, ensure_ascii=False, indent=2) + "\n"
    (FIXTURES / name).write_text(text, encoding="utf-8")


def main() -> None:
    client = TestClient(create_app())
    for lang in ("en", "si"):
        for star in ("ardra", "krittika", "jyeshtha"):
            body = client.get(f"/v1/baby/letters/{star}", params={"lang": lang})
            save(f"baby-letters-{star}-{lang}.json", body.json())
        # The made-up birth the other personal tests use.
        birth = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY, "lang": lang}
        save(f"baby-birth-{lang}.json", client.post("/v1/baby/letters", json=birth).json())
        # Three minutes before the Moon moves into the next pada.
        near = {"date": "2024-01-18", "time": "15:10", "place_id": KANDY, "lang": lang}
        save(f"baby-birth-near-{lang}.json", client.post("/v1/baby/letters", json=near).json())
    # Name lists the tests ask for, keyed as the test looks them up.
    queries = [
        (["අ", "ඉ", "උ", "එ"], "any", "any", "en"),
        (["අ", "ඉ", "උ", "එ"], "girl", "any", "en"),
        (["අ", "ඉ", "උ", "එ"], "boy", "short", "en"),
        (["ඉ", "උ", "එ"], "any", "any", "en"),
        (["කු", "ඝ", "ඞ", "ඡ"], "any", "any", "si"),
        (["යු"], "any", "any", "en"),
        (["ය", "යු"], "any", "any", "en"),
        (["නො", "ය", "යි", "යු"], "any", "any", "en"),
        (["චෙ"], "any", "any", "si"),
        (["චෙ", "චො"], "any", "any", "si"),
    ]
    lists = {}
    for letters, gender, length, lang in queries:
        params: list[tuple[str, str | int | float | bool | None]] = [
            ("letters", letter) for letter in letters
        ]
        params += [(k, v) for k, v in (("gender", gender), ("length", length)) if v != "any"]
        params.append(("lang", lang))
        key = f"{','.join(letters)}|{gender}|{length}|{lang}"
        lists[key] = client.get("/v1/baby/names", params=params).json()
    save("baby-names.json", lists)
    # The first letters finder for a made-up child, and for a birth star only.
    child = {"date": "2023-05-10", "time": "08:15", "place_id": KANDY}
    body = client.post(
        "/v1/first-letters",
        json={"child": child, "months": 3, "as_of": "2026-12-01", "lang": "en"},
    )
    save("first-letters-full-en.json", body.json())
    body = client.post(
        "/v1/first-letters",
        json={
            "child": {"nakshatra": "ashwini", "pada": 1},
            "birth_date": "2023-05-10",
            "months": 3,
            "as_of": "2026-12-01",
            "lang": "si",
        },
    )
    save("first-letters-star-si.json", body.json())
    print(f"wrote fixtures to {FIXTURES}")


if __name__ == "__main__":
    main()
