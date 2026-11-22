# Accounts and Saved Reports

> **Updated 2026-11-21:** two later files change this plan, and win where they differ.
> - `docs/18-saving-paid-and-compare.md`: what free and paid users get. Free saves last 7 days, paid saves are unlimited, a coupon stands in for payments, the Astro chat has a weekly free limit.
> - `docs/19-supabase-build-plan.md`: how it is built. The database moves to **Supabase**, and **Supabase Auth** replaces the guest cookie (guests become anonymous users) and the Google sign in design in section 6. The `sessions` table goes. Section 6 and the line about avoiding Supabase are out of date.
>
> Phase A below (Save, My reports, snapshots) is built and stays; its storage and sign in change as file 19 describes.

Date: 2026-11-15

How a visitor saves a result (a porondam match, a hadahan and later the other tools) and finds it again in a "My reports" page, and how Google sign in comes in only when it is needed.

**Status (2026-11-15):** the owner chose guest first (decision 1 in section 11). Phase A, build steps 1 to 4, is built: guest accounts, Save on hadahan and porondam, My reports, the saved report page and the privacy page text. Where the build differs from the first design, the sections below say so. Phases B to D are not started.

## 1. What the owner asked for

| # | Requirement |
|---|---|
| 1 | A **Save** button on results. Saved results show in a dashboard ("My reports") |
| 2 | In the end only **paid** reports can be saved. Free results cannot |
| 3 | There is no payment yet, so **for now everyone can save** |
| 4 | Sign in is with **Google (Gmail)** |
| 5 | Sign in is **not shown up front**. It appears only when someone pays. Free users never need an account |

Requirements 3 and 5 pull against each other: if anyone can save now, but sign in only comes with payment, the site has to remember who saved what *without* a sign in. Section 2 solves that.

## 2. The idea: a quiet guest account, claimed with Google later

```
 Visitor uses any tool             Presses Save                       Pays (later phase)
 ─────────────────────             ────────────                       ──────────────────
 No account. Nothing stored.  ──▶  A guest account is made     ──▶    "Sign in with Google to keep
 (same as today)                   quietly: a secure cookie           your report" → Google popup
                                   on this browser.                   → the guest account becomes a
                                   The result is saved to it.         Google account. Every report
                                   "My reports" appears.              saved as a guest moves with it.
```

- **No sign in screen, ever, for free use.** The first Save makes a guest account in the background. The visitor sees only "Saved ✓ · View in My reports".
- **A guest account is tied to one browser.** It is a random code in a secure cookie. Nothing personal is asked for.
- **Google sign in "claims" the guest account.** The guest becomes a Google account and keeps every saved report. If that Google account already exists (for example from a phone), the guest's reports move into it and the guest is removed.
- **Paying needs Google sign in.** A purchase must be recoverable on another device and must belong to a real person for refunds. So checkout asks for Google first.
- **Returning on a new device.** A small "Already bought a report? Sign in" link sits in the footer and on the empty My reports page. It is never in the header and never pops up.

### Why not ask for Google sign in when Save is pressed?

That is the simpler alternative (no guest accounts, one kind of user). It was not chosen because it puts a sign in in front of free users now, which is what requirement 5 rules out, and it would measure how many people want to save less honestly. The cost of the guest approach is that a guest's reports are lost if the browser's data is cleared. My reports says so in one quiet line, and the problem ends once paid reports (which need Google) are the only ones that can be saved.

## 3. Phases

| Phase | What ships | Sign in | Who can save |
|---|---|---|---|
| **A. Save and My reports** | Guest accounts, Save button on hadahan and porondam, My reports page, open, rename, delete, download PDF, share | None | Everyone |
| **B. Google sign in** | Sign in with Google, claim and merge, sign out, delete account. Footer link for returning users | Optional, footer only | Everyone |
| **C. Payments** | Checkout, gateways, purchases, the paid check on Save | Required at checkout | Paid reports only. Reports saved before this stay saved |
| **D. More tools** | Save for old horoscope search, wedding nakath, first letters ceremony, personal yearly forecast | | Follows phase C rules |

Phase B can wait until just before phase C. It is listed separately so phase A ships fast.

## 4. Data

Four tables. Same pattern as share links today: SQLite for local runs and tests, PostgreSQL on staging and live (`ASTRONOMIA_DATABASE_URL`). Accounts are lasting data, so **live must use PostgreSQL**; the app refuses to start in `production` without it.

### 4.1 `users`

| Column | Notes |
|---|---|
| `id` | Random UUID |
| `kind` | `guest` or `google` |
| `google_sub` | Google's stable user id. Unique. Empty for guests |
| `email`, `name` | From Google. Empty for guests |
| `created_at`, `last_seen_at` | `last_seen_at` drives guest clean up |

### 4.2 `sessions`

| Column | Notes |
|---|---|
| `token_hash` | SHA-256 of the cookie value. The cookie itself is never stored, as with share links |
| `user_id` | |
| `created_at`, `expires_at` | Guest: 1 year, renewed on use. Google: 90 days, renewed on use |

### 4.3 `saved_reports`

| Column | Notes |
|---|---|
| `id` | Random UUID, used in the page address |
| `user_id` | Every query filters on it. Another user's id gives 404, never 403 |
| `kind` | `hadahan`, `porondam` (later `kendara`, `wedding`, ...) |
| `title` | Defaults to the names ("Nimal & Kumari"). Editable |
| `input` | The request as sent (birth details, place). Needed to open the result again, rebuild the PDF and edit |
| `input_hash` | Hash of the normalised input. Saving the same thing twice returns the existing report |
| `snapshot` | The finished result in **both languages**, built on the server, like a share link |
| `summary` | Small fields for the list card: score, lagna, nakath. Avoids loading snapshots for the list |
| `rules_version` | The rule set used. If the rules change, the card offers "Update to the new rules" |
| `purchase_id` | Empty in phases A and B |
| `created_at`, `updated_at` | |

### 4.4 `purchases` (phase C)

`id`, `user_id`, `product`, `saved_report_id`, `amount`, `currency`, `gateway`, `gateway_ref`, `status` (`pending`, `paid`, `refunded`), `created_at`. What a user may do is worked out from paid purchases. There is no separate entitlement table to keep in step.

### 4.5 Why keep both the input and the snapshot

- The **snapshot** means a saved report never changes behind the user's back when the rules or the engine are updated.
- The **input** means the report can be rebuilt (new rules, PDF, edit the birth time) without asking the user to type it again.

## 5. API (backend)

All under `/v1`, reached by the browser through the frontend's `/api` forward, so the cookie belongs to the site's own address.

| Method and path | Does |
|---|---|
| `GET /v1/me` | The account on this browser (`guest`, later `google`) and the number of saved reports. `kind` is null when there is no account |
| `POST /v1/saved` | Body: the same body as the PDF report. Rebuilds the result on the server, saves it, returns it (201). **Makes a guest account and sets the cookie if there is none.** Returns the existing report (200) when the input was already saved, in either language |
| `GET /v1/saved` | The list (summary fields only), newest first |
| `GET /v1/saved/{id}?lang=` | One report in one language, with the request it was made from |
| `PATCH /v1/saved/{id}` | Rename. An empty name goes back to the names in the report |
| `DELETE /v1/saved/{id}` | Delete |
| `POST /v1/saved/{id}/refresh` | Rebuild with the current rules. **Not built yet**: needed only when a rule set changes |
| `POST /v1/auth/google` | Body: the Google ID token. Checks it, claims or merges the guest, starts a Google session (phase B) |
| `POST /v1/auth/logout` | Ends the session. A signed out device starts with no account |
| `DELETE /v1/me` | Deletes the account, its sessions and every saved report |
| `POST /v1/checkout`, `POST /v1/billing/webhook/{gateway}`, `GET /v1/purchases` | Phase C |

The save check lives in one place, `save_access()` in `backend/app/tiers/`, like `yearly_access()` and `wedding_access()` today. In phases A and B it lets everyone through. In phase C it asks "is there a paid purchase for this report?". A test proves that turning it on blocks Save for free results and leaves the existing saved reports readable.

### 5.1 Reusing what already exists

- The snapshot builders now live in `backend/app/api/snapshots.py`, used by both shares and saved reports. Each new kind (phase D) adds one snapshot builder.
- A saved report comes back with its request, so the page draws it with the normal result view and the existing PDF and Share buttons work unchanged. There is no separate PDF endpoint for saved reports.

### 5.2 Where the code is

| Part | File |
|---|---|
| Store (one class for SQLite and PostgreSQL) | `backend/app/store/accounts.py` |
| Endpoints, cookies, the Origin check, the guest rate limit | `backend/app/api/saved.py` |
| The paid check | `save_access()` in `backend/app/tiers/__init__.py` |
| Frontend client | `frontend/lib/account.ts` |
| Save button, its gate, header link, My reports, saved report page | `frontend/components/account/`, `frontend/app/[lang]/my/` |

## 6. Sign in with Google (phase B)

- **Google Identity Services** button, loaded only on the pages that show it (checkout, the footer sign in page, My reports). No Google script on any other page.
- The button returns a signed **ID token**. The browser posts it to `POST /v1/auth/google`. The backend checks the signature against Google's public keys, the audience (our client id), the issuer, the expiry and that the email is verified, using the `google-auth` library.
- The backend then makes its own session cookie. Google tokens are never kept.
- No extra sign in service (Auth.js, Firebase, Clerk, Supabase). The users and their reports live in our own PostgreSQL next to the share links, and the backend already owns the data, so it should own the session too.

Set up needed from the owner: a Google Cloud project, the OAuth consent screen (app name, logo, privacy policy address), and a web client id with the live, staging and `http://localhost:3000` addresses as allowed origins.

## 7. Security and privacy

| Topic | Rule |
|---|---|
| Session cookie | Random 32 bytes. `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. Only its hash is stored. Named `__Host-sid` where the site runs on https |
| Forged requests from other sites | `SameSite=Lax`, plus the backend refuses any POST, PATCH or DELETE whose `Origin` is neither listed in `ASTRONOMIA_SITE_ORIGINS` nor the host the request was sent to (through the frontend's forward, the forwarded host) |
| Someone else's report | Every query filters on the session's user. A wrong id is 404 |
| Birth details | Stored only when Save is pressed. Never in addresses or logs (as today) |
| Limits | 20 free reports at a time per account (`ASTRONOMIA_FREE_SAVED_LIMIT`), each deleted 7 days after saving (docs/18, section 3); 1,000 paid reports (`ASTRONOMIA_PAID_SAVED_LIMIT`). One address may make 30 new guest accounts an hour (`ASTRONOMIA_GUESTS_PER_HOUR`), counted in memory |
| Delete | Every report can be deleted. "Delete my account" deletes everything at once |
| Guest clean up | A guest account not used for 12 months is deleted with its reports |
| Privacy page | Updated before phase A ships: what Save stores, the guest cookie, how to delete, Google sign in |

### Cold starts

The backend sleeps on the free hosting plan. Calling `/v1/me` on every page would wake it for every visitor. Instead, the backend also sets a small, non secret cookie `sidera_saved=1` when a user has saved reports. The header reads that cookie to decide whether to show "My reports". It holds no user id.

## 8. Screens (frontend)

| Screen | What it does |
|---|---|
| **Save button** on the result (next to Download PDF and Share) | `Save` → `Saving…` → `Saved ✓ · View in My reports`. Already saved shows `Saved ✓` straight away. In phase C, on a free result it becomes `Get the full report` (checkout) |
| **Header and mobile tab bar** | A "My reports" link only when the `sidera_saved` cookie is present. Nothing changes for visitors who never saved |
| **My reports** `/{lang}/my` | Cards grouped by tool (Porondam matches, Hadahan charts). Each card: title, date saved, a one line summary (score 16/20, Kataka lagna). Actions: Open, Download PDF, Share, Rename, Delete. A quiet note for guests: "Saved on this browser only." Empty state with links to the tools and the "Already bought a report? Sign in" link |
| **One saved report** `/{lang}/my/{id}` | The saved snapshot, drawn with the same result components the shared link page uses. Not indexed by search engines |
| **Account** (phase B) | Inside My reports: the Google email, Sign out, Delete my account |
| **Checkout** (phase C) | Sign in with Google (if not already), then the gateway. On success the report is saved and opened |

New code:

| Where | What |
|---|---|
| `frontend/lib/account.ts` | `getMe`, `saveReport`, `listSaved`, `getSaved`, `renameSaved`, `deleteSaved`, `signInWithGoogle`, `signOut` |
| `frontend/components/account/SaveButton.tsx` | The button and its states |
| `frontend/components/account/SaveGate.tsx` | The one frontend place for the phase C paid check, like `YearlyGate` |
| `frontend/components/account/GoogleSignIn.tsx` | Loads the Google script only when drawn |
| `frontend/app/[lang]/my/page.tsx`, `my/[id]/page.tsx` | The dashboard and one report |
| `frontend/messages/en.json`, `si.json` | The words, in both languages |

The existing "Remember this chart" box (kept in the browser only, for the home page greeting) stays as it is. It can be folded into Save later.

## 9. Payments (phase C, outline only)

1. On a result, the free level shows; `Get the full report` opens checkout.
2. Not signed in → Google sign in first. The guest account is claimed, so nothing saved before is lost.
3. The gateway takes payment: a local gateway for LKR (for example PayHere) and a card gateway for USD.
4. The gateway's webhook marks the purchase `paid`. Only the webhook unlocks, never the browser's return page.
5. The report is saved with its `purchase_id` and the full paid content, and opens.

Pricing and gateways are the open decisions in file 07, section 5.

## 10. Build steps

Each step is one pull request with its own tests.

| # | Step | Checks |
|---|---|---|
| 1 | **Built.** Move the snapshot builders out of `shares.py` into a shared module. No change in behaviour | Share tests pass unchanged |
| 2 | **Built.** Users, sessions and saved reports in the store (SQLite and PostgreSQL), with a schema version table for later changes | Store tests on both. Production refuses to start without PostgreSQL |
| 3 | **Built.** `/v1/me` and `/v1/saved*` with guest accounts, the Origin check, limits, `save_access()` | One user cannot see another's report. Saving twice returns one report. Delete works. Cross site POST refused |
| 4 | **Built.** Save button on hadahan and porondam, My reports, one report page, header link, privacy page | Playwright: save a match, find it in My reports, open it in the other language, download the PDF, delete it |
| 5 | Google sign in, claim and merge, sign out, delete account, footer link | Token checks tested with fake tokens. Merging moves every report. Delete removes everything |
| 6 | Payments (separate design once gateways and prices are chosen) | |
| 7 | Save for the other tools, one tool per step | |

The session cookie was checked through the frontend's `/api` forward with `next dev` on 2026-11-15: saving, listing, opening, renaming and deleting all worked, and the HttpOnly cookie stayed hidden from page scripts. **Still to check on the Vercel staging site** after merging: save a result, reload, and see it in My reports.

## 11. Decisions needed

| # | Question | Suggested |
|---|---|---|
| 1 | Guest first (section 2) or Google sign in when Save is pressed? | Guest first |
| 2 | When paid only saving starts, do reports saved for free stay? | Yes, they stay. Only new free results lose Save |
| 3 | Name of the dashboard | "My reports" / "මගේ වාර්තා" |
| 4 | How long an unused guest account is kept | 12 months |
| 5 | Which tools get Save first | Hadahan and porondam, then the others in phase D |
