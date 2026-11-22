# Policies

The reviewed English text of Sidera's public policies, from the legal review of 20 November 2026.
English is the master text for the Sinhala translation.

| File | What it is | Status |
|---|---|---|
| [privacy.md](privacy.md) | Privacy notice (public draft A) | A shortened version is on the site (below); the rest waits for operator details and the product changes below |
| [terms.md](terms.md) | Terms of use (public draft B), with paid terms to switch on only when payments open | Same; the paid terms wait for payments |
| [refunds.md](refunds.md) | Delivery, refunds and cancellation (public draft C), and the checkout and form text | For use only once purchases open |

## What the site shows now (22 November 2026)

The site's Privacy and Terms pages (`/[lang]/privacy`, `/[lang]/terms`) are rewritten from drafts A
and B so they describe Sidera as it works on `main` today. The text is in `frontend/messages/en.json`
and `si.json`, under `legal`, `privacy` and `terms`. English is the master; the Sinhala is a first
translation and the page says it still needs the lawyer's and the Sinhala reviewer's check. Both
pages keep the "Draft" notice and the "A contact address will be added here before launch" line.
An e2e test (`frontend/tests/e2e/legal.spec.ts`) fails if either page shows a square bracket.

**Filled in from how the site works:** Supabase in Singapore for the database and sign in, Render
in Singapore for the calculations and the AI server, Vercel for the pages; Supabase anonymous users
instead of the guest cookie (sign in kept in browser storage, plus the `sidera_saved` marker
cookie with no id); Google sign in and what Supabase keeps from it; moving guest reports into a
Google account; sign out of this phone, sign out everywhere, delete my account; 100 saved reports
per guest; saved reports kept until deleted (there is no expiry job yet, so the old 12-month line is
gone); 30-day share links, names shown unless hidden; full reports need Google, payment is not
available, only free coupons unlock; order records (price, coupon, amount, time, a one-way hash
instead of birth details, kept without the user after account deletion) and wrong-code notes;
OpenAI with response storage off (`"store": False` in `agent/app/graph.py`), conversation kept
only in the AI server's memory (LangGraph `InMemorySaver`, lost on restart; no time limit yet).

**One difference from the brief:** Google gives Supabase the picture address as well as the
account id, email and name (basic scopes), so the page names all four.

**Left off the site because it is not true yet** (each is in drafts A and B, and goes back when
built): the guardian consent step in the child tools and the child tools' no-AI, no-share rule;
the partner match confirmation; share links hiding details by default with a preview; the AI notice
and the conversation time limit; the credits page; the rights request email and regulator links.
The privacy page says requests go to "the contact address that will be added below".

**Waits for payments:** the paid-purchase terms (the last section of draft B) and the whole refunds
policy (draft C). The terms page has only a short "Full reports and coupons" section: Google
sign in, kept in the account, payment not available, free coupons only, each coupon has limits,
and "Terms for paid reports will be added here before payment opens."

### Still to fill before launch (owner)

| What | Where it goes |
|---|---|
| Operator's legal name (a sole proprietor names the person trading as Sidera), registration number if any, postal address | Top of both pages, replacing the "Draft" notice |
| Privacy and support email, business phone | The contact line at the end of both pages |
| Effective date and domain | `legal.updated` and the page heads |
| Cookie lifetimes (`sidera_saved`, and the chat cookie once chat limits land) | Privacy, "Saved reports and your account" |
| Host log retention, backup period (Supabase, Render, Vercel), support email retention | Privacy, "Logs" |
| Transfer safeguards for OpenAI (United States) and the regulator links for the launch markets | Privacy, "Who runs the site" and "Your choices and deletion" |
| Whether a DPO or overseas representative is needed | Lawyer |

### Sentences to change when the parallel work lands

None of these had an open PR on 22 November 2026 (the sessions building them stopped without
pushing). Swap each sentence in the same PR that ships the feature, or straight after it merges,
never before. Exact behaviour must be checked against the PR first.

| Feature (docs/18, docs/19) | Section | Today | Change to |
|---|---|---|---|
| Free saves expire after 7 days, 20 free reports | Privacy, "Saved reports and your account" | "A guest can keep up to 100 saved reports." / "Saved reports stay until you delete them." | "A free report is kept for 7 days from saving and then deleted. You can keep up to 20 free reports at a time." / "Full reports stay until you delete them or your account." (SI: "නොමිලේ ඇති වාර්තාවක් සුරැකූ දින සිට දින 7ක් තබාගෙන පසුව මකා දමනවා. එකවර නොමිලේ වාර්තා 20ක් දක්වා තබාගත හැකියි." / "සම්පූර්ණ වාර්තා ඔබ ඒවා හෝ ඔබේ ගිණුම මකන තුරු තිබෙනවා.") |
| Share links hide details by default, with a preview | Privacy, "Sharing"; Terms, "Sharing" | "...and the names unless you choose to hide them." | Say what is hidden by default and that the Share dialog shows what the person will see, as the PR builds it |
| AI notice and idle time limit (suggested 30 minutes) | Privacy, "The AI helper"; Terms, "AI explanations" | "...and it is lost when that server restarts." | "...and it is deleted after 30 minutes without a new message, or sooner if the server restarts." (SI: "...නව පණිවිඩයක් නැතිව විනාඩි 30ක් ගත වූ විට, හෝ සේවාදායකය ඊට පෙර නැවත ආරම්භ වුවහොත්, එය මැකෙනවා.") Terms: add that Astro shows a notice before the first question |
| Astro chat limits | Privacy, "The AI helper" and the cookie sentence | (nothing) | Add: free questions are counted with a small cookie on this browser, 2 a week; full reports keep usage records with numbers only (account, date, amount of AI used, cost), never the question text. Add any per-network limit the PR adds |
| Credits page `/[lang]/credits` | Terms, "Your reports" | "Material from others stays under its own licences" | "...under its own licences, listed on the Credits page" (needs link support in `LegalPage`, or plain text) |
| Clean-up of idle guests | Privacy, "Saved reports and your account" | (nothing) | Add: a guest account with nothing saved is deleted after the PR's idle period |

## Before the full reviewed text goes on the site

Drafts A and B describe how the site will work, not how it works today. Publishing them whole now
would make promises the site does not keep. Each item below must be true first (the build list is in
`docs/09-launch.md`, "Before going public"):

1. The child tools ask for a parent or guardian's consent, need no child's name, and send nothing to the AI or to a share link.
2. The partner match asks for confirmation that both adults agreed.
3. Share links hide names and birth details by default and preview what the recipient will see.
4. The AI helper shows its notice before the first message and the first Explain button, and conversations have a fixed idle time limit.
5. A public credits page exists.
6. The Sinhala text has been checked by a Sri Lankan lawyer.

## Placeholders to fill

Text in square brackets needs a real value before publishing. Never publish a bracket.

| Placeholder | Where the answer comes from |
|---|---|
| [date], [domain] | Launch date and domain |
| [Legal operator and trading name], [registration number if applicable], [postal address], [privacy email], [support email], [business phone] | The owner. A sole proprietor names the person trading as Sidera; never call a person a company |
| [Add the DPO and overseas representative contacts where applicable] | Only if the lawyer says one is needed |
| [Insert verified cookie lifetimes] | The backend's cookie settings |
| [verified time limit] | The AI conversation idle timeout, once built |
| [Insert verified processing/support locations, transfer instrument ...] | Render, Vercel and OpenAI data processing terms |
| [verified period or criteria] (host logs, support email), [verified maximum] (backups) | Render and Vercel settings, and the support process |
| [Add regulator/contact and representative links ...] | The launch markets chosen |
| [credits page] | The credits page address, once built |
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
