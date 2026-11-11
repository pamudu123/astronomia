# Astronomia

A website for **hadahan** (Sri Lankan birth charts) and **porondam** (marriage matching), in Sinhala and English, for births anywhere in the world.

- Planning: [`docs/`](docs/README.md). The build plan is [`docs/08-implementation-plan.md`](docs/08-implementation-plan.md).
- Design and artwork: [`design/`](design/README.md).

## Layout

| Folder | What it is |
|---|---|
| `backend/` | Python 3.12+ API (FastAPI). Calculation engine, rules, reports |
| `frontend/` | Next.js website (TypeScript). Pages in `si` and `en` |
| `design/` | Artwork and the scripts that prepare it for the web |
| `docs/` | Research and plans |

## Run it locally

You need Python 3.12 or newer with [uv](https://docs.astral.sh/uv/), and Node 22.

**Backend** (http://localhost:8000, API docs at `/docs`):

```
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

**Frontend** (http://localhost:3000):

```
cd frontend
npm install
npm run dev
```

The frontend forwards `/api/*` to the backend at `BACKEND_URL` (default `http://localhost:8000`).

**Both with Docker:** `docker compose up --build`

## Checks

| | Backend (`backend/`) | Frontend (`frontend/`) |
|---|---|---|
| Lint | `uv run ruff check .` | `npm run lint` |
| Types | `uv run mypy app tests scripts` | `npm run typecheck` |
| Tests | `uv run pytest` | `npm test`, then `npx playwright test` after `npm run build` |

When the API changes, run `uv run python scripts/export_openapi.py` in `backend/`, then `npm run gen:types` in `frontend/`. CI fails if either file is out of date.

## Data credits

Place data © [GeoNames](https://www.geonames.org), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See [`backend/app/data/README.md`](backend/app/data/README.md).

Planet positions come from [Swiss Ephemeris](https://www.astro.com/swisseph/) through `pyswisseph`, used under the AGPL for now. A commercial licence will be bought, or the code published, before public launch (see `docs/06-release-plan.md`).
