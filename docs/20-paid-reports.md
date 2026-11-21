# Paid reports: prices, coupons and the paid check

Date: 2026-11-21. Steps 3 and 4 of the build order in `docs/18-saving-paid-and-compare.md`, built in
PR #66. Docs/18 is the plan; this file records what was built, how it is switched on, and the gaps
that are known and left open.

## What was built

| Part | Where |
|---|---|
| Price list: LKR 800 in Sri Lanka, USD 2.50 elsewhere, per report | `backend/app/tiers/prices.py` (server only, in cents) |
| Coupons, orders and wrong guesses | `supabase/migrations/20261121142841_orders_and_coupons.sql`, `backend/app/store/orders.py` |
| Endpoints: price, paid check, apply a coupon, unlock with a free coupon | `backend/app/api/paid.py` |
| The paid check, one place | `report_access()` in `backend/app/tiers/__init__.py` |
| Website check | `canUse()` in `frontend/lib/entitlements.ts`, `frontend/components/paid/` |
| Sign in for a report | `signInForReport()` in `frontend/lib/paid.ts`: saves the report (as a guest if needed), then "Continue with Google" brings the visitor back to it in My reports |
| AI route check (chart and match chapters) | `frontend/app/api/explain/route.ts`, `frontend/lib/paidCheck.ts` |
| The owner's coupon script | `backend/scripts/coupons.py` (create, list, on, off, void) |

A paid report unlocks the full AI reading, the explain buttons, the full detail (every Kuja dosha
rule) and the full PDF with the AI reading. Every unlock is an order with the price, currency,
coupon and amount paid (0 for a free coupon), method `coupon`. There is no payment provider, so
only 100% coupons can unlock a report; discount coupons show their price and answer "payment not
available yet".

## The switch

`ASTRONOMIA_PAID_REPORTS` on the backend. Off: everyone has every feature and the form is hidden.
On: paid features show only on reports the account unlocked; everyone else gets the free result and
the "Get the full report" form.

**Decided 2026-11-21: on for staging** (`render.yaml`). It takes effect when PR #66 deploys, which is
after the Google sign in PR (#67), so visitors can sign in and use a coupon from the first day.

## Staging (2026-11-21)

- The orders and coupons migration is applied to the Supabase staging project (version
  `20261121142841`). Security and performance advisors: notices only (row level security without
  policies, which is intended; no primary key on `coupon_misses`; new indexes not yet used).
- The coupon `pamudu` is made: 100% off any report, 10 uses per account, 200 in total, works until
  the end of 2027-06-30 Sri Lanka time.
- Not applied yet: #67's `drop_guest_sessions` migration (#67 is merged). It drops the old
  `sidera.sessions` table, which the code no longer uses, and deletes guest accounts that are not
  Supabase users. Harmless to leave for now; it needs the owner's approval to apply.

## Known gaps (recorded 2026-11-21)

| # | Gap | Effect | Possible fix |
|---|---|---|---|
| 1 | The AI route checks that the report sent with a request is paid, but cannot prove that the AI's input (the page's facts) belongs to that report | Someone who unlocked one report could, by crafting requests, get chapters written for another chart | Have the server build the facts from the report itself, or sign the facts with the report |
| 2 | Shared links show only the free result while paid features are on. "Full share" (docs/18, section 6) is not built | The family and their astrologer do not see the paid result through a share link | Record the order on the share link when a paid report is shared, and let its viewers have the paid features |
| 3 | Porondam has no extra detail on the page to lock | Full detail on a match is only the AI reading and the PDF; docs/18 lists each factor explained and the couple Kuja comparison | Decide what porondam detail is paid, then gate it with `full_detail` |
| 4 | Order records keep a hash of the request (the birth details) after an account is deleted | Not the details themselves, but birth details are few enough that the hash could be matched by trying them | Clear `report_hash` from orders when an account is deleted, or hash with a server secret |
