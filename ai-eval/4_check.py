"""Step 4: the automatic checks, and a review pack for the reviewer (Claude) to read.

    python 4_check.py --label current

Writes results/<label>/checks.json and results/<label>/review.md. The checks only find things to
look at: the reviewer reads every answer and writes the marks in results/<label>/judgement.json
(see RUBRIC.md), and a wrong alarm is said there.
"""

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from evalkit import sinhala
from evalkit.common import CONTEXTS, DATA, EVAL_ROOT, RESULTS, read_json, write_json

# The prices in agent/app/config.py (US dollars per million tokens). For another model, put its
# prices in prices.json: {"<label>": {"input": .., "cached": .., "output": ..}}.
DEFAULT_PRICE = {"input": 0.25, "cached": 0.025, "output": 2.0}
EMOJI = re.compile("[🌀-🫿⌀-⏿☀-➿]")


def sinhala_share(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    return sum("඀" <= c < "฀" for c in letters) / len(letters) if letters else 0.0


def style(case: dict[str, Any], text: str) -> dict[str, Any]:
    prose = [p for p in re.split(r"\n\s*\n", text) if p.strip() and not p.strip().startswith(("|", "-", "*   ", "1."))]
    longest = max((len(p.split()) for p in prose), default=0)
    share = sinhala_share(text)
    wanted = case["answer_lang"]
    issues = []
    if (wanted == "si") != (share >= 0.3):
        issues.append(f"language: wanted {wanted}, Sinhala letters {share:.0%}")
    if longest > 40:
        issues.append(f"a paragraph of {longest} words (limit about 40)")
    if re.search(r"(?m)^#{1,6} ", text):
        issues.append("# heading")
    if wanted == "si" and re.search(r"20\d\d-\d\d-\d\d", text):
        issues.append("date written as 2027-02-18 in Sinhala")
    words = len(text.split())
    if case["kind"] == "explain":
        if not 120 <= words <= 400:
            issues.append(f"{words} words (wanted 150 to 350)")
        opening = re.split(r"\n\s*\n", text.strip())[0]
        if len(opening.split()) > 35:
            issues.append(f"opening of {len(opening.split())} words (limit 35)")
        if EMOJI.search(opening):
            issues.append("icon in the opening")
        leads = re.findall(r"(?m)^\*\*(.+?)\*\*\s*$", text)
        if not 2 <= len(leads) <= 5 and case["chapter"] not in ("avurudu.times",):
            issues.append(f"{len(leads)} bold leads (wanted 2 to 4)")
        if any(not EMOJI.search(x) for x in leads):
            issues.append("a lead with no icon")
        if text.strip().endswith("?"):
            issues.append("closes with a question")
    return {"words": words, "longest_paragraph": longest, "sinhala_share": round(share, 2), "issues": issues}


def cost(usage: dict[str, Any] | None, price: dict[str, float]) -> float:
    if not usage:
        return 0.0
    fresh = max(0, usage["input"] - usage["cached"])
    return (fresh * price["input"] + usage["cached"] * price["cached"] + usage["output"] * price["output"]) / 1e6


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--label", required=True)
    p.add_argument("--cases", default="ground_truth", help="ground_truth or holdout")
    a = p.parse_args()
    folder = RESULTS / a.label
    run = read_json(folder / "answers.json")
    prices_file = EVAL_ROOT / "prices.json"
    price = (read_json(prices_file) if prices_file.exists() else {}).get(a.label, DEFAULT_PRICE)
    cases = {c["id"]: c for c in read_json(DATA / f"{a.cases}.json")["cases"]}

    checks: dict[str, Any] = {}
    chips_in: list[Any] = []
    chip_ids: list[str] = []
    for id, result in run["answers"].items():
        case, last = cases[id], result["turns"][-1]
        text = last["text"]
        missing = [f["name"] for f in case["key_facts"] if not any(re.search(x, text, re.I) for x in f["any"])]
        hits = []
        for f in case["must_not"]:
            for x in f["any"]:
                if m := re.search(x, text, re.I):
                    hits.append(f"{f['name']}: «{m.group(0)[:60]}»")
                    break
        used = [t["name"] for turn in result["turns"] for t in (turn["usage"] or {}).get("tools", [])]
        failed = [t for turn in result["turns"] for t in (turn["usage"] or {}).get("tools", []) if t.get("status") != "success"]
        engine = [n for n in used if n not in ("read_file", "ls", "task")]
        checks[id] = {
            "error": last["error"],
            "facts_found": len(case["key_facts"]) - len(missing), "facts_total": len(case["key_facts"]), "missing": missing,
            "must_not": hits,
            "tools_used": used, "tools_failed": failed,
            "tools_ok": (not case["tools_expected"]) or any(x in used for x in case["tools_expected"]),
            "engine_calls": len(engine),
            # With a line written before a lookup ("let me check"), the answer itself starts later.
            "first_text": last["first_text"], "answer_start": last.get("final_text_start") or last["first_text"],
            "extra_messages": max(0, (last.get("messages_written") or 1) - 1), "total": last["total"],
            "model_calls": sum(len((x["usage"] or {}).get("calls", [])) for x in result["turns"]),
            "tokens_in": sum((x["usage"] or {}).get("input", 0) for x in result["turns"]),
            "tokens_out": sum((x["usage"] or {}).get("output", 0) for x in result["turns"]),
            "reasoning": sum(c["reasoning"] for x in result["turns"] for c in (x["usage"] or {}).get("calls", [])),
            "cost_usd": round(sum(cost(x["usage"], price) for x in result["turns"]) / len(result["turns"]), 6),
            "models": sorted({str(c["model"]) for x in result["turns"] for c in (x["usage"] or {}).get("calls", [])}),
            "style": style(case, text),
            **({"sinhala": sinhala.signs(text)} if case["answer_lang"] == "si" else {}),
        }
        if s := result.get("suggest"):
            checks[id]["suggest"] = {"total": s["total"], "chips": s["chips"], "error": s["error"], "cost_usd": round(cost(s["usage"], price), 6)}
            chips_in.append({"chips": [{"title": c, "message": c} for c in s["chips"]], "context": read_json(CONTEXTS / f"{case['context']}.json")})
            chip_ids.append(id)
    if chips_in:
        # The browser's own filter (frontend/lib/assistant/followups.ts).
        with tempfile.TemporaryDirectory() as tmp:
            src, dst = Path(tmp) / "in.json", Path(tmp) / "out.json"
            src.write_text(json.dumps(chips_in, ensure_ascii=False), encoding="utf-8")
            subprocess.run(["node", str(EVAL_ROOT / "build_contexts.mjs"), "followups", str(src), str(dst)], check=True)
            for id, kept in zip(chip_ids, read_json(dst), strict=True):
                checks[id]["suggest"]["kept_by_site"] = kept
    write_json(folder / "checks.json", checks)

    lines = [f"# Review pack: {a.label}", ""]
    for id, c in checks.items():
        case, result = cases[id], run["answers"][id]
        lines += [f"## {id}", "", f"Page: `{case['context']}`. Topic: {case['topic']}. Answer language: {case['answer_lang']}.", "",
                  f"**Ground truth.** {case['gt_answer']}", "", "**Rubric.** " + "; ".join(case["rubric"]) + ".", ""]
        for turn in result["turns"]:
            if turn.get("question"):
                lines += [f"**Asked.** {turn['question']}", ""]
            lines += [f"**Answer** (first words {turn['first_text']}s, done {turn['total']}s)", "", *("> " + x for x in turn["text"].split("\n")), ""]
        lines += [f"**Checks.** facts {c['facts_found']}/{c['facts_total']}; missing {c['missing']}; must-not {c['must_not']}; style {c['style']}; tools {c['tools_used']}; failed {c['tools_failed']}", ""]
        if "suggest" in c:
            lines += [f"**Follow-up buttons** ({c['suggest']['total']}s): {c['suggest']['chips']} kept by the site: {c['suggest'].get('kept_by_site')}", ""]
    (folder / "review.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print("wrote", folder / "checks.json", "and review.md;", len(checks), "answers")


if __name__ == "__main__":
    main()
