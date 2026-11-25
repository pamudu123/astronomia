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
| `app/suggest.py`, `app/prompts/suggest.md` | The follow-up questions under each answer, written in the person's own voice ("What does my Rajju result mean?"). One model call, no tools, served at `POST /agent/suggest` | The suggestions' wording or rules change |
| `app/usage.py` | Chat limits (`docs/21-chat-limits.md`): runs only questions the backend allowed, measures every model call's tokens and reports their cost. On when `ASTRONOMIA_AGENT_CHAT_KEY` is set | The limits' flow or the cost measuring changes |
| `app/wire.py` | What a run streams to the browser: engine results in full, a short note in place of a skill file's text, no state. Keeps the request the chat sends back small, since the website refuses one over 500 KB | A tool's result should stay out of the browser |
| `app/main.py` | The web service: `POST /agent` (AG-UI), `POST /agent/suggest`, `GET /healthz` | Rarely |

**Skills now:** `site-guide` (every page and how to read it), `personal-reading` (a human astrologer-style reading of the person's own chart: life areas, life periods, the years ahead), `explain-match`, `star-matches`, `birth-chart`, `calendar-and-nakath`, `avurudu`, `ceremonies-and-names`, `sinhala-style`.

**Personal readings.** The guide prompt keeps the facts apart from the interpretation. Facts (placements, dates, periods) come only from the chart on screen or a tool. What a placement traditionally means comes from `skills/personal-reading/reference.md`, which includes a lookup of who rules each house for each rising sign, so the model reads a table instead of counting signs (`tests/test_skills.py` recomputes that table). Future talk is framed as possibilities and windows. The chart page also sends ready-made reading facts, built in `frontend/lib/assistant/chartFacts.ts` from the engine's signs and houses: each house's ruler and where it sits, the classical aspects, planet strength and vargottama, a few well-known yogas, and the sub-periods of the running life period. The match page sends the reason behind every factor, agreeing or not, and `skills/explain-match/reference.md` explains each factor in everyday words and groups them into four themes. Hard subjects (illness, relationship strain, money trouble, hard periods, remedies) are answered honestly as possibilities, from chart pointers listed in the reference (section 13), with a human astrologer for the full picture. The limits that stay in the guide: death and lifespan are never named or hinted at (a "period calling for extra care with health and safety" is the most it says), no named disease or diagnosis, no final yes or no on a marriage, no investment or legal advice, no remedy presented as required or sold, no exact dates and no calculated positions or dates.

**Adding a skill:** create `skills/<name>/SKILL.md` with frontmatter (`name` the same as the folder, and a `description` that says when to use it), then the instructions. Put long background in `reference.md` beside it and point to it from the SKILL.md. `uv run pytest` checks the format.

**Reference notes** were researched on the web in November 2026. Each section lists its sources; points that couldn't be confirmed are marked "(unverified)". They describe tradition and belief, never proven fact. Ask an astrologer and a Sinhala reader to review them before launch.

**Helpers cost extra model calls.** One question can start at most `ASTRONOMIA_AGENT_MAX_SUBAGENT_CALLS` (default 4). Set it to 0 to switch helpers off.

**Conversations are deleted after 30 idle minutes.** The service keeps each chat in memory so the guide remembers earlier messages, and deletes it once nobody has used it for `ASTRONOMIA_AGENT_CONVERSATION_IDLE_MINUTES` (default 30), checked on every request and once a minute (`app/memory.py`). The next message on that chat starts afresh. The website starts a new chat after the same time (`frontend/lib/assistant/idle.ts`), and the privacy notice states the number: change all three together.

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
Browser (Astro, a CopilotKit side panel, components/assistant/)
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
