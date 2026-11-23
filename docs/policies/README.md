# Policies

The reviewed English text of Sidera's public policies, from the legal review of 20 November 2026.
English is the master text for the Sinhala translation.

| File | What it is | Status |
|---|---|---|
| [privacy.md](privacy.md) | Privacy notice (public draft A) | A shortened version is on the site (below); the rest waits for operator details and the product changes below |
| [terms.md](terms.md) | Terms of use (public draft B), with paid terms to switch on only when payments open | Same; the paid terms wait for payments |
| [refunds.md](refunds.md) | Delivery, refunds and cancellation (public draft C), and the checkout and form text | For use only once purchases open |

## What the site shows now (23 November 2026)

The site's Privacy and Terms pages (`/[lang]/privacy`, `/[lang]/terms`) are rewritten from drafts A
and B so they describe Sidera as it works on `main`, including #70 to #75. The text is in
`frontend/messages/en.json` and `si.json`, under `legal`, `privacy` and `terms`. English is the
master; the Sinhala is a first translation and the page says it still needs the lawyer's and the
Sinhala reviewer's check. Both pages keep the "Draft" notice and the "A contact address will be
added here before launch" line. An e2e test (`frontend/tests/e2e/legal.spec.ts`) fails if either
page shows a square bracket.

**Filled in from how the site works, and where each fact comes from:**

| Fact on the page | Source |
|---|---|
| Vercel serves the pages; Render (Singapore) runs the calculations and the AI server; Supabase (Singapore) holds the database and sign in; the Render database is gone | `render.yaml`, #70 |
| Guests are Supabase anonymous users, sign in kept in browser storage; `sidera_saved` marker cookie, no id, up to a year | #65, #67, `backend/app/api/saved.py` (`HINT_DAYS = 365`) |
| Google sign in: Supabase keeps account id, email, name, picture address and sign-in time; guest reports move into the Google account; sign out here, sign out everywhere, delete my account | #67 |
| Free saved reports deleted 7 days after saving (hourly job, never shown after), saving again does not restart it, 20 free reports at a time; full reports kept until deleted; unlocking a free report stops its expiry | #73 |
| Guests with nothing saved, no order and no use for 7 days deleted once a day | #70 |
| Full reports need Google; payment not available; only free coupons unlock; order records (price, coupon, amount, time, a one-way hash instead of birth details, kept without the user after account deletion); wrong-code notes deleted with the account | #66, `supabase/migrations/20261121142841_orders_and_coupons.sql` |
| Share links: names and birth details off by default and removed before storing; a match never includes birth details; a preview of every field; link previews never show names; noindex, no-store, no-referrer; 30 days; deleted only on the device that made it; separate from saved reports. Also says the chart itself can point to roughly when and where someone was born (#75, owner question 1) | #75 |
| AI notice before anything goes to the AI, remembered in this browser; AI off for child results; OpenAI with response storage off; conversation only in memory, deleted after 30 idle minutes or on restart | #72, `agent/app/graph.py` (`"store": False`) |
| Chat: 2 free questions a week per browser; about 20 questions' allowance per full report, no cash value; per-network, per-account daily and 1,000-character limits; free questions may pause on busy days. Usage records keep time, tokens and cost, never text; free ones linked to the `sidera_chat` id and a keyed hash of the network address, deleted after 8 days; paid ones linked to the account, deleted with it. Cookies `sidera_chat` (1 year) and `sidera_chat_turn` (30 minutes) | #74 |
| Material from others (place names, fonts, planet positions) is listed on the Credits page linked in every page's footer | #71 |

**Depends on #74 (chat limits), which was not merged when this was written:** in Privacy, the
`sidera_chat` and `sidera_chat_turn` sentences of the cookie paragraph, the chat usage paragraph in
"The AI helper", the network-address sentence in "Logs" and "chat usage" in "Who runs the site";
in Terms, the whole "Astro chat" section. Merge this PR after #74.

**One difference from the first brief:** Google gives Supabase the picture address as well as
the account id, email and name (basic scopes), so the page names all four.

**Left off the site because it is not true yet** (each is in drafts A and B, and goes back when
built): the partner match
confirmation; the rights request email and regulator links. The privacy page says requests go to
"the contact address that will be added below".

**Waits for payments:** the paid-purchase terms (the last section of draft B) and the whole refunds
policy (draft C). The terms page has only a short "Saved reports, full reports and coupons" section:
the 7-day rule for free reports, Google sign in for full reports, payment not available, free coupons
only, each coupon has limits, and "Terms for paid reports will be added here before payment opens."

If a setting changes, change the page with it: `ASTRONOMIA_SHARE_DAYS` (30),
`ASTRONOMIA_FREE_SAVED_LIMIT` (20), the 7-day expiry, `ASTRONOMIA_AGENT_CONVERSATION_IDLE_MINUTES`
(30), and the chat limits in docs/21.

### Still to fill before launch (owner)

| What | Where it goes |
|---|---|
| Operator's legal name (a sole proprietor names the person trading as Sidera), registration number if any, postal address | Top of both pages, replacing the "Draft" notice |
| Privacy and support email, business phone | The contact line at the end of both pages |
| Effective date and domain | `legal.updated` and the page heads |
| How long Supabase backups keep a deleted row (on the plan in use), host log retention (Supabase, Render, Vercel), support email retention | Privacy, "Logs" |
| Transfer safeguards for OpenAI (United States) and the regulator links for the launch markets | Privacy, "Who runs the site" and "Your choices and deletion" |
| Whether a DPO or overseas representative is needed | Lawyer |
| Whether share links should also offer a "summary only" chart (#75, owner question 1) | Privacy, "Sharing" |

## Before the full reviewed text goes on the site

Drafts A and B describe more than the site does today. Publishing them whole now would make
promises the site does not keep. Each item below must be true first (the build list is in
`docs/09-launch.md`, "Before going public"):

1. ~~The child tools ask for a parent or guardian's consent and offer no share link.~~ Done for baby names and first letters (a hadahan or match with a child's birth date is an open question in `docs/09-launch.md`).
2. The partner match asks for confirmation that both adults agreed.
3. ~~Share links hide names and birth details by default and preview what the recipient will see.~~ Done in #75.
4. ~~The AI helper shows its notice before the first message and the first Explain button, and conversations have a fixed idle time limit.~~ Done in #72 (30 minutes).
5. ~~A public credits page exists.~~ Done in #71 (`/[lang]/credits`).
6. The Sinhala text has been checked by a Sri Lankan lawyer.

## Placeholders to fill

Text in square brackets needs a real value before publishing. Never publish a bracket.

| Placeholder | Where the answer comes from |
|---|---|
| [date], [domain] | Launch date and domain |
| [Legal operator and trading name], [registration number if applicable], [postal address], [privacy email], [support email], [business phone] | The owner. A sole proprietor names the person trading as Sidera; never call a person a company |
| [Add the DPO and overseas representative contacts where applicable] | Only if the lawyer says one is needed |
| [Insert verified cookie lifetimes] | `sidera_saved` 1 year, `sidera_chat` 1 year, `sidera_chat_turn` 30 minutes (#74) |
| [verified time limit] | 30 minutes (#72) |
| [Insert verified processing/support locations, transfer instrument ...] | Render, Vercel and OpenAI data processing terms |
| [verified period or criteria] (host logs, support email), [verified maximum] (backups) | Render and Vercel settings, and the support process |
| [Add regulator/contact and representative links ...] | The launch markets chosen |
| [credits page] | `/[lang]/credits` (#71) |
| [working cancellation link], [working withdrawal link], [email/address], [total], [amount], [period] | The checkout, once a payment provider approves |

## Changes since the review: Supabase sign in (docs/19)

The privacy notice was reviewed when Save made a guest cookie on Render's database. Sign in is
moving to Supabase. These notes are for the next legal review; the reviewed text above is not
changed until then (docs/19, step 5 updates it).

- **No guest cookie.** Save signs the browser in to Supabase Auth as an anonymous user. Supabase's
  script keeps the sign in (an access token and a refresh token) in the browser's local storage,
  not in a cookie. The backend keeps no session and no key hash: it checks the access token with
  Supabase's public keys on each call. The "private browser-key cookie" and "We store a hash of
  the key" sentences no longer apply. The `sidera_saved` marker cookie stays (no id in it).
- **The account id is the Supabase user id.** Supabase Auth holds, for an anonymous user, only the
  id, the time it was made and last signed in, and the network address Supabase logs. Saved
  reports stay in the app's own tables.
- **Continue with Google.** Optional, offered in My reports and the footer. Supabase Auth then
  keeps what Google gives with the basic scopes: the Google account id, email, name and picture
  address, and when the account signed in. The site shows the email in My reports; the backend
  reads only the user id and whether it is a guest. A guest who continues with Google keeps the
  same account, so the reports saved on that browser stay with it.
- **Moving a guest into an existing account.** When a guest continues with a Google account that
  already has reports from another device, the guest's reports join that account and the guest
  is deleted, here and in Supabase Auth. Only the browser holding the guest's sign in can ask for
  this: the backend checks both sign ins.
- **Sign out and delete.** "Sign out of this phone" and "Sign out everywhere" (every device
  within an hour). "Delete my account" deletes every saved report and then the Supabase Auth
  user. The 12-month inactivity rule in the notice is replaced by docs/18's 7-day rule for free
  saves once that is built (docs/18, step 2).
- **Where.** The database and Supabase Auth are in Singapore (Supabase project on AWS
  ap-southeast-1). Supabase becomes a processor to name, next to Render and Vercel.
- **Old guest records.** The migration that removes the old cookie sessions also deletes the guest
  accounts made with them, with their reports. Only staging had any; no real visitors.

## Not decided by this text

- **Payments.** PayHere does not accept astrology services. The paid terms and the refunds policy wait for a provider that approves the product in writing (`docs/15-payments.md`, section 0).
- **Liability cap.** The review advises against a fixed money cap and assumes none.
- **Which language prevails.** Neither. A difference is to be resolved fairly, keeping mandatory protections.
