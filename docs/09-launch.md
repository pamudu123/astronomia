# Launch runbook

How the site is hosted, how staging is kept private, and what is left before it goes public.

## Where it runs

| Part | Host | Plan now | Defined in |
|---|---|---|---|
| Frontend (Next.js) | Vercel, project `astronomia`, region Singapore (`sin1`) | Hobby (free) | `frontend/vercel.json`, Vercel settings |
| Backend (FastAPI, Docker) | Render, web service `astronomia-api`, Singapore | Free | `render.yaml`, `backend/Dockerfile` |
| Database (share links) | Render PostgreSQL `astronomia-db`, Singapore | Free | `render.yaml` |
| AI assistant (FastAPI, Docker) | Render, web service `astronomia-agent`, Singapore | Free | `render.yaml`, `agent/Dockerfile` |

All deploy automatically from `main`. The frontend sends `/api/*` to the backend, and the chat's
`/api/copilotkit` to the assistant, so the browser only ever talks to one site.

## Environment variables

Backend (Render):

| Variable | Meaning |
|---|---|
| `ASTRONOMIA_ENVIRONMENT` | `staging` or `production` |
| `ASTRONOMIA_DATABASE_URL` | PostgreSQL for share links and saved reports. Without it, SQLite under `backend/var/` is used. **Required when `ASTRONOMIA_ENVIRONMENT` is `production`**: the backend refuses to start without it |
| `ASTRONOMIA_SITE_ORIGINS` | Optional. The site's own addresses as a JSON list, for example `["https://sidera.lk"]`. Saving, renaming and deleting are refused from any other page. When empty, the address the request was forwarded from is used |
| `ASTRONOMIA_ACCESS_KEY` | When set, every request except `/healthz` needs it in `X-Access-Key`. Keeps staging private |
| `ASTRONOMIA_SHARE_DAYS` | How long a share link stays open. Default 30 |
| `PORT` | Set by Render. Default 8000 |

AI assistant (Render):

| Variable | Meaning |
|---|---|
| `OPENAI_API_KEY` | The OpenAI key. Set in the dashboard |
| `ASTRONOMIA_AGENT_ACCESS_KEY` | Render makes a random one. Every request except `/healthz` needs it in `X-Access-Key` |
| `ASTRONOMIA_AGENT_BACKEND_URL` | The backend's public address, the same as `BACKEND_URL`. Set in `render.yaml` |
| `ASTRONOMIA_AGENT_BACKEND_ACCESS_KEY` | Copied by Render from the backend's `ASTRONOMIA_ACCESS_KEY` |
| `ASTRONOMIA_AGENT_MODEL` | Optional. Default `openai:gpt-6-luna` |
| `PORT` | Set by Render. Default 8123 |

Frontend (Vercel):

| Variable | Meaning |
|---|---|
| `BACKEND_URL` | The backend's address, for example `https://astronomia-api.onrender.com` |
| `BACKEND_ACCESS_KEY` | The same value as `ASTRONOMIA_ACCESS_KEY`. Added to every forwarded call |
| `SITE_URL` | The site's own address, used in link previews |
| `STAGING_PASSWORD` | When set, the whole site asks for this password and is not indexed |
| `AGENT_URL` | The assistant's address plus `/agent`, for example `https://astronomia-agent.onrender.com/agent`. The chat appears only when it is set: it is the chat's off switch |
| `AGENT_ACCESS_KEY` | The same value as `ASTRONOMIA_AGENT_ACCESS_KEY` |

Secrets (`*_ACCESS_KEY`, `OPENAI_API_KEY`, `STAGING_PASSWORD`) are set only in the host
dashboards, never in the repository. Changing a Vercel variable needs a redeploy. `AGENT_URL` is
read when the site is built, so it needs a redeploy to take effect.

## How staging is kept private

Until the ephemeris licence is settled (see docs/06, section 4), the site must not be public.
Three locks keep it private:

1. **The site** asks for a password (any user name, the `STAGING_PASSWORD`) on every page and API
   call (`frontend/proxy.ts`), the chat included. Pages carry `X-Robots-Tag: noindex` and
   `robots.txt` disallows everything.
2. **The backend** refuses any request without the access key (`backend/app/security.py`), so
   its own address is no way in either. Only `/healthz` is open, for Render's health check.
3. **The AI assistant** does the same with its own key (`agent/app/security.py`). Only the
   site's chat route has it, so nobody can use the OpenAI key by calling the assistant directly.

## Turning on the chat

1. Merge to `main`. Render reads `render.yaml` and adds the `astronomia-agent` service. If it
   doesn't appear, sync the blueprint by hand in Render.
2. In Render, set `OPENAI_API_KEY` on the agent service (the only value marked `sync: false`).
   Check that `https://<agent address>/healthz` answers. Render adds a random suffix to the
   address, as it did for the backend (`astronomia-api-njxu`).
3. In Vercel, set `AGENT_URL` (`https://<agent address>/agent`) and `AGENT_ACCESS_KEY` (copy
   `ASTRONOMIA_AGENT_ACCESS_KEY` from Render), then redeploy.
4. Open the site, then the gold chat button.

To turn it off, remove `AGENT_URL` in Vercel and redeploy. The chat has no usage limits yet, so
on staging only people with the staging password can use it (docs/14, section 11).

## Deploy and roll back

- **Deploy:** merge to `main`. Render and Vercel both build and release it.
- **Roll back:** in Vercel, promote the previous deployment. In Render, open the service, then
  Events, and roll back to the previous deploy.
- **Health:** `GET /healthz` on the backend and on the assistant returns `{"status": "ok"}`.
- **The backend image** is built and smoke tested in CI (the `image` job in
  `.github/workflows/backend.yml`): it starts the container and checks a chart and a PDF.
- **The assistant image** is built and started in CI too (the `image` job in
  `.github/workflows/agent.yml`), with a stand-in key, and must keep its access key lock.

## Free plan limits

- The free backend sleeps after about 15 minutes without visits. The next visit waits about a
  minute while it wakes. The assistant sleeps the same way: the first chat message after a quiet
  spell can take up to a minute, or fail and need sending again. Its conversations are kept in
  memory, so they are lost each time it sleeps.
- The free PostgreSQL is deleted 30 days after it is created, with its share links. It has no
  backups.
- Fine for staging. Production needs paid plans (see below).

## Before going public

| Item | Who | Notes |
|---|---|---|
| Ephemeris licence: buy it, or publish the backend under AGPL | Owner | Blocks launch |
| Domain name | Owner | Then add it in Vercel and set `SITE_URL` |
| Paid plans: backend (no sleep) and PostgreSQL (kept, with backups) | Owner | Render Starter plans |
| Error monitoring | Owner, then build | Must be set up so no birth details or names are sent |
| Privacy and terms pages: legal review, contact address | Owner | Both pages are marked as drafts |
| Astrologer review of rules and golden charts | Owner | Steps 3 and 20 in docs/08 |
| Sinhala wording review | Owner | All label and message files |
| Remove `STAGING_PASSWORD`, and keep the backend reachable only through the site | Build | Only after the licence is settled |
| Chat: usage limits, bot protection and lasting conversation storage | Build | Before the chat is on without the staging password (docs/14, section 11) |
