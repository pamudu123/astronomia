"""Step 5: the numbers of one run, or several runs side by side.

    python 5_report.py current               results/current/summary.md
    python 5_report.py current mini nano     results/compare.md as well

Needs checks.json (step 4) and judgement.json (the reviewer's marks).
"""

import statistics as st
import sys
from collections import defaultdict
from typing import Any

from evalkit.common import DATA, RESULTS, read_json

MARKS = ("correct", "audience", "useful")


def mean(values: list[float]) -> float:
    return round(st.mean(values), 2) if values else 0.0


def pct(values: list[float], q: float) -> float:
    values = sorted(values)
    return round(values[min(len(values) - 1, int(q * len(values)))], 1) if values else 0.0


def numbers(label: str) -> dict[str, Any]:
    checks = read_json(RESULTS / label / "checks.json")
    marks = read_json(RESULTS / label / "judgement.json")
    cases = {c["id"]: c for name in ("ground_truth", "sinhala") if (DATA / f"{name}.json").exists() for c in read_json(DATA / f"{name}.json")["cases"]}
    missing = [i for i in checks if i not in marks]
    if missing:
        sys.exit(f"{label}: no marks yet for {missing}")
    chat = [i for i in checks if cases[i]["kind"] == "chat"]
    chapters = [i for i in checks if cases[i]["kind"] == "explain"]
    topics: dict[str, list[str]] = defaultdict(list)
    for i in checks:
        topics[cases[i]["topic"]].append(i)
    suggest = [c["suggest"] for c in checks.values() if "suggest" in c]

    def timing(ids: list[str]) -> dict[str, Any]:
        ok = [i for i in ids if not checks[i]["error"]]
        return {
            "answer_median": pct([checks[i]["answer_start"] for i in ok if checks[i]["answer_start"]], 0.5),
            "first_median": pct([checks[i]["first_text"] for i in ok if checks[i]["first_text"]], 0.5),
            "total_median": pct([checks[i]["total"] for i in ok], 0.5),
            "total_p90": pct([checks[i]["total"] for i in ok], 0.9),
            "slowest": max((checks[i]["total"] for i in ok), default=0),
            "over_60s": sum(checks[i]["total"] > 60 for i in ids),
        }

    return {
        "label": label, "checks": checks, "marks": marks, "cases": cases, "topics": topics,
        "models": sorted({m for c in checks.values() for m in c["models"]}),
        "marks_mean": {m: mean([marks[i][m] for i in checks]) for m in MARKS},
        "unsafe": [i for i in checks if not marks[i]["safe"]],
        "weak": [i for i in checks if min(marks[i][m] for m in MARKS) <= 2],
        "fully_good": sum(all(marks[i][m] >= 4 for m in MARKS) and marks[i]["safe"] for i in checks),
        "preambles": sum(checks[i]["extra_messages"] > 0 for i in chat),
        "sinhala": [i for i in checks if "sinhala" in marks[i]],
        "errors": [i for i in checks if checks[i]["error"]],
        "chat": timing(chat), "chapter": timing(chapters),
        "cost_chat": mean([checks[i]["cost_usd"] * 1000 for i in chat]) / 1000 if chat else 0,
        "cost_chapter": mean([checks[i]["cost_usd"] * 1000 for i in chapters]) / 1000 if chapters else 0,
        "calls": mean([float(checks[i]["model_calls"]) for i in chat]),
        "suggest_median": pct([s["total"] for s in suggest], 0.5),
        "suggest_kept": (sum(sum(s.get("kept_by_site", [])) for s in suggest), sum(len(s["chips"]) for s in suggest)),
    }


def table(runs: list[dict[str, Any]]) -> list[str]:
    def row(name: str, pick: Any) -> str:
        return f"| {name} | " + " | ".join(str(pick(r)) for r in runs) + " |"

    n = len(runs[0]["checks"])
    return [
        "| | " + " | ".join(r["label"] for r in runs) + " |",
        "|---|" + "---|" * len(runs),
        row("Model", lambda r: ", ".join(m.removesuffix(m[: len(m) // 2]) if m[: len(m) // 2] * 2 == m else m for m in r["models"])),
        row("Answers", lambda r: len(r["checks"])),
        row("Correctness (0 to 5)", lambda r: r["marks_mean"]["correct"]),
        row("Suits the audience (0 to 5)", lambda r: r["marks_mean"]["audience"]),
        row("Usefulness (0 to 5)", lambda r: r["marks_mean"]["useful"]),
        row("Sinhala fluency (0 to 5), Sinhala answers only", lambda r: f"{mean([r['marks'][i]['sinhala'] for i in r['sinhala']])} ({len(r['sinhala'])} answers)" if r["sinhala"] else "not marked"),
        row("Good on all three (4 or more) and safe", lambda r: f"{r['fully_good']} of {len(r['checks'])}"),
        row("Weak (a mark of 2 or less)", lambda r: len(r["weak"])),
        row("Unsafe", lambda r: len(r["unsafe"])),
        row("Errors", lambda r: len(r["errors"])),
        row("Chat: the answer itself starts, median", lambda r: f"{r['chat']['answer_median']}s"),
        row("Chat answers with text before a lookup", lambda r: r["preambles"]),
        row("Chat: first words, median", lambda r: f"{r['chat']['first_median']}s"),
        row("Chat: complete, median / 90% within / slowest", lambda r: f"{r['chat']['total_median']}s / {r['chat']['total_p90']}s / {r['chat']['slowest']}s"),
        row("Chapter: first words, median", lambda r: f"{r['chapter']['first_median']}s"),
        row("Chapter: complete, median / slowest", lambda r: f"{r['chapter']['total_median']}s / {r['chapter']['slowest']}s"),
        row("Over the site's 60s limit", lambda r: r["chat"]["over_60s"] + r["chapter"]["over_60s"]),
        row("Follow-up buttons, median", lambda r: f"{r['suggest_median']}s"),
        row("Follow-up buttons the site keeps", lambda r: "{} of {}".format(*r["suggest_kept"])),
        row("Model calls per chat answer", lambda r: r["calls"]),
        row("Cost per chat answer (at the set prices)", lambda r: f"${r['cost_chat']:.4f}"),
        row("Cost per chapter (at the set prices)", lambda r: f"${r['cost_chapter']:.4f}"),
    ] if n else []


def by_topic(runs: list[dict[str, Any]]) -> list[str]:
    lines = ["| Topic | Answers | " + " | ".join(f"{r['label']}: correct / audience / useful / median time" for r in runs) + " |", "|---|---|" + "---|" * len(runs)]
    for topic, ids in runs[0]["topics"].items():
        cells = []
        for r in runs:
            have = [i for i in ids if i in r["marks"]]
            cells.append(" / ".join(str(mean([r["marks"][i][m] for i in have])) for m in MARKS) + f" / {pct([r['checks'][i]['total'] for i in have], 0.5)}s")
        lines.append(f"| {topic} | {len(ids)} | " + " | ".join(cells) + " |")
    return lines


def per_answer(r: dict[str, Any]) -> list[str]:
    lines = ["| Question | Correct | Audience | Useful | Safe | First words | Complete | Note |", "|---|---|---|---|---|---|---|---|"]
    for i, c in r["checks"].items():
        m = r["marks"][i]
        lines.append(f"| {i} | {m['correct']} | {m['audience']} | {m['useful']} | {'yes' if m['safe'] else '**no**'} | {c['first_text']}s | {c['total']}s | {m['note']} |")
    return lines


def main() -> None:
    labels = sys.argv[1:] or ["current"]
    runs = [numbers(x) for x in labels]
    for r in runs:
        text = [f"# Numbers: {r['label']}", "", *table([r]), "", "## By topic", "", *by_topic([r]), "", "## Every answer", "", *per_answer(r), ""]
        (RESULTS / r["label"] / "summary.md").write_text("\n".join(text), encoding="utf-8", newline="\n")
    if len(runs) > 1:
        text = ["# Models side by side", "", *table(runs), "", "## By topic", "", *by_topic(runs), ""]
        name = "compare-" + "-".join(x.replace("/", "_") for x in labels) + ".md"
        (RESULTS / name).write_text("\n".join(text), encoding="utf-8", newline="\n")
    print("\n".join([*table(runs), "", *by_topic(runs)]))


if __name__ == "__main__":
    main()
