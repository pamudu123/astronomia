# Saving, paid reports, coupons, chat limits and compare

Date: 2026-11-21. Updated the same day with the owner's changes.

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
| Payments | Later. No gateway yet (PayHere does not accept astrology, docs/15). A coupon stands in: the code `pamudu` counts as paid |
| Astro chat, free | 2 questions a week per browser (cookie). When they are used, show the option to buy |
| Astro chat, paid | More chat, limited by measured usage (section 5) |
| Compare | To be built: compare saved reports, with the AI analysing them. Detailed plan later (section 7) |

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

## 4. Coupons, in place of payment

Until a payment provider approves astrology reports, a coupon is the only way to become paid. Later the same path records real payments, so nothing is thrown away.

**How it works for the user**

1. On a result, "Get the full report" (or "Buy more chat" when the free questions run out) opens a short form.
2. Continue with Google, if not signed in already.
3. "Have a coupon?": they type `pamudu` and press Unlock.
4. The account becomes paid at once. The receipt goes to the Google email.

**Rules for the coupon** (all on the server)

| Rule | Why |
|---|---|
| Codes live in the database or server settings, never in the website code or the repository | Anyone can read the website's code in their browser. A code there is public |
| Each code has: what it unlocks, how many times it can be used, an end date, and on/off | `pamudu` can be stopped at once if it spreads |
| Not case sensitive, spaces ignored | People type on phones |
| Wrong guesses are limited, for example 10 an hour per account | Stops people trying codes until one works |
| Every use is recorded: code, account, what it unlocked, time | Shows who used it, and lets you undo misuse |
| A coupon use is recorded as an order with price 0 and method "coupon" | When payments arrive, a paid order is the same record with a price, so the rest of the site does not change |

**What a coupon unlocks:** two kinds of code, so both ways of selling can be tested:

- **Report code:** makes one hadahan or porondam result paid.
- **Pass code:** makes the whole account paid for a set time (for example 30 days or 1 year), covering every result, compare and the paid chat allowance in that time.

Suggested: make `pamudu` a pass code with an end date and a use limit, for testers, friends and family. Make new codes for any promotion rather than reusing it.

**Legal:** no money changes hands, so refund and tax rules do not apply yet. The privacy notice needs a line on Google sign in: the account id and email are kept to recognise the paid user and send receipts, nothing else.

## 5. Astro chat limits

### Free users: 2 questions a week

- Counted per browser, by the cookie. The week starts on the first question and lasts 7 days.
- The chat shows what is left: "1 free question left this week".
- When both are used, the chat box is replaced by: "You've used this week's 2 free questions. They come back on [date]. Get more with a paid report or pass." with the buy (or coupon) button.
- **Explain buttons and the full reading** are paid features (section 6), so they do not use the free questions.

**A known gap:** clearing the cookie or opening a private window gives 2 more questions. For 2 questions this is acceptable. To stop heavy abuse, also keep a quiet limit per network address (for example 10 free questions a week) and add bot protection before the chat goes public (docs/09).

### Paid users: limited by measured usage

Paid users get much more chat, but not unlimited, because every AI answer costs money.

- **Measure each answer's real cost:** the AI provider reports the tokens used for every reply, and the AI service records them against the account.
- **Each plan has an allowance per period,** set in money or tokens on the server. For example, a pass might allow about 1 US dollar of AI use a month. The exact figure follows the prices.
- **People see plain words, not tokens:** "About 40 questions left this month" or a bar that fills up, worked out from the average cost of an answer.
- **Close to the limit:** a gentle note at 80%. At the limit: "You've reached this month's chat allowance. It renews on [date]." A long full reading and a short question cost different amounts, which is why usage is measured, not counted.
- **A single report** includes a small chat allowance for questions about that report, for example 10 questions.
- **A hard ceiling** on the server stops any one account running up a large bill, whatever the plan says.
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

### Paid: a single report

For one hadahan or one porondam result:

| What | Detail |
|---|---|
| Keep it | Saved without limit, on any device through Google sign in |
| Full AI reading | The 12 chapter chart reading or the 10 chapter match reading (docs/17) |
| Explain buttons | On every place in that result |
| Full detail | Kuja dosha with every cancellation rule and the couple comparison; all dasha sub periods and what each means for this chart; each porondam factor explained |
| Full PDF | Everything above, in Sinhala and English in one file |
| Full share | The share link shows the paid result, so the family and their astrologer see it without paying again |
| Chat about it | A small chat allowance for this report |

### Paid: a pass (all of the above for every result, plus)

| What | Detail |
|---|---|
| Every result paid | Every chart and match made while the pass lasts |
| Compare | Compare saved reports, with the AI's analysis (section 7) |
| Forecasts | The 12 month personal forecast and key dates |
| Wedding nakath | The full list of dates for engagement, poruwa and homecoming |
| More chat | The monthly chat allowance (section 5) |
| Later | Email reminders before key dates (opt in) |

**Never paid for, at any level:** remedies, gems or pujas; telling anyone whether to marry; AI readings of a child's chart.

## 7. Compare reports (to build; detailed plan later)

**The idea.** Compare saved reports with each other, and let the AI analyse them. The main use: one person is fixed (the user's own hadahan, as the bride or the groom), and other saved hadahan charts are compared against it.

**Outline**

1. In My reports, choose a saved hadahan as "This is me", with bride or groom chosen once.
2. Choose the other saved charts to compare.
3. The engine works out the porondam for each pair: the score, Rajju and Vedha, Kuja dosha for both. These are the facts, the same as on the match page.
4. The AI then analyses them: what each pair has in common, where they differ, the strengths and areas to work on in each, in plain words. It uses only the engine's results, as the full reading does.
5. Tapping one opens the full porondam result for that pair.

**Rules to carry into the detailed plan**

- **Paid only:** the charts must be paid reports, or the account has a pass.
- **Full birth details** for both, since Dina, Graha and Kuja dosha need them. Charts with only a birth star say which factors they leave out.
- **Consent:** each other person's chart needs the "both adults agreed" confirmation from the launch list before it is compared.
- **The AI explains, it does not choose.** The order comes from the engine's score. The AI may describe each pair and the trade-offs, but never names one person as the one to marry. This is the same rule as the match reading (docs/17) and the terms.
- **Costs:** an analysis of several pairs is a long AI answer, so it uses the paid chat allowance (section 5) or has its own allowance.

**Open for the detailed plan:** comparing other kinds of report (two match results side by side, two dates), how many charts at once, and whether the comparison can be saved and shared.

## 8. Build order

| # | Step | Needs a payment provider? |
|---|---|---|
| 1 | **Supabase database and sign in:** the database on Supabase, anonymous users for guests, Continue with Google, the guest's reports moving into an existing Google account, sign out, delete account (docs/19, steps 1 to 5) | No |
| 2 | Long-lived sign in that renews on each visit; free saves expire after 7 days (deleted); labels "Free" and "Paid"; the note at the bottom of My reports; the 20 free report limit | No |
| 3 | Orders and coupons: the coupon table, the unlock form, recording a coupon as a price 0 order, report codes and pass codes, the wrong guess limit | No |
| 4 | The paid check: `save_access()` and `canUse()` read the account's paid reports and pass, so paid content shows only when unlocked, on the website and in the AI service | No |
| 5 | Astro chat limits: 2 free questions a week by cookie, the "buy more" prompt, usage measuring and allowances for paid accounts, the hard ceiling | No |
| 6 | Privacy notice and terms updated for Google sign in, the 7 day rule, coupons, passes and chat limits | No |
| 7 | Compare reports, after its detailed plan | No |
| 8 | Real payments through an approved provider, recorded as orders with a price | Yes |

Steps 1 to 5 give the full free and paid experience with coupons, before any payment provider.

## 9. Decisions still needed

| # | Question | Suggested |
|---|---|---|
| 1 | What `pamudu` unlocks: one report, or a pass? For how long, and how many uses? | A pass for 1 year, 50 uses, ending 2027-06-30 |
| 2 | Free report limit at one time | 20 |
| 3 | The paid chat allowance: per month, and how much for a pass and for a single report | Set once prices are known. Measure real costs with coupon users first |
| 4 | The quiet per-network limit on free chat | 10 free questions a week per address |
| 5 | What happens to a paid account nobody opens for years? | Keep it. Delete only on request, or after 3 years unused with an email warning 30 days before |
| 6 | Single report first, or the pass first, once payments exist | Single report first |
| 7 | Prices for the single report and the pass, in LKR and USD | Open |
| 8 | Is an email sending service needed now? | Only for receipts, and for Supabase's sign in emails if email codes are added. Google sign in removes the need for recovery emails, so this can wait until payments |
