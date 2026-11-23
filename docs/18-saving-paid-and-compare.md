# Saving, paid reports, coupons, chat limits and compare

Date: 2026-11-21. Updated the same day with the owner's changes: pay per report only (no passes or plans), LKR 800 or USD 2.50 a report, and coupons that give a percentage off or make a report free. Updated 2026-11-23: buying needs no sign in, and Google is offered after, as an option (`docs/23-buying-a-report.md`, which wins where this file says Google comes first).

The agreed plan for how people are recognised, what free and paid users can save, the coupon that
stands in for payments, the Astro chat limits, what paid users get, and the compare feature. It
updates `docs/16-accounts-and-saved-reports.md`: where the two differ, this file wins.

## 1. Decisions made (2026-11-21)

| Topic | Decision |
|---|---|
| Free users | No sign in screen. A free user who saves becomes a Supabase anonymous user, kept on this browser (it replaces today's guest cookie) |
| Paid users | **Sign in with Google**, through Supabase Auth. The Google account's email is how a paid user is recognised, on any device |
| Recovery | No separate recovery. A paid user who loses the browser data or changes phone signs in with Google again and everything is back |
| Staying signed in | Yes. Supabase keeps the sign in on the device and renews it on every visit |
| Google sign in | Built with Supabase Auth: the database and sign in are on Supabase, the website on Vercel, the backend on Render. Design and build steps: `docs/19-supabase-build-plan.md` |
| Free saving | Free results can be saved for 7 days, on this browser |
| Paid saving | Paid results are saved without limit and kept for as long as the account exists |
| Mixed accounts | One account can hold paid and free reports. Each is labelled |
| What is sold | **Only single reports.** Each hadahan or porondam report is paid for on its own. No monthly or yearly plans, no passes |
| Price | **LKR 800** a report for buyers in Sri Lanka, **USD 2.50** a report for buyers abroad |
| Payments | Later. No gateway yet (PayHere does not accept astrology, docs/15). Coupons stand in until then |
| Coupons | A coupon gives a **percentage off** a report or makes it **free** (100% off). Until a payment provider is connected, only free (100%) coupons can unlock a report. The code `pamudu` makes a report free |
| Astro chat, free | 2 questions a week per browser (cookie). When they are used, show the option to buy a report |
| Astro chat, paid | Each paid report comes with its own chat allowance, limited by measured usage (section 5) |
| Compare | To be built: compare saved paid reports, with the AI analysing them. Detailed plan later (section 7) |

## 2. How people are recognised

| Who | How | If the cookie is lost |
|---|---|---|
| Visitor who never saved or chatted | Nothing stored | Nothing to lose |
| Free user | Cookie only | Free reports and the week's chat count are lost. My reports says so in one line |
| Paid user | Google sign in, kept on the device | Sign in with Google again: reports, paid items and chat usage come back |

- **Sign in with Google is asked only when it is needed:** when someone pays, uses a coupon, or wants their paid reports on another device. Free use never shows it.
- **Any Google account works,** not only Gmail addresses. People on iPhones can use a Google account too. Say so on the button ("Continue with Google").
- **Only basic identity is asked from Google:** the account id, the email and that it is verified. No contacts, no Drive, nothing else.
- **The guest becomes the Google account.** When a free user signs in, the reports saved on this browser move into the Google account. Only the browser holding the guest cookie can move them (the legal review asks for this proof). If the Google account already exists from another phone, the guest's reports join it.
- **Staying signed in:** the sign in lasts about a year and renews on each visit, so people are not asked again on their own phone.
- **Shared phones:** My reports has "Sign out of this phone" and a list of signed-in devices, each with "Sign out". A lost or sold phone can be signed out from another device.
- **Delete account** removes the account, its reports and its chat history. Order records are kept separately, as the law requires, and never hold birth details.

The technical design is in `docs/19-supabase-build-plan.md`: Supabase Auth handles anonymous users and Google, the browser sends the Supabase access token with each call, and the backend checks it with Supabase's public keys. Only the backend reads and writes the app's tables. Supabase's anonymous users become the Google account by linking, so the "guest becomes the Google account" step above needs no copying in the usual case.

## 3. Saving rules

| | Free result | Paid result |
|---|---|---|
| Who can save | Anyone, no sign in | A signed in user who paid or used a coupon for it |
| How long it is kept | 7 days from saving, then deleted | As long as the account exists |
| How many | Up to 20 at a time, to stop abuse | Unlimited (a high safety limit, for example 1,000) |
| Where | This browser only | The Google account, on any device |
| Label in My reports | "Free · deleted in 5 days" | "Paid" |
| Can be compared (section 7) | No | Yes |

- **Upgrading a free report.** "Get the full report" on a saved free report makes it paid. It stops expiring and keeps its place in the list.
- **A paid user who also uses free tools.** Their next free result saves as free and expires after 7 days, even though the account has paid reports. The label tells them which is which.
- **Expiry is real deletion,** not hiding. The privacy notice will say 7 days, so the data must be gone after 7 days.
- **Reminder before expiry.** A free report with 2 days or less left shows "Deleted in 2 days. Get the full report to keep it."
- **Child results** (baby names, first letters, or a chart with a child's birth date) are saved only by pressing Save, after the guardian consent box from the launch list. Never automatically, and never sent to the AI, paid or not (legal review).
- **A guest account with nothing left in it** (all free reports expired, no chat this week) is deleted, with its cookie.

### The note at the bottom of My reports

English draft, for the Sinhala reviewer to translate:

> Free reports are kept for 7 days. Paid reports are kept for as long as you have your account, on any device. Paid reports can also be compared with each other, with an explanation of how they match under the traditional rules.

Until compare is built, drop the last sentence or say "coming soon".

**Wording rule:** never "find the best match" or "the right partner". The terms say the site never tells anyone whom to marry, so compare shows scores under the traditional rules and leaves the decision to the family.

### How the 7 days are built (step 2, 2026-11-22)

- Each free saved report has `expires_at`, 7 days after it was saved. A paid one has none; the database refuses a free report without one or a paid report with one. Unlocking a saved free report sets its order and clears `expires_at` in one update, so it keeps its place in the list.
- **Deletion is done by the database:** an hourly Supabase Cron (`pg_cron`) job runs `sidera.delete_expired_reports()` (migration `20261122090000_free_reports_expire.sql`). Supabase Cron works on every plan. A job inside the backend would not do: Render's free plan puts the backend to sleep when nobody visits.
- The backend also deletes an account's expired reports whenever it reads them, so nobody sees a report after its time, even in the hour before the job runs.
- Limits: 20 free reports at a time (`ASTRONOMIA_FREE_SAVED_LIMIT`), counted apart from paid ones (`ASTRONOMIA_PAID_SAVED_LIMIT`, 1,000). Saving the same report again does not restart its 7 days.
- My reports labels each report "Paid" or "Free · deleted in N days" (days counted up), shows the reminder with a "Get the full report" button at 2 days or less, and the note above, with compare as "coming soon".

## 4. Prices and coupons

### Prices

**Only single reports are sold.** Each hadahan or porondam report is paid for on its own. There are no monthly or yearly plans and no passes.

| Buyer | Price of one report |
|---|---|
| In Sri Lanka | **LKR 800** |
| Abroad | **USD 2.50** |

- **Which price a buyer sees** follows their country at checkout: LKR in Sri Lanka, USD everywhere else. The payment provider, once there is one, settles which currencies it can take.
- The two prices are close in value (USD 2.50 is roughly LKR 750 at about 300 rupees to the dollar), so neither group pays much more than the other.
- Prices live on the server, never in the website code, so a changed page cannot change a price.
- Each paid report records the price, currency and any coupon used, so receipts and refunds are exact.

### Coupons

Until a payment provider approves astrology reports, coupons are the only way to unlock a paid report. Later the same records carry real payments, so nothing is thrown away.

**What a coupon does:** it takes a **percentage off** the price of one report. 100% off makes the report **free**.

| Coupon | Example | Works now? |
|---|---|---|
| Free (100% off) | `pamudu` | **Yes.** Nothing is left to pay |
| Discount (for example 20% off) | `SIDERA20`: LKR 640 or USD 2.00 | **Only once payments exist.** Something is still left to pay, and there is nothing to take the payment with yet |

So the build includes percentage coupons from the start, but only 100% coupons are switched on until checkout exists.

**How it works for the user**

1. On a result, "Get the full report" opens a short form showing the price.
2. Continue with Google, if not signed in already.
3. "Have a coupon?": they type the code and press Apply. The form shows the new price.
4. At 100% off, the button says "Unlock free" and the report becomes paid at once. The receipt goes to the Google email.

**Rules for coupons** (all on the server)

| Rule | Why |
|---|---|
| Codes live in the database, never in the website code or the repository | Anyone can read the website's code in their browser. A code there is public |
| Each code has: the percentage off (1 to 100), which reports it applies to (hadahan, porondam or both), how many times it can be used in total, how many times one account can use it, an end date, and on/off | `pamudu` can be stopped at once if it spreads |
| One use unlocks one report | A free code cannot unlock everything at once |
| Not case sensitive, spaces ignored | People type on phones |
| Wrong guesses are limited, for example 10 an hour per account | Stops people trying codes until one works |
| Every use is recorded: code, account, report, price before and after, time | Shows who used it, and lets you undo misuse |
| Every unlock is recorded as an order: price, currency, coupon, amount paid (0 for a free coupon), method | When payments arrive, a paid order is the same record with an amount paid, so the rest of the site does not change |

Suggested: `pamudu` is 100% off any report, up to 10 uses per account and 200 in total, ending 2027-06-30, for testers, friends and family. Make new codes for any promotion rather than reusing it.

**Legal:** no money changes hands while only free coupons work, so refund and tax rules do not apply yet. The privacy notice needs a line on Google sign in: the account id and email are kept to recognise the paid user and send receipts, nothing else. Discount coupons and real prices bring in the refunds policy (`docs/policies/refunds.md`) once payments exist.

## 5. Astro chat limits

Built (step 5): how it works, where the limits are enforced, the settings and how to turn them on are in `docs/21-chat-limits.md`.

### Free users: 2 questions a week

- Counted per browser, by the cookie. The week starts on the first question and lasts 7 days.
- The chat shows what is left: "1 free question left this week".
- When both are used, the chat box is replaced by: "You've used this week's 2 free questions. They come back on [date]. Get a full report to keep asking." with the "Get the full report" (or coupon) button.
- **Explain buttons and the full reading** are part of a paid report (section 6), so they do not use the free questions.

**A known gap:** clearing the cookie or opening a private window gives 2 more questions. For 2 questions this is acceptable. To stop heavy abuse, also keep a quiet limit per network address (for example 10 free questions a week) and add bot protection before the chat goes public (docs/09).

### Paid reports: an allowance for each report, measured by usage

Every AI answer costs money, so paid chat has a limit, but a generous one.

- **Each paid report adds a chat allowance** to the account, for example about 20 questions' worth. Two paid reports give twice as much. The allowance stays until it is used.
- **Measure each answer's real cost:** the AI provider reports the tokens used for every reply, and the AI service records them against the account. A long answer uses more of the allowance than a short one.
- **People see plain words, not tokens:** "About 15 questions left" or a bar that empties, worked out from the average cost of an answer.
- **Close to the end:** a gentle note at 80%. At the end: "You've used the chat that came with your reports. Get another full report to keep asking."
- **The full reading and Explain buttons** of a paid report do not use the chat allowance. They are part of what the report includes.
- **A hard ceiling** on the server stops any one account running up a large bill, whatever happens.
- **Usage records keep only numbers** (account, date, tokens, cost), never the question text. This matches the privacy promise that chat text is not logged.

## 6. What paid users get

The rule from docs/07 stays: **free shows the facts and a one line reason, paid adds depth.** The free result must still beat a competitor's free result.

### Free, for everyone

- Every calculation: hadahan, porondam (all 20 factors, Rajju and Vedha), Kuja dosha present or not, dasha main periods, nakath, Avurudu, baby name letters, old horoscope search
- One line reasons on every result
- PDF of the free result
- Share link of the free result
- Save for 7 days, on this browser
- Astro chat: 2 questions a week

### Paid: one report, LKR 800 or USD 2.50

**Hadahan report** (one person's chart):

| What | Detail |
|---|---|
| Keep it | Saved without limit, on any device through Google sign in |
| Full AI reading | The 12 chapter chart reading (docs/17) |
| Explain buttons | On every place in the result |
| Full detail | Kuja dosha with every cancellation rule; all dasha sub periods and what each means for this chart |
| Forecast | The 12 month personal forecast and key dates for this chart |
| Full PDF | Everything above, in Sinhala and English in one file |
| Full share | The share link shows the paid result, so the family and their astrologer see it without paying again |
| Chat | The chat allowance that comes with each report (section 5) |
| Compare | Can be used in compare (section 7) |

**Porondam report** (one couple's match):

| What | Detail |
|---|---|
| Keep it | Saved without limit, on any device through Google sign in |
| Full AI reading | The 10 chapter match reading (docs/17) |
| Explain buttons | On every place in the result |
| Full detail | Each porondam factor explained; Kuja dosha with every cancellation rule and the couple comparison |
| Wedding nakath | The full list of dates for engagement, poruwa and homecoming |
| Full PDF | Everything above, in Sinhala and English in one file |
| Full share | The share link shows the paid result |
| Chat | The chat allowance that comes with each report (section 5) |

**Never paid for, at any level:** remedies, gems or pujas; telling anyone whether to marry; AI readings of a child's chart.

## 7. Compare reports (to build; detailed plan later)

**The idea.** Compare saved reports with each other, and let the AI analyse them. The main use: one person is fixed (the user's own hadahan, as the bride or the groom), and other saved hadahan charts are compared against it.

**Outline**

1. In My reports, choose a saved paid hadahan as "This is me", with bride or groom chosen once.
2. Choose the other saved paid charts to compare.
3. The engine works out the porondam for each pair: the score, Rajju and Vedha, Kuja dosha for both. These are the facts, the same as on the match page.
4. The AI then analyses them: what each pair has in common, where they differ, the strengths and areas to work on in each, in plain words. It uses only the engine's results, as the full reading does.
5. Tapping one opens the full porondam result for that pair.

**Rules to carry into the detailed plan**

- **Paid reports only:** every chart in a comparison must be a paid hadahan report. There is no separate charge for comparing; paying for the charts is what unlocks it.
- **Full birth details** for both, since Dina, Graha and Kuja dosha need them. Charts with only a birth star say which factors they leave out.
- **Consent:** each other person's chart needs the "both adults agreed" confirmation from the launch list before it is compared.
- **The AI explains, it does not choose.** The order comes from the engine's score. The AI may describe each pair and the trade-offs, but never names one person as the one to marry. This is the same rule as the match reading (docs/17) and the terms.
- **Costs:** an analysis of several pairs is a long AI answer, so it uses the account's chat allowance (section 5).

**Open for the detailed plan:** comparing other kinds of report (two match results side by side, two dates), how many charts at once, and whether the comparison can be saved and shared.

## 8. Build order

| # | Step | Needs a payment provider? |
|---|---|---|
| 1 | **Supabase database and sign in:** the database on Supabase, anonymous users for guests, Continue with Google, the guest's reports moving into an existing Google account, sign out, delete account (docs/19, steps 1 to 5) | No |
| 2 | Free saves expire after 7 days (deleted); labels "Free" and "Paid"; the note at the bottom of My reports; the 20 free report limit | No |
| 3 | Prices and coupons: the price list (LKR 800, USD 2.50), the orders and coupons tables, the "Get the full report" form with Apply coupon, percentage and free coupons (only 100% switched on), the wrong guess limit | No |
| 4 | The paid check: `save_access()` and `canUse()` read which reports the account has paid for, so paid content shows only for those reports, on the website and in the AI service | No |
| 5 | Astro chat limits: 2 free questions a week by cookie, the "Get the full report" prompt, the chat allowance added by each paid report, usage measuring, the hard ceiling | No |
| 6 | Privacy notice and terms updated for Google sign in, the 7 day rule, coupons and chat limits | No |
| 7 | Compare reports, after its detailed plan | No |
| 8 | Real payments through an approved provider: checkout at LKR 800 or USD 2.50, discount coupons switched on, receipts and refunds | Yes |

Steps 1 to 5 give the full free and paid experience with free coupons, before any payment provider.

## 9. Decisions

**Decided (2026-11-21):** pay per report only; LKR 800 in Sri Lanka and USD 2.50 abroad; coupons give a percentage off or make a report free.

| # | Still to decide | Suggested |
|---|---|---|
| 1 | The limits for `pamudu` | 100% off any report, 10 uses per account, 200 in total, ending 2027-06-30 |
| 2 | The largest discount a paid coupon may give, once payments exist | 50%, except free codes made on purpose |
| 3 | The chat allowance each paid report adds | About 20 questions' worth. Measure real costs with `pamudu` users first, then adjust |
| 4 | Free report limit at one time | 20 |
| 5 | The quiet per-network limit on free chat | 10 free questions a week per address |
| 6 | What happens to a paid account nobody opens for years? | Keep it. Delete only on request, or after 3 years unused with an email warning 30 days before |
| 7 | Is an email sending service needed now? | Only for receipts, and for Supabase's sign in emails if email codes are added. It can wait until payments |
