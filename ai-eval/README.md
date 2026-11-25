# AI evaluation

Checks how well Astro answers, and how that changes with the model. Nothing in `agent/`, `backend/` or `frontend/` is changed or copied: the scripts start and call the real code.

| File | What it does |
|---|---|
| `1_build_contexts.py`, `build_contexts.mjs` | Made-up people: results from the backend, turned by the website's own code into what the AI sees (`data/contexts/`) |
| `2_build_ground_truth.py` | 58 questions (50 chat, 8 written chapters; English, Sinhala, Singlish) with facts from the engine and behaviour from the project's rules (`data/ground_truth.json`) |
| `2b_holdout.py` | Unseen questions, to check that a change helps in general (`holdout`, `holdout2`) |
| `2c_sinhala.py` | 15 Sinhala questions for fluency (`sinhala`) |
| `serve.py` | Starts the real agent service, with the date fixed and a meter around it |
| `3_run.py` | Asks every question over HTTP, as the website does. Saves answers, times, tokens, tool calls |
| `4_check.py` | Automatic checks, and `review.md` for the reviewer |
| `RUBRIC.md` | How Claude marks each answer, into `judgement.json` |
| `5_report.py` | The numbers, for one run or several side by side |

Each run is in `results/<label>/`, and every run is also kept for good in [`results/history/`](results/history/index.md). The model comparison: [`results/REPORT.md`](results/REPORT.md). The findings on the system before the fixes: [`results/current/REPORT.md`](results/current/REPORT.md).

## Run it

The agent's packages must be installed (`uv sync` in `agent/`) and `OPENAI_API_KEY` set. Start the backend on port 8010 from `backend/` (on Windows, set `WEASYPRINT_DLL_DIRECTORIES` first), then from this folder with the agent's Python:

```
../agent/.venv/Scripts/python 3_run.py --label current
../agent/.venv/Scripts/python 4_check.py --label current
```

Claude then reads `results/current/review.md` and writes `judgement.json`, and:

```
../agent/.venv/Scripts/python 5_report.py current
```

Steps 1 and 2 only need to run again when the site's facts or rules change. Use the same `ground_truth.json` for every model you compare.

## Another model

```
../agent/.venv/Scripts/python 3_run.py --label <name> --model openai:<model> --effort low
../agent/.venv/Scripts/python 5_report.py current <name>
```

From OpenRouter, with the key in `OPENROUTER_API_KEY` (never in a file here):

```
../agent/.venv/Scripts/python 3_run.py --label <name> --openrouter <provider/model>
../agent/.venv/Scripts/python 3_run.py --label sinhala/<name> --cases sinhala --openrouter <provider/model>
```

A provider other than OpenAI needs its package and key: add `--with langchain-anthropic`, for example. Put a model's prices in `prices.json` (see `4_check.py`), or the cost uses the prices of the present model.
