# Launch runbook

How the site is hosted, how staging is kept private, and what is left before it goes public.

## Where it runs

| Part | Host | Plan now | Defined in |
|---|---|---|---|
| Frontend (Next.js) | Vercel, project `astronomia`, region Singapore (`sin1`), at `https://sidera.ppwrks.com` | Hobby (free) | `frontend/vercel.json`, Vercel settings |
| Backend (FastAPI, Docker) | Render, web service `astronomia-api`, Singapore | Free | `render.yaml`, `backend/Dockerfile` |
| Database (accounts, saved reports, share links, orders, coupons) | **Supabase**, project `ihzvwnwkbcqldhrvsrle` (staging), Singapore. Private `sidera` schema, only the backend reads and writes it | Free | `supabase/migrations/` (docs/19) |
| Sign in | **Supabase Auth**: an anonymous user on the first Save, Google for paid reports (docs/19) | Free | Supabase and Google Cloud settings |
| Daily clean up of idle guests | **Supabase**, pg_cron job `sidera-delete-idle-guests`, 02:00 Sri Lanka time | Free | `supabase/migrations/20261122021500_delete_idle_guests.sql` |
| AI assistant (FastAPI, Docker) | Render, web service `astronomia-agent`, Singapore | Free | `render.yaml`, `agent/Dockerfile` |

The domain `ppwrks.com` is registered at Squarespace, which also hosts the company website on
`ppwrks.com` and `www.ppwrks.com`. Only `sidera.ppwrks.com` points at Vercel (a CNAME record at
Squarespace). Each later app gets its own address under `ppwrks.com`.

All deploy automatically from `main`. The frontend sends `/api/*` to the backend, and the chat's
`/api/copilotkit` to the assistant, so the browser only ever talks to one site.

## Environment variables

Backend (Render):

| Variable | Meaning |
|---|---|
| `ASTRONOMIA_ENVIRONMENT` | `staging` or `production` |
| `ASTRONOMIA_DATABASE_URL` | The Supabase **session pooler** connection string, for accounts, saved reports, share links, orders and coupons. The tables come from `supabase/migrations/`; the backend stops at start up if they are missing. Without it, SQLite under `backend/var/` is used. **Required when `ASTRONOMIA_ENVIRONMENT` is `production`**: the backend refuses to start without it. Secret: set it in the dashboard only |
| `ASTRONOMIA_SUPABASE_URL` | The Supabase project address, for the public keys that check sign in tokens. In `render.yaml`. Without it nobody can sign in |
| `ASTRONOMIA_SUPABASE_SECRET_KEY` | Supabase's secret key (`sb_secret_...`), only for deleting a user from Supabase Auth (account deletion, a guest moved into a Google account). Secret: set it in the dashboard only |
| `ASTRONOMIA_PAID_REPORTS` | `true` turns on paid reports (docs/20): the AI reading, explain buttons, full detail and full PDF only on reports the account unlocked, with a coupon until payments exist. On for staging in `render.yaml` |
| `ASTRONOMIA_DEFAULT_COUNTRY` | Optional. The buyer's country for the price when Vercel does not say. Default `LK` |
| `ASTRONOMIA_SITE_ORIGINS` | Optional. The site's own addresses as a JSON list, for example `["https://sidera.lk"]`. Saving, renaming and deleting are refused from any other page. When empty, the address the request was forwarded from is used |
| `ASTRONOMIA_ACCESS_KEY` | When set, every request except `/healthz` needs it in `X-Access-Key`. Keeps staging private |
| `ASTRONOMIA_SHARE_DAYS` | How long a share link stays open. Default 30 |
| `ASTRONOMIA_CHAT_KEY` | Astro chat limits (docs/21). A long random value shared with the assistant (Render copies it) and the site (`CHAT_KEY`). Empty: no chat limits. Secret: set it in the dashboard only |
| `ASTRONOMIA_CHAT_*` | The chat limits and amounts, all optional (defaults in docs/21, section 4): free questions a week, the per-network limit, the burst limit, the longest message, the daily ceiling for free chat, the allowance per paid report, the daily ceiling per account |
| `PORT` | Set by Render. Default 8000 |

AI assistant (Render):

| Variable | Meaning |
|---|---|
| `OPENAI_API_KEY` | The OpenAI key. Set in the dashboard |
| `ASTRONOMIA_AGENT_ACCESS_KEY` | Every request except `/healthz` needs it in `X-Access-Key`. On staging, Render copies the backend's `ASTRONOMIA_ACCESS_KEY` |
| `ASTRONOMIA_AGENT_BACKEND_URL` | The backend's public address, the same as `BACKEND_URL`. Set in `render.yaml` |
| `ASTRONOMIA_AGENT_BACKEND_ACCESS_KEY` | Copied by Render from the backend's `ASTRONOMIA_ACCESS_KEY` |
| `ASTRONOMIA_AGENT_MODEL` | Optional. Default `openai:gpt-6-luna` |
| `ASTRONOMIA_AGENT_CHAT_KEY` | Copied by Render from the backend's `ASTRONOMIA_CHAT_KEY`. When set, every chat run needs a question the backend allowed (docs/21). **Required when the environment is `production`** |
| `ASTRONOMIA_AGENT_PRICE_INPUT`, `..._PRICE_CACHED_INPUT`, `..._PRICE_OUTPUT` | The model's prices in US dollars per million tokens, for measuring each answer's real cost. Set them to the provider's prices for the model in use |
| `PORT` | Set by Render. Default 8123 |

Frontend (Vercel):

| Variable | Meaning |
|---|---|
| `BACKEND_URL` | The backend's address, for example `https://astronomia-api.onrender.com` |
| `BACKEND_ACCESS_KEY` | The same value as `ASTRONOMIA_ACCESS_KEY`. Added to every forwarded call |
| `SITE_URL` | The site's own address, used in link previews |
| `STAGING_PASSWORD` | When set, the whole site asks for this password and is not indexed |
| `AGENT_URL` | The assistant's address plus `/agent`, for example `https://astronomia-agent.onrender.com/agent`. The chat appears only when it is set: it is the chat's off switch |
| `AGENT_ACCESS_KEY` | Only if the assistant has a key of its own. Without it, the chat sends `BACKEND_ACCESS_KEY`, which staging uses for both |
| `CHAT_KEY` | The same value as the backend's `ASTRONOMIA_CHAT_KEY`. Turns on the chat limits (docs/21). Secret |
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project, for sign in (docs/19). Staging: `https://ihzvwnwkbcqldhrvsrle.supabase.co`. Read when the site is built |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project's publishable key (`sb_publishable_...`). Public by design: it only lets a browser sign in. Read when the site is built |

Secrets (`*_ACCESS_KEY`, `*CHAT_KEY`, `OPENAI_API_KEY`, `STAGING_PASSWORD`, `ASTRONOMIA_DATABASE_URL`,
`ASTRONOMIA_SUPABASE_SECRET_KEY`) are set only in the host
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
3. **The AI assistant** does the same (`agent/app/security.py`). On staging it takes the same key
   as the backend. Only the site has it, so nobody can use the OpenAI key by calling the
   assistant directly.

## Turning on the chat

The assistant runs on Render at `https://astronomia-agent.onrender.com`.

1. Render's blueprint creates the `astronomia-agent` service from `render.yaml`. A new service
   waits for approval under Blueprints, then Syncs.
2. The blueprint does not create `OPENAI_API_KEY`. Add it on the service's Environment page,
   then Save, rebuild, and deploy. Without it the service stops at start-up with
   "OPENAI_API_KEY is not set". Check that `https://astronomia-agent.onrender.com/healthz`
   answers.
3. In Vercel, set `AGENT_URL` to `https://astronomia-agent.onrender.com/agent`, then redeploy.
   The chat sends `BACKEND_ACCESS_KEY`, which Vercel already has.
4. Open the site, then "Ask Astro" at the bottom right.

To turn it off, remove `AGENT_URL` in Vercel and redeploy. Turning on the chat limits (2 free
questions a week, the paid allowance, the cost ceilings) is in docs/21, section 5.

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
- The free Supabase project pauses after a week without activity (restore it from the
  dashboard; the data is kept) and has no backups. Export the data now and then while on Free.
  While it is paused the daily clean up does not run either; it catches up on the first run
  after it is restored.
- Fine for staging. Production needs paid plans (see below).

## Before going public

Updated 2026-11-21 with the legal review's findings. The reviewed policy text is in
`docs/policies/`. It must not go live until the product changes below are built, because it
describes them.

**Owner: business and licences**

| Item | Notes |
|---|---|
| Ephemeris licence | **Blocks launch, even for a free site.** Buy the Swiss Ephemeris professional licence in the operator's name: CHF 700, valid 6 years, then renewable at no more than the original fee adjusted for Swiss inflation (contract edition September 2026, update 9 Nov 2026, §§4, 16). It covers software on our own server (§2). Giving another business API access needs its own licence (§3). pyswisseph is listed as covered but "currently unsupported" (§13). Keep the signed contract, proof of payment and the pyswisseph version. The contract also forbids naming Astrodienst or its authors in promotion (§9). Publishing the backend under the AGPL is the alternative |
| Operator details | Decide who runs the site (a person trading as Sidera, or a company). Fill in legal name, registration number if any, address, business phone, privacy and support email, domain and effective date. Register the business name and get a tax number (TIN) to match |
| Domain name | Done (2026-11-21): `sidera.ppwrks.com` on Vercel, `SITE_URL` set |
| Vendor agreements | Accept and keep the data processing terms of Supabase, Render, Vercel and OpenAI. Record each one's role, locations, subprocessors and deletion terms |
| Sri Lankan data protection | The legal review reports that the main parts of the Act start on 1 January 2027 (gazette 2498/16; not checked by us). Name a privacy lead, keep the data map and records of consent. Recheck the authority's rules before that date |
| Artwork provenance | Record which tool made the site images, the account tier and its terms, and keep the source files |
| Trademark search | Search "Sidera" and its Sinhala spelling in Sri Lanka (NIPO) and in the main overseas markets before spending on publicity |
| Privacy and terms in Sinhala | A Sri Lankan lawyer checks the Sinhala text and the business details before either language is called final |
| Astrologer review of rules and golden charts | Steps 3 and 20 in docs/08. Brief sent separately |
| Sinhala wording review | All label and message files. Brief and spreadsheet in `docs/reviews/` |

**Owner then build: hosting**

| Item | Notes |
|---|---|
| Paid plans | Render Starter for the backend and AI service (no sleep). A Supabase production project on Pro (daily backups, no pausing). Vercel Pro before the first sale (Hobby is non-commercial). Find out how long Supabase backups keep deleted rows, for the privacy notice |
| Error monitoring | Must be set up so no birth details, names, chat text or share codes are sent. Test with real payloads; session replay off |

**Build: product changes the reviewed policies depend on**

| Item | Notes |
|---|---|
| Partner match | A confirmation that both adults agreed. Offer the stars-only match when that cannot be confirmed. Calculation permission is not sharing permission. **Done (2026-11-23)**: the match form asks for it before a match from full birth details, every time, and points to the birth-star match |
| Child tools (baby names, first letters, and any chart or match with a child's birth date) | **Done for baby names and first letters (2026-11-23).** A parent or guardian consent box comes before the birth details; until it is ticked nothing about the birth leaves the browser, not even the time zone lookup, and the backend refuses the request (422). No name is asked. No AI explanation or chat context, no share link, no saving. **Evidence kept:** one backend log line with the time, tool, language and wording version (`backend/app/api/guardian.py`), never the birth details, an account or a network address, so it shows that consent was given but not by whom; it lasts as long as the host's logs (the owner accepted this as enough, 2026-11-23). A birth star alone needs no consent. **Still open (owner):** a hadahan or porondam made with a child's birth date still has AI, saving and sharing |
| Share links | Names and birth details hidden by default, with a preview of every field the recipient will see. Share pages not indexed and not publicly cached, and the link code not leaked through referrers. Explain that deleting a saved report and revoking its share link are separate |
| AI notice | A short notice before the first chat message and before the first Explain button: the message and chart facts go to OpenAI, leave out names, children's details and sensitive information, and AI can be wrong |
| AI conversation time limit | Conversations kept in memory need a fixed idle timeout. A restart is not a retention limit |
| Credits page | Public page for GeoNames (CC BY 4.0, with the changes made), the fonts (SIL Open Font License), the Wikipedia names (CC BY-SA 4.0, per name) and the official Avurudu source |
| Cookies and browser storage | The guest cookie is gone: Supabase keeps the sign in (anonymous or Google) in the browser's local storage. Only the My reports hint cookie (`sidera_saved`) is left; drop it if it is only a convenience |
| Retention jobs | Check that share links really close after 30 days, free saved reports go after 7 days (docs/18), and guests with nothing saved go after 7 days unused (the pg_cron job `sidera-delete-idle-guests`, docs/19) |
| Policy pages | Put the reviewed privacy and terms text on the site in both languages, with an effective date, a contact address and an archive of old versions |
| End to end check | On a production-like setup, trace one calculation, save, share, delete, PDF, AI message, error and support request, and check the policy promises hold |

**Build: going public**

| Item | Notes |
|---|---|
| Remove `STAGING_PASSWORD`, and keep the backend reachable only through the site | Only after the licence is settled |
| Chat: usage limits, bot protection and lasting conversation storage | Before the chat is on without the staging password (docs/14, section 11) |

**Payments stay off.** PayHere does not accept astrology services. Paid features wait for a
provider that approves the product in writing (docs/15, section 0).
