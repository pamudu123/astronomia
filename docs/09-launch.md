# Launch runbook

How the site is hosted, how staging is kept private, and what is left before it goes public.

## Where it runs

| Part | Host | Plan now | Defined in |
|---|---|---|---|
| Frontend (Next.js) | Vercel, project `astronomia`, region Singapore (`sin1`) | Hobby (free) | `frontend/vercel.json`, Vercel settings |
| Backend (FastAPI, Docker) | Render, web service `astronomia-api`, Singapore | Free | `render.yaml`, `backend/Dockerfile` |
| Database (share links) | Render PostgreSQL `astronomia-db`, Singapore | Free | `render.yaml` |

Both deploy automatically from `main`. The frontend sends `/api/*` to the backend, so the browser
only ever talks to one site.

## Environment variables

Backend (Render):

| Variable | Meaning |
|---|---|
| `ASTRONOMIA_ENVIRONMENT` | `staging` or `production` |
| `ASTRONOMIA_DATABASE_URL` | PostgreSQL for share links. Without it, SQLite under `backend/var/` is used |
| `ASTRONOMIA_ACCESS_KEY` | When set, every request except `/healthz` needs it in `X-Access-Key`. Keeps staging private |
| `ASTRONOMIA_SHARE_DAYS` | How long a share link stays open. Default 30 |
| `PORT` | Set by Render. Default 8000 |

Frontend (Vercel):

| Variable | Meaning |
|---|---|
| `BACKEND_URL` | The backend's address, for example `https://astronomia-api.onrender.com` |
| `BACKEND_ACCESS_KEY` | The same value as `ASTRONOMIA_ACCESS_KEY`. Added to every forwarded call |
| `SITE_URL` | The site's own address, used in link previews |
| `STAGING_PASSWORD` | When set, the whole site asks for this password and is not indexed |

Secrets (`*_ACCESS_KEY`, `STAGING_PASSWORD`) are set only in the host dashboards, never in the
repository. Changing a Vercel variable needs a redeploy.

## How staging is kept private

Until the ephemeris licence is settled (see docs/06, section 4), the site must not be public.
Two locks keep it private:

1. **The site** asks for a password (any user name, the `STAGING_PASSWORD`) on every page and API
   call (`frontend/proxy.ts`). Pages carry `X-Robots-Tag: noindex` and `robots.txt` disallows
   everything.
2. **The backend** refuses any request without the access key (`backend/app/security.py`), so
   its own address is no way in either. Only `/healthz` is open, for Render's health check.

## Deploy and roll back

- **Deploy:** merge to `main`. Render and Vercel both build and release it.
- **Roll back:** in Vercel, promote the previous deployment. In Render, open the service, then
  Events, and roll back to the previous deploy.
- **Health:** `GET /healthz` on the backend returns `{"status": "ok"}`.
- **The backend image** is built and smoke tested in CI (the `image` job in
  `.github/workflows/backend.yml`): it starts the container and checks a chart and a PDF.

## Free plan limits

- The free backend sleeps after about 15 minutes without visits. The next visit waits about a
  minute while it wakes.
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
