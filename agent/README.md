# Agent

The AI assistant behind the chat on the website. A [Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview) agent served over [AG-UI](https://docs.ag-ui.com) for the frontend's CopilotKit chat. The plan is in [`docs/14-ai-assistant-plan.md`](../docs/14-ai-assistant-plan.md).

The rule: **the AI talks, the engine calculates.** Facts come from the page the person is looking at, or from the backend API through tools. The model never works anything out itself.

## Layout

| Path | What it is | Change it when |
|---|---|---|
| `app/prompts/guide.md` | Who the assistant is and the rules for every answer. Always loaded | The tone or a rule for every answer changes |
| `skills/<name>/SKILL.md` | Guidance for one topic. The agent sees the one-line description and reads the file only when the topic comes up | Adding a topic: add a folder. No code change |
| `app/tools/engine.py` | Tools that call the backend API | The assistant needs a new kind of fact |
| `app/graph.py` | Puts the agent together: model, skills, tools, page context | Turning on a Deep Agents feature (subagents, memory, ...) |
| `app/main.py` | The web service: `POST /agent` (AG-UI), `GET /healthz` | Rarely |

**Adding a skill:** create `skills/<name>/SKILL.md` with frontmatter (`name` the same as the folder, and a `description` that says when to use it), then the instructions. `uv run pytest` checks the format.

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

Each page tells the assistant what it shows with `useAssistantContext(...)` (`frontend/components/assistant/PageContext.tsx`). The summary is built in `frontend/lib/assistant/context.ts` and holds no names, birth dates, times or places.

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
