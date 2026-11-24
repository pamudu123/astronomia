# Buying a report

Date: 2026-11-23. How a full report is bought: the invitation, the buying page, codes, payment and
the optional Google sign in. It updates `docs/18` (sections 2 and 4) and `docs/20`: where they say a
paid report needs Google sign in, this file wins.

## What the owner decided (2026-11-23)

- A locked place invites the visitor to buy that report. It never shows a bare "Part of the full report".
- The buying page takes a coupon or discount code and shows the final amount.
- If the final amount is not zero, nothing unlocks without a payment. If it is zero, it unlocks at once.
- After that, signing in with Google to save reports is offered, and is optional.
- No payment gateway is connected yet, so its behaviour is mocked.

## The flow

1. **Invitation** (`BuyInvite`): on every explain button, the topic chips, the full reading card and the
   Kuja dosha rules, for hadahan and porondam. It says what the report adds, its price and "Buy this
   report". A shared result has nothing to buy, and says to make your own.
2. **Buying page** (`/{lang}/buy`): the report, what is in it, the price, a code with Apply and Remove,
   the discount and the amount to pay. The report travels in this tab's storage, never in the address.
3. **Amount 0:** "Unlock the report" (`POST /v1/reports/unlock`).
   **Amount above 0:** "Pay LKR 640" starts a payment (`POST /v1/checkout`). With no provider, there is no
   pay button: the page says the report stays locked.
4. **Payment:** the mock provider's page (`/{lang}/buy/test-payment`), then `/{lang}/buy/done`, which asks
   the server what became of it. Opening that page by hand proves nothing.
5. **Unlocked:** open the report, or sign in with Google to save it. Skipping keeps it on this browser.

## Who owns a bought report

The account that bought it. A browser with no account becomes a Supabase guest when it unlocks or pays,
with nothing asked, exactly as the first Save does. Then:

| What happens | Result |
|---|---|
| Nothing | The report stays unlocked on this browser, for as long as its data is kept |
| The guest signs in with a new Google account | Same account id, so everything stays |
| The guest's Google account already exists | Orders, payments, AI chapters, chat use and saved reports move into it (`POST /v1/me/merge-guest`) |
| Both had paid for the same report | The Google account keeps its own order |

The daily clean up never deletes a guest with an order.

## Codes

- Codes are rows in the database, added with `backend/scripts/coupons.py`. None is in the website or the
  repository. `pamudu` (100% off) was already made on staging on 2026-11-21 (docs/20).
- **Capital letters and spaces do not matter:** `pamudu`, `PAMUDU` and `Pam udu` are the same code. People
  type on phones.
- Anyone can try a code, with no account. Wrong codes are limited to 10 an hour per account and 30 an hour
  per network address, since a new guest is easy to make. The address count is in memory, so it starts
  again when the backend restarts.
- A code's limit per account is now a limit per guest too, and one person can make several guests. The
  total limit (200 for `pamudu`) is what really bounds a free code.
- A payment on its way holds its code's use for an hour.

## Payment

| Part | Where |
|---|---|
| The list price | `backend/app/tiers/prices.py` (unchanged: LKR 800, USD 2.50) |
| Starting, settling, moving | `backend/app/store/orders.py`: `start_payment`, `settle`, `move_user` |
| Endpoints | `backend/app/api/checkout.py` |
| Providers | `backend/app/payments/`; today only `mock.py` |
| Table | `supabase/migrations/20261123184715_payments.sql` |

An order is what unlocks a report, and there are two ways to get one: a code that leaves nothing to pay,
or `settle`, called with a notice whose signature was checked. `settle` also checks the provider, the
amount and the currency against the payment as it was started. The reports, the full PDF and the AI
chapters all look at the order, through `report_access()`.

### The mock provider

It takes no money. The buyer picks how the payment ends, and the mock signs a notice with a key only the
server process has, which goes through the same check as a real one.

`ASTRONOMIA_PAYMENT_PROVIDER`: `auto` (the default: mock on a developer's computer, off everywhere else),
`off`, or `mock`. Production refuses to start with `mock`. **With mock on, anyone who can open the site
can unlock any report for nothing,** so on staging it should stay behind the staging password.
Its orders have `provider = 'mock'`. To undo them all before real sales start:

```sql
update sidera.orders set status = 'void' where provider = 'mock';
```

### Connecting a real provider

1. Choose one that accepts astrology in writing (docs/15; none has yet).
2. Add its module beside `mock.py` with a `verify` that turns its signed call into a `Notice`.
3. Add its webhook in `checkout.py`, calling `_take`. It must skip the staging password (docs/15, 7.2).
4. Add its name to `Settings.payment_provider` and `checkout`, and send the buyer to its page instead of the
   test page (`BuyApp.tsx`).
5. Then the rest of docs/15, "Before charging anything": receipts, refunds, the immediate delivery
   consent, tax and the terms.

## Before this is deployed

1. **Apply the migration `20261123184715_payments.sql` first.** The new backend checks for its table.
   The old backend keeps working with it applied. **Applied to staging on 2026-11-24** (the owner's
   OK; row level security on, no rights for the public roles, advisors show nothing new). Production still
   needs it.
2. Supabase needs anonymous sign ins and manual linking on (docs/19 says staging has both).
3. `ASTRONOMIA_PAYMENT_PROVIDER=mock` is set for staging in `render.yaml` (decided 2026-11-24). Leave it
   out of production: there, without it, only free codes unlock.

## Known gaps

| # | Gap |
|---|---|
| 1 | The Kuja dosha rules (`full_detail`) are hidden by the page only: the free chart answer still carries them, as before. The PDF, the AI chapters and the AI reading are locked on the server |
| 2 | Docs/20, gap 1 is still open: an account that unlocked one report could ask the AI for another chart's chapters by crafting requests |
| 3 | No receipt is sent. A guest has no email |
| 4 | The new Sinhala text needs the Sinhala reviewer, and the changed privacy and terms lines need the legal reviewer |
| 5 | If a payment is confirmed but the tab's storage was cleared, the report is unlocked but not in My reports until it is opened and saved again |
