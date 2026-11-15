# Agent

The AI assistant behind the chat on the website. A [Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview) agent served over [AG-UI](https://docs.ag-ui.com) for the frontend's CopilotKit chat. The plan is in [`docs/14-ai-assistant-plan.md`](../docs/14-ai-assistant-plan.md).

The rule: **the AI talks, the engine calculates.** Facts come from the page the person is looking at, or from the backend API through tools. Background (what a word or a custom means) comes from the skills' reference notes. The model never works anything out itself.

## Layout

| Path | What it is | Change it when |
|---|---|---|
| `app/prompts/guide.md` | Who the assistant is and the rules for every answer. Always loaded | The tone or a rule for every answer changes |
| `skills/<name>/SKILL.md` | Guidance for one topic. The agent sees the one-line description and reads the file only when the topic comes up | Adding a topic: add a folder. No code change |
| `skills/<name>/reference.md` | Longer background notes for a topic, with sources. Read only when the SKILL.md isn't enough | The facts or sources change |
| `app/tools/` | Tools that call the backend's public endpoints, one module per topic: `porondam`, `calendar`, `naming`, `planets`. `engine.py` is the shared client | The assistant needs a new kind of fact |
| `app/subagents.py`, `app/prompts/<helper>.md` | Helpers the guide hands work to with the `task` tool: `researcher` (several reference notes) and `date-checker` (several dates or places, one helper each) | A kind of question keeps crowding the conversation |
| `app/graph.py` | Puts the agent together: model, skills, tools, helpers, page context, the cap on helpers per question | Turning on a Deep Agents feature (memory, approvals, ...) |
| `app/main.py` | The web service: `POST /agent` (AG-UI), `GET /healthz` | Rarely |

**Skills now:** `site-guide` (every page and how to read it), `explain-match`, `star-matches`, `birth-chart`, `calendar-and-nakath`, `avurudu`, `ceremonies-and-names`, `sinhala-style`.

**Adding a skill:** create `skills/<name>/SKILL.md` with frontmatter (`name` the same as the folder, and a `description` that says when to use it), then the instructions. Put long background in `reference.md` beside it and point to it from the SKILL.md. `uv run pytest` checks the format.

**Reference notes** were researched on the web in November 2026. Each section lists its sources; points that couldn't be confirmed are marked "(unverified)". They describe tradition and belief, never proven fact. Ask an astrologer and a Sinhala reader to review them before launch.

**Helpers cost extra model calls.** One question can start at most `ASTRONOMIA_AGENT_MAX_SUBAGENT_CALLS` (default 4). Set it to 0 to switch helpers off.

## Run it locally

You need Python 3.12 or newer with [uv](https://docs.astral.sh/uv/), and an OpenAI API key.

```
cd agent
cp .env.example .env      # then put your key in .env
uv sync
uv run uvicorn app.main:create_app --factory --port 8123
```

The backend should run too (http://localhost:8000), for the engine tools. The website's chat is off until the frontend has `AGENT_URL=http://localhost:8123/agent` (in `frontend/.env.local` for local runs).

## How the chat reaches the agent

```
Browser (CopilotKit popup, components/assistant/)
  -> POST /api/copilotkit   Next.js route, CopilotKit runtime, single-endpoint mode
  -> POST /agent            this service, AG-UI stream
  -> backend API            engine tools
```

Each page tells the assistant what it shows with `useAssistantContext(...)` (`frontend/components/assistant/PageContext.tsx`). The summaries are built in `frontend/lib/assistant/context.ts` (match) and `frontend/lib/assistant/pages.ts` (every other result) and hold no names, birth dates, times or places. Pages whose address already says what they show (a month, a sign, a planet change) send only the address; the `site-guide` skill tells the assistant which tool gives the same facts.

## Checks

```
uv run ruff check . && uv run ruff format --check .
uv run mypy app tests
uv run pytest
```

The tests use a stand-in model, so they need no key and no network.

## Settings

All settings have local defaults. See `.env.example`. The model is a setting (`ASTRONOMIA_AGENT_MODEL`, default `openai:gpt-6-luna`), so changing it needs no code change. OpenAI is called through the Responses API with `store=False`, so OpenAI keeps no copy of conversations.

## Deploy

Staging runs the `Dockerfile` on Render as `astronomia-agent` (see `render.yaml`). The settings come from the host's environment; `.env` never goes into the image. How to turn the chat on, and the settings each host needs, are in [`docs/09-launch.md`](../docs/09-launch.md).

To try the image locally:

```
docker build -t astronomia-agent .
docker run --rm -p 8123:8123 --env-file .env \
  -e ASTRONOMIA_AGENT_BACKEND_URL=http://host.docker.internal:8000 astronomia-agent
```
