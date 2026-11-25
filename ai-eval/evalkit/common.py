"""Shared paths and helpers. Nothing here changes the main code base."""

import datetime as dt
import json
from pathlib import Path
from typing import Any

EVAL_ROOT = Path(__file__).resolve().parents[1]
REPO = EVAL_ROOT.parent
DATA = EVAL_ROOT / "data"
RAW = DATA / "raw"
CONTEXTS = DATA / "contexts"
RESULTS = EVAL_ROOT / "results"
AGENT = REPO / "agent"

# Every run is made "at" this moment (10:00 on Wednesday 25 November 2026 in Sri Lanka), so
# answers about "today" from different models on different days can be compared.
FROZEN_NOW = dt.datetime(2026, 11, 25, 4, 30, tzinfo=dt.UTC)
FROZEN_TODAY = "2026-11-25"

COLOMBO, KANDY, LONDON = 1248991, 1241622, 2643743
BACKEND_URL = "http://localhost:8010"
AGENT_PORT = 8133


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, indent=1) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
