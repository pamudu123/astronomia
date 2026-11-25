"""Step 1: the page contexts the assistant sees, for made-up people.

Asks the running backend for results, then has the website's own TypeScript
(frontend/lib/assistant/*) turn them into the exact summaries the chat and the chapters get.
"""

import subprocess
import sys
from typing import Any

import httpx
from evalkit.common import (
    BACKEND_URL,
    COLOMBO,
    DATA,
    EVAL_ROOT,
    FROZEN_NOW,
    FROZEN_TODAY,
    KANDY,
    RAW,
    write_json,
)

AS_OF = FROZEN_NOW.isoformat()
# Made-up people. No real person's details.
NIMALI = {"date": "1995-03-12", "time": "08:45", "place_id": COLOMBO}
DILKI = {"date": "1988-07-05", "time": "14:20", "place_id": 1246294}
KASUN = {"date": "1992-08-20", "time": "22:10", "place_id": KANDY}


def main() -> None:
    http = httpx.Client(base_url=BACKEND_URL, timeout=120)

    def get(path: str, **params: Any) -> Any:
        r = http.get(path, params=params)
        r.raise_for_status()
        return r.json()

    def post(path: str, body: dict[str, Any]) -> Any:
        r = http.post(path, json=body)
        if r.is_error:
            sys.exit(f"{path}: {r.status_code} {r.text}")
        return r.json()

    for lang in ("en", "si"):
        chart = {**NIMALI, "lang": lang, "as_of": AS_OF}
        chart_k = {**KASUN, "lang": lang, "as_of": AS_OF}
        full = {"bride": NIMALI, "groom": KASUN, "lang": lang}
        quick = {
            "bride": {"nakshatra": "rohini", "pada": 2},
            "groom": {"nakshatra": "hasta", "pada": 3},
            "lang": lang,
        }
        out = {
            "labels": get(f"/v1/labels/{lang}"),
            "hadahan": post("/v1/hadahan", chart),
            "hadahan_kasun": post("/v1/hadahan", chart_k),
            "journey": post("/v1/journey", chart),
            "upcoming": post("/v1/changes/personal", chart),
            "match_full": post("/v1/porondam", full),
            "match_quick": post("/v1/porondam", quick),
            "timeline": post("/v1/porondam/timeline", {**full, "as_of": AS_OF}),
            "day": get("/v1/panchanga", date=FROZEN_TODAY, place_id=COLOMBO, lang=lang),
            "month": get("/v1/panchanga/month", year=2026, month=12, place_id=COLOMBO, lang=lang),
            "avurudu": get("/v1/avurudu/2027", timezone="Asia/Colombo", lang=lang),
            "change": post("/v1/changes/saturn-2027-06/personal", chart),
            # For the held-out questions (2b_holdout.py).
            "hadahan_dilki": post("/v1/hadahan", {**DILKI, "lang": lang, "as_of": AS_OF}),
            "journey_kasun": post("/v1/journey", chart_k),
            "upcoming_kasun": post("/v1/changes/personal", chart_k),
            "day2": get("/v1/panchanga", date="2026-12-12", place_id=KANDY, lang=lang),
        }
        for name, value in out.items():
            write_json(RAW / f"{name}-{lang}.json", value)

    # An unreliable birth time: step through the day until the rising sign is near a change.
    for minute in range(0, 1440, 5):
        body = {**NIMALI, "time": f"{minute // 60:02d}:{minute % 60:02d}", "as_of": AS_OF}
        result = post("/v1/hadahan", body)
        if not result["chart"]["time_check"]["stable"]:
            write_json(RAW / "hadahan_unstable-en.json", result)
            break

    subprocess.run(["node", str(EVAL_ROOT / "build_contexts.mjs")], check=True)
    print("contexts in", DATA / "contexts")


if __name__ == "__main__":
    main()
