"""Step 3: asks the real system every question and saves what it answered and how long it took.

    python 3_run.py --label current                         the system as it is now
    python 3_run.py --label mini --model openai:gpt-x-mini  another model, no code change
    python 3_run.py --label x --only rahu-today,chart-career

The agent service is started for the run (serve.py) and stopped at the end. Answers already in
the results file are kept, so a stopped run can be carried on; --fresh starts over.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import uuid
from typing import Any

import httpx
from evalkit.common import (
    AGENT_PORT, BACKEND_URL, CONTEXTS, DATA, EVAL_ROOT, RESULTS, read_json, write_json,
)
from evalkit import history

AGENT_URL = f"http://localhost:{AGENT_PORT}"
# The website's route gives up after this long (frontend/app/api/copilotkit/route.ts, maxDuration).
SITE_LIMIT = 60
META = read_json(CONTEXTS / "meta.json")
# As CopilotKit sends it (@copilotkit/core, SUGGEST_TOOL).
SUGGEST_TOOL = {
    "name": "copilotkitSuggest",
    "description": "Suggest what the user could say next",
    "parameters": {
        "type": "object",
        "properties": {"suggestions": {
            "type": "array", "description": "List of suggestions shown to the user as buttons.",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "The title of the suggestion. This is shown as a button and should be short."},
                    "message": {"type": "string", "description": "The message to send when the suggestion is clicked. This should be a clear, complete sentence and will be sent as an instruction to the AI."},
                },
                "required": ["title", "message"],
            },
        }},
        "required": ["suggestions"],
    },
}


def context_items(page: Any) -> list[dict[str, str]]:
    return [{"description": META["context_description"], "value": json.dumps(page, ensure_ascii=False)}]


def run_agent(http: httpx.Client, path: str, thread: str, messages: list[Any], page: Any, tools: list[Any], props: Any = None) -> dict[str, Any]:
    """One AG-UI run. Times are seconds from sending, as the person would wait."""
    eval_id = uuid.uuid4().hex
    body = {
        "threadId": thread, "runId": uuid.uuid4().hex, "state": {}, "messages": messages,
        "tools": tools, "context": context_items(page), "forwardedProps": props or {},
    }
    out: dict[str, Any] = {"text": "", "first_event": None, "first_text": None, "final_text_start": None, "tool_args": {}, "error": None}
    order: list[str] = []
    texts: dict[str, str] = {}
    started: dict[str, float] = {}
    args: dict[str, str] = {}
    start = time.perf_counter()
    try:
        with http.stream("POST", path, json=body, headers={"X-Eval-Id": eval_id, "Accept": "text/event-stream"}) as r:
            if r.status_code != 200:
                r.read()
                out["error"] = f"{r.status_code}: {r.text[:300]}"
            for line in r.iter_lines():
                if not line.startswith("data:"):
                    continue
                event = json.loads(line[5:])
                now = round(time.perf_counter() - start, 2)
                kind = event["type"]
                out["first_event"] = out["first_event"] or now
                if kind == "TEXT_MESSAGE_CONTENT" and event["delta"]:
                    mid = event["messageId"]
                    if mid not in texts:
                        order.append(mid)
                        texts[mid] = ""
                        started[mid] = now
                    texts[mid] += event["delta"]
                    out["first_text"] = out["first_text"] or now
                elif kind == "TOOL_CALL_START":
                    args[event["toolCallId"]] = ""
                    out["tool_args"][event["toolCallId"]] = event["toolCallName"]
                elif kind == "TOOL_CALL_ARGS":
                    args[event["toolCallId"]] = args.get(event["toolCallId"], "") + event["delta"]
                elif kind == "RUN_ERROR":
                    out["error"] = event.get("message", "run error")
    except httpx.HTTPError as error:
        out["error"] = f"{type(error).__name__}: {error}"
    out["total"] = round(time.perf_counter() - start, 2)
    out["tool_calls"] = [{"name": n, "args": args.get(i, "")} for i, n in out.pop("tool_args").items()]
    out["messages_written"] = len(order)
    out["text"] = "\n\n".join(texts[m] for m in order).strip()
    out["final_text_start"] = started[order[-1]] if order else None
    out["usage"] = http.get(f"/eval/usage/{eval_id}").json()
    return out


def run_explain(http: httpx.Client, case: dict[str, Any], page: Any) -> dict[str, Any]:
    eval_id = uuid.uuid4().hex
    body = {"id": case["chapter"], "language": case["lang"], "facts": page}
    out: dict[str, Any] = {"text": "", "first_text": None, "error": None, "tool_calls": []}
    start = time.perf_counter()
    try:
        with http.stream("POST", "/agent/explain", json=body, headers={"X-Eval-Id": eval_id}) as r:
            if r.status_code != 200:
                r.read()
                out["error"] = f"{r.status_code}: {r.text[:300]}"
            else:
                for chunk in r.iter_text():
                    if chunk:
                        out["first_text"] = out["first_text"] or round(time.perf_counter() - start, 2)
                        out["text"] += chunk
    except httpx.HTTPError as error:
        out["error"] = f"{type(error).__name__}: {error}"
    out["total"] = round(time.perf_counter() - start, 2)
    out["usage"] = http.get(f"/eval/usage/{eval_id}").json()
    return out


def run_case(http: httpx.Client, case: dict[str, Any]) -> dict[str, Any]:
    page = read_json(CONTEXTS / f"{case['context']}.json")
    if case["kind"] == "explain":
        return {"turns": [run_explain(http, case, page)]}
    thread, messages, turns = uuid.uuid4().hex, [], []
    for question in case["turns"]:
        messages.append({"id": uuid.uuid4().hex, "role": "user", "content": question})
        turn = run_agent(http, "/agent", thread, messages, page, [])
        turns.append({"question": question, **turn})
        messages.append({"id": uuid.uuid4().hex, "role": "assistant", "content": turn["text"]})
        if turn["error"]:
            break
    result: dict[str, Any] = {"turns": turns}
    if case["suggest"] and not turns[-1]["error"]:
        # The same words CopilotKit puts round the site's own instructions.
        ask = "\n".join([
            "Suggest what the user could say next. Provide clear, highly relevant suggestions by calling the `copilotkitSuggest` tool.",
            "Provide at least 0 and at most 3 suggestions.",
            "The user has the following tools available: [].",
            f" {META['followups'][case['lang']]}",
        ])
        thread2 = uuid.uuid4().hex
        s = run_agent(http, "/agent/suggest", thread2, [*messages, {"id": thread2, "role": "user", "content": ask}], page, [SUGGEST_TOOL],
                      {"toolChoice": {"type": "function", "function": {"name": "copilotkitSuggest"}}})
        chips: list[str] = []
        for call in s["tool_calls"]:
            try:
                chips = [c["message"] for c in json.loads(call["args"])["suggestions"]]
            except (ValueError, KeyError):
                s["error"] = f"bad suggestion call: {call['args'][:200]}"
        result["suggest"] = {"chips": chips, "total": s["total"], "usage": s["usage"], "error": s["error"]}
    return result


def wait(url: str, seconds: int, what: str, process: subprocess.Popen[bytes] | None = None) -> None:
    end = time.time() + seconds
    while time.time() < end:
        if process and process.poll() is not None:
            sys.exit(f"{what} stopped while starting; see the log")
        try:
            if httpx.get(url, timeout=3).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    sys.exit(f"{what} is not answering at {url}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--label", required=True, help="a name for this run: results/<label>/")
    p.add_argument("--model", help="provider:model; default: the system's own setting")
    p.add_argument("--effort", choices=["minimal", "low", "medium", "high"])
    p.add_argument("--cases", default="ground_truth", help="ground_truth or holdout")
    p.add_argument("--only", help="case ids, separated by commas")
    p.add_argument("--fresh", action="store_true")
    p.add_argument("--openrouter", help="a model id from OpenRouter, e.g. anthropic/claude-haiku-5.5; the key is read from OPENROUTER_API_KEY")
    p.add_argument("--openrouter-effort", default="none", help="none (no thinking), low, medium or high")
    p.add_argument("--with", dest="extra", action="append", default=[], help="an extra package for another provider, e.g. langchain-anthropic")
    a = p.parse_args()

    wait(f"{BACKEND_URL}/v1/meta", 5, "The backend")
    out_dir = RESULTS / a.label
    out_dir.mkdir(parents=True, exist_ok=True)
    file = out_dir / "answers.json"
    done: dict[str, Any] = read_json(file)["answers"] if file.exists() and not a.fresh else {}

    # A clean set of settings: the system's defaults, plus what this run changes.
    env = {k: v for k, v in os.environ.items() if not k.startswith("ASTRONOMIA_AGENT_")}
    env |= {"ASTRONOMIA_AGENT_BACKEND_URL": BACKEND_URL, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1", "COPILOTKIT_TELEMETRY_DISABLED": "true", "LANGSMITH_TRACING": "false"}
    if a.model:
        env["ASTRONOMIA_AGENT_MODEL"] = a.model
    if a.effort:
        env["ASTRONOMIA_AGENT_REASONING_EFFORT"] = a.effort
    if a.openrouter:
        if not os.environ.get("OPENROUTER_API_KEY"):
            sys.exit("set OPENROUTER_API_KEY")
        # "openai:" because it is spoken to with the OpenAI client (serve.py); Deep Agents looks
        # its settings up by this name.
        env |= {"ASTRONOMIA_AGENT_MODEL": f"openai:{a.openrouter}", "EVAL_OPENROUTER_KEY": os.environ["OPENROUTER_API_KEY"], "EVAL_OPENROUTER_EFFORT": a.openrouter_effort}
        env.pop("OPENAI_API_KEY", None)
    command = [sys.executable, str(EVAL_ROOT / "serve.py")]
    if a.extra:
        withs = [x for pkg in a.extra for x in ("--with", pkg)]
        command = ["uv", "run", "--project", str(EVAL_ROOT.parent / "agent"), "--frozen", "--no-dev", *withs, "python", str(EVAL_ROOT / "serve.py")]
    log = (out_dir / "agent.log").open("ab")
    asked: dict[str, Any] = {}
    state = history.code_state()
    agent = subprocess.Popen(command, env=env, stdout=log, stderr=log)
    try:
        wait(f"{AGENT_URL}/healthz", 120, "The agent", agent)
        cases = read_json(DATA / f"{a.cases}.json")["cases"]
        only = set(a.only.split(",")) if a.only else None
        http = httpx.Client(base_url=AGENT_URL, timeout=httpx.Timeout(180))
        # Not counted: the first call opens the connections and loads the skills.
        run_agent(http, "/agent", uuid.uuid4().hex, [{"id": "w", "role": "user", "content": "Hello"}], read_json(CONTEXTS / "chat-home-en.json"), [])
        for n, case in enumerate(cases, 1):
            if (only and case["id"] not in only) or (case["id"] in done and not only):
                continue
            result = run_case(http, case)
            done[case["id"]] = asked[case["id"]] = result
            last = result["turns"][-1]
            print(f"[{n}/{len(cases)}] {case['id']:24} first {last['first_text']}s total {last['total']}s {last['error'] or ''}", flush=True)
            write_json(file, {"label": a.label, "model": a.openrouter or a.model or "default", "effort": a.openrouter_effort if a.openrouter else a.effort or "default", "site_limit_seconds": SITE_LIMIT, "answers": done})
    finally:
        agent.terminate()
        if asked:
            # Kept for good, also when the run was stopped half way.
            effort = a.openrouter_effort if a.openrouter else a.effort or "low (default)"
            kept = history.save(a.label, a.openrouter or a.model or "gpt-6-luna (default)", effort, a.cases, asked, state=state)
            print("saved in", kept.relative_to(EVAL_ROOT))


if __name__ == "__main__":
    main()
