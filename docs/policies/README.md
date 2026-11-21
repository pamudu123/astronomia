# Policies

The reviewed English text of Sidera's public policies, from the legal review of 20 November 2026.
English is the master text for the Sinhala translation.

| File | What it is | Status |
|---|---|---|
| [privacy.md](privacy.md) | Privacy notice (public draft A) | Waiting for operator details and the product changes below |
| [terms.md](terms.md) | Terms of use (public draft B), with paid terms to switch on only when payments open | Same |
| [refunds.md](refunds.md) | Delivery, refunds and cancellation (public draft C), and the checkout and form text | For use only once purchases open |

## Before any of this goes on the site

The text describes how the site will work, not how it works today. Publishing it now would make
promises the site does not keep. Each item below must be true first (the build list is in
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
