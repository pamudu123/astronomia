"""Keeps every run, so nothing is lost when a run is repeated (results/history/).

Each run is one file that is never written over: what was asked of which model, when, with which
prompts and code (a fingerprint), and every answer with its times. index.md lists them. Keys are
never part of it.
"""

import datetime as dt
import hashlib
import re
import subprocess
from pathlib import Path
from typing import Any

from evalkit.common import AGENT, DATA, REPO, RESULTS, write_json

HISTORY = RESULTS / "history"
HEAD = "| When | Run | Model | Thinking | Questions | Answers | Errors | Median complete | Prompts | File |\n|---|---|---|---|---|---|---|---|---|---|\n"


def _fingerprint(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(path.relative_to(REPO).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()[:10]


def code_state() -> dict[str, str]:
    """Which prompts, skills and agent code the answers came from."""
    def git(*args: str) -> str:
        return subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, text=True, check=False).stdout.strip()

    prompts = [p for folder in (AGENT / "app" / "prompts", AGENT / "skills") for p in folder.rglob("*.md")]
    return {
        "commit": git("rev-parse", "--short", "HEAD"),
        "uncommitted_changes": "yes" if git("status", "--short", "--", "agent", "frontend/lib/assistant") else "no",
        "prompts": _fingerprint(prompts),
        "agent_code": _fingerprint(list((AGENT / "app").rglob("*.py"))),
    }


def save(label: str, model: str, effort: str, cases: str, answers: dict[str, Any], *, when: dt.datetime | None = None, state: dict[str, str] | None = None) -> Path:
    when = when or dt.datetime.now(dt.UTC)
    stamp = when.strftime("%Y%m%d-%H%M%S")
    HISTORY.mkdir(parents=True, exist_ok=True)
    file = HISTORY / f"{stamp}-{re.sub(r'[^A-Za-z0-9.-]+', '_', label)}.json"
    n = 1
    while file.exists():  # never over an earlier run
        n += 1
        file = file.with_name(f"{stamp}-{re.sub(r'[^A-Za-z0-9.-]+', '_', label)}-{n}.json")
    state = state if state is not None else code_state()
    questions = DATA / f"{cases}.json"
    meta = {
        "label": label, "when_utc": when.isoformat(timespec="seconds"), "model": model, "thinking": effort,
        "cases": cases, "questions": _fingerprint([questions]) if questions.exists() else "", **state,
    }
    write_json(file, {"run": meta, "answers": answers})
    last = [r["turns"][-1] for r in answers.values()]
    totals = sorted(t["total"] for t in last)
    index = HISTORY / "index.md"
    old = index.read_text(encoding="utf-8") if index.exists() else "# Every run, oldest first\n\n" + HEAD
    row = (
        f"| {meta['when_utc'][:16].replace('T', ' ')} | {label} | {model} | {effort} | {cases} | {len(answers)} | "
        f"{sum(bool(t['error']) for t in last)} | {totals[len(totals) // 2] if totals else ''}s | {state.get('prompts', 'not recorded')} | [{file.name}]({file.name}) |\n"
    )
    index.write_text(old + row, encoding="utf-8", newline="\n")
    return file


def save_marks(label: str, marks: dict[str, Any]) -> Path:
    """The reviewer's marks, kept beside the run they are about."""
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%d-%H%M%S")
    file = HISTORY / f"{stamp}-{re.sub(r'[^A-Za-z0-9.-]+', '_', label)}-marks.json"
    write_json(file, marks)
    return file
