# Supabase: database and sign in, build plan

Date: 2026-11-21

How Sidera moves its database to Supabase and uses Supabase Auth for sign in. It replaces the
Render PostgreSQL database and the "Sign in with Google" design in docs/16, section 6. What users
get (free and paid saving, coupons, chat limits) stays as in docs/18.

## 1. Where everything runs

| Part | Host | Plan now |
|---|---|---|
| Website (Next.js) | Vercel, project `astronomia`, at `https://sidera.ppwrks.com` | Hobby (free). Pro before the first sale |
| Backend (FastAPI): calculations, PDFs, saved reports, shares | Render, `astronomia-api`, Singapore | Free. Starter before launch |
| AI service | Render, `astronomia-agent`, Singapore | Free. Starter before launch |
| Database | **Supabase**, project `ihzvwnwkbcqldhrvsrle` (staging), Singapore | Free. A separate production project on Pro at launch |
| Sign in | **Supabase Auth**: anonymous users and Google | Included |
| Company website | Squarespace, at `ppwrks.com` | Owner's |

The Render PostgreSQL database is retired. It only holds test data, so nothing is moved.

## 2. Already done (2026-11-21)

- Supabase project created in Singapore. Empty: no tables, no users.
- Google Cloud OAuth client "Sidera web", published (any Google account can sign in). Basic scopes only.
- Supabase: Google provider on, anonymous sign ins on. Site URL `https://sidera.ppwrks.com`. Redirect URLs: `https://sidera.ppwrks.com/**`, `http://localhost:3000/**`, `https://astronomia-ten.vercel.app/**`, `https://*-pamudu-ranasinghes-projects.vercel.app/**`.
- Domain `sidera.ppwrks.com` on Vercel, `SITE_URL` updated and redeployed.
- The Supabase MCP server is in `.mcp.json`, so a session started in this folder can manage the project.

## 3. The design

### Who talks to what

```
Browser ── signs in ──▶ Supabase Auth (anonymous, Google)
   │                         │ gives an access token (JWT)
   └── /api/* with the token ▶ Vercel ──▶ Render backend ──▶ Supabase Postgres
                                            checks the token     (only the backend
                                            with Supabase's       reads and writes)
                                            public keys
```

- **The browser uses Supabase only to sign in.** It never reads or writes app tables.
- **Only the backend reads and writes data**, as today. It connects to Supabase Postgres with the database connection string.
- **Each call to the backend carries the user's Supabase access token** in an `Authorization: Bearer` header, sent by `frontend/lib/account.ts`. The backend checks it with Supabase's public signing keys (the JWKS address), so it needs no shared secret for this.
- The token gives the backend the user id and whether the user is anonymous. The backend keeps its own `users` row for that id.

### Tables

- **In a private schema named `sidera`,** not in `public`. Supabase's Data API publishes `public` to anyone holding the publishable key; a private schema is not published.
- **Row level security on, with no policies,** on every table, as a second lock. The backend connects as the database owner and is not affected.
- **Created by migrations kept in the repository** (`supabase/migrations/`), applied to the staging project, and later to production in the same order. The app stops creating tables at start up on PostgreSQL. SQLite for local runs and tests keeps creating its own.
- **Tables:** `users` (id is the Supabase user id), `saved_reports` and `shares`, as today. The `sessions` table goes: Supabase keeps sessions. Later steps add `orders`, `coupons` and chat usage (docs/18).
- **No birth details or names in Supabase Auth.** Sign in holds only what Google gives (account id, email, name). Reports stay in `saved_reports`.

### Accounts

| Moment | What happens |
|---|---|
| A visitor uses any tool | Nothing. No sign in, nothing stored |
| First Save | The page signs in anonymously with Supabase, then saves. The backend creates the `users` row |
| Continue with Google | Supabase links Google to the same anonymous user. Same id, so every saved report stays |
| Google account already used on another device | Linking fails. The page signs in with Google, then asks the backend to move the guest's reports into that account. The backend checks both tokens first, so only the browser holding the guest session can move them |
| Sign out | "Sign out of this phone" (this device) and "Sign out everywhere" |
| Delete account | The backend deletes the user's rows, then deletes the Supabase user with the secret key |
| A guest nobody uses | Anonymous users with nothing saved, unused for 7 days, are deleted by a daily job |

### Settings

| Where | Setting | Secret? |
|---|---|---|
| Vercel | `NEXT_PUBLIC_SUPABASE_URL` = `https://ihzvwnwkbcqldhrvsrle.supabase.co` | No |
| Vercel | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_vlBrz647bGurzFAoUhrrxQ_oJlRSgtb` (staging) | No (public by design) |
| Supabase, Authentication → Sign In / Providers | **Allow manual linking: on.** Without it a guest cannot link Google | No |
| Render, `astronomia-api` | `ASTRONOMIA_DATABASE_URL` = Supabase session pooler connection string | **Yes.** Owner sets it |
| Render, `astronomia-api` | `ASTRONOMIA_SUPABASE_URL` = the project address, for the signing keys (`https://ihzvwnwkbcqldhrvsrle.supabase.co` on staging). Without it nobody can sign in | No |
| Render, `astronomia-api` | `ASTRONOMIA_SUPABASE_SECRET_KEY`, only for deleting accounts | **Yes.** Owner sets it |
| `backend/.env` (local) | The same three, for running against staging | **Yes.** Never committed |

Secrets are typed into the dashboards by the owner, never into chat or the repository.

## 4. Build steps

Each step is one pull request with its own tests, reviewed before the next.

| # | Step | Done when |
|---|---|---|
| 1 | **Database.** Migrations for the `sidera` schema, `users`, `saved_reports`, `shares`, row level security on. Revoke the open call permission on `public.rls_auto_enable()`. The backend uses the schema on PostgreSQL and stops creating tables there. Owner switches `ASTRONOMIA_DATABASE_URL` on Render to Supabase | Saving, opening and sharing work on staging against Supabase. Supabase's security checker shows no warnings. Existing tests pass on SQLite |
| 2 | **Backend sign in.** Check Supabase tokens (signature, issuer, audience, expiry) with the JWKS keys, cached. Find or create the `users` row. The guest cookie code is removed, and a migration drops the temporary `sidera.sessions` table that step 1 kept for it | Tests with stand-in tokens: a valid token works, an expired, wrong-issuer or tampered one is refused, one user never sees another's reports |
| 3 | **Website sign in.** Supabase client in the site. First Save signs in anonymously. Every account call sends the token. "Continue with Google" in My reports and an "Already saved? Sign in" link in the footer. The `/auth/callback` page | On staging: save as a guest, continue with Google, the reports stay. Sign in on a second browser, the reports are there |
| 4 | **Moving a guest into an existing account, sign out, delete account** | Tests for the move (both tokens checked, every report moved, guest removed). Delete removes every row and the Supabase user |
| 5 | **Clean up.** Daily job for idle anonymous users. Privacy notice and docs updated for Supabase (data processor, Singapore, what Google sign in keeps). Render database deleted | The notice names Supabase. Nothing points at the Render database |

Then docs/18 continues: 7 day free saves, coupons and the paid check, chat limits.

## 5. How it is built

Notes from building each step, for whoever changes it next.

### Step 2: backend sign in (branch `claude/supabase-signin-79c6c3`)

- **`backend/app/auth.py`** checks the token: the signing algorithm must be ES256 or RS256 (the
  staging project signs with ES256; HS256 and unsigned tokens are refused), the key id must be in
  the project's JWKS (`<ASTRONOMIA_SUPABASE_URL>/auth/v1/.well-known/jwks.json`), and the claims
  must have issuer `<ASTRONOMIA_SUPABASE_URL>/auth/v1`, audience `authenticated`, a future expiry
  (30 seconds of clock difference allowed), an issue time, and a user id that is a uuid.
  `is_anonymous: true` makes the user a guest; anything else is a Google account.
- **Keys are cached** for ten minutes. A token with a key id not seen yet fetches the set again
  (Supabase rotating its keys), at most once a minute, so made-up key ids cannot make the backend
  fetch on every call. If Supabase cannot be reached, the kept keys go on working.
- **The current user** comes from `current_session` in `backend/app/api/saved.py` (`Current`):
  `session.found` is None without a token, else `session.found.user.id` (the Supabase user id)
  and `session.found.user.kind` (`guest` or `google`). A bad or expired token is 401, so the page
  signs in again. A good token whose user has no `users` row gets one; new guests are still
  limited per address (`ASTRONOMIA_GUESTS_PER_HOUR`), on top of Supabase's own limit.
- **A guest who links Google** keeps the same id; the row's kind turns to `google` on the next
  call and never back.
- **Saving needs a sign in.** `POST /v1/saved` without a token is 401: the page signs in
  anonymously first (step 3). Reading without a token answers as before (no reports).
- The guest cookie (`sid`) and the backend's sessions are gone. Migration
  `20261121130000_drop_guest_sessions.sql` drops `sidera.sessions` and deletes the rows of guests
  made with the old cookie (their ids are not Supabase users, so nobody could reach them). The
  small `sidera_saved` hint cookie stays: it only tells the header to show "My reports".
- Tests make their own ES256 key and sign stand-in tokens with it (`backend/tests/auth.py`), so
  the real checks run: `tests/test_auth.py` for the token rules, `tests/test_api_saved.py` for
  the endpoints.

### Step 3: website sign in

- **`frontend/lib/supabase.ts`** holds the Supabase client, loaded only when an account action
  first needs it. It signs in anonymously (`signInAnonymously`), and "Continue with Google"
  calls `linkIdentity` for a guest (same user id, reports stay) or `signInWithOAuth` when nobody
  is signed in here (a second phone). PKCE flow; Supabase keeps the sign in in local storage and
  renews it.
- **Every account call** in `frontend/lib/account.ts` sends the access token. The page puts it
  in `X-Sidera-Token`, and the `/api` forward (`frontend/proxy.ts`, `lib/forward.ts`) hands it
  to the backend as `Authorization: Bearer`. Not Authorization from the page itself: on the
  private staging site that header carries the staging password. A token the backend refuses
  signs the browser out; a Save then tries once more as a new guest.
- **Saves wait for each other across tabs** (Web Locks), so two first saves make one guest.
- **My reports** shows "Continue with Google" (`components/account/GoogleSignIn.tsx`): for a
  guest with reports, "Keep your reports on any device"; for anyone else, "Saved reports on
  another device?". Signed in with Google, it names the account. The footer's "Already saved?
  Sign in" link goes to it (`/<lang>/my#sign-in`).
- **`/<lang>/auth/callback`** (`app/[lang]/auth/callback`) exchanges the code Supabase sends
  back and goes on to the page in `next` (only paths on this site). `/auth/callback` without a
  language is sent to it by the language redirect, query kept. The redirect URLs already allowed
  in Supabase (`https://sidera.ppwrks.com/**` and the rest) cover it.
- Browser tests answer Supabase's calls themselves (`frontend/tests/e2e/supabase.ts`); CI builds
  the site pointed at `https://supabase.e2e.test`.

## 6. Checks before production

- A separate Supabase production project on **Pro** (daily backups, no pausing), with the same migrations.
- Supabase's data processing agreement accepted.
- Cloudflare Turnstile on anonymous sign ins, if bots appear (Supabase supports it).
- Google brand verification once the staging password is removed and the reviewed privacy page is live.
- An email sending service connected to Supabase, before email login codes are added.
