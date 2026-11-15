# Payments with PayHere

Date: 2026-11-15

How the site takes money: which gateway, what it costs, how a payment flows through the backend and the site, how it is tested, and what is left before payments go live. This is the plan for step 18 in `docs/08-implementation-plan.md`.

Fees and limits below come from PayHere's own pages, but those pages disagree with each other in places. **Confirm them with PayHere (0115 339 339) before setting prices.**

## 1. The decision

**PayHere is the only gateway at launch.** One gateway covers both groups of buyers:

| Buyer | How they pay through PayHere |
|---|---|
| In Sri Lanka | Local Visa, Mastercard, Amex, mobile wallets (eZ Cash, mCash, Genie and others), bank payments |
| Overseas (diaspora) | Foreign Visa, Mastercard, Amex. Charged in USD, settled to us in LKR |

Why not the others:

| Option | Why not now |
|---|---|
| Stripe | Does not take Sri Lankan businesses. Only possible through a US company (Stripe Atlas), which adds US tax filings |
| PayPal | Launched in Sri Lanka in May 2026, but bank withdrawals were unclear. PayHere already takes foreign cards. Add later only if overseas buyers ask for it |
| Merchant of record (Paddle, Dodo, Polar, Lemon Squeezy) | About 4 to 5% plus 50 US cents. Worth it only when overseas sales are big enough that foreign VAT matters. Check first that they pay out to Sri Lanka |
| Bank gateway (Sampath, Commercial, HNB) | Can be cheaper, but slow to set up and harder to run. Only at high volume |
| WebXPay, Genie Business, OnePay, DirectPay | Similar to PayHere. Kept as the backup if PayHere refuses or changes its terms |

**When to add a second gateway:** the `orders` table records the country and the result of each payment. Look at it after launch. If overseas card payments fail often, or buyers ask for PayPal, add PayPal or a merchant of record then.

## 2. Plans and fees

| Plan | Monthly fee | Per payment | Notes |
|---|---|---|---|
| Lite | None | 3.30% | Limits of Rs. 50,000 a payment and Rs. 200,000 a month (support page). Settled in LKR |
| Plus | Rs. 3,990 (support page) | 2.99% | Higher limits. Needed for USD payouts |
| Premium | Ask | Ask | No monthly limit |

- Foreign currency payments cost **1% more** on top of the plan's fee.
- Money arrives two days after the payment (T+2).
- The plan can be changed at any time.
- **Recurring payments:** the fees page says Lite includes them, the support page says Lite takes one time payments only. Ask PayHere.

**Start on Lite.** It costs nothing until something sells. Move to Plus when sales get close to the Lite monthly limit (Rs. 200,000), or when USD payouts are wanted. The lower fee alone does not pay for Plus: 0.31% saved covers the Rs. 3,990 fee only above about Rs. 1.3 million a month.

## 3. What is sold at launch

Only one time payments at first. They work on every plan, and there is nothing to renew, fail or cancel.

| Product | Type | What it unlocks |
|---|---|---|
| Single report | One time | The paid level of one hadahan or one porondam result, and its paid PDF |
| Membership pass | One time, for a fixed time (for example 30 days or 1 year) | Every paid feature until the pass ends |

- Prices are still open (docs/07, section 5). Show LKR to visitors in Sri Lanka and USD to everyone else. The price list lives in the backend, never in the page, so a changed page cannot change a price.
- An automatically renewing membership comes later, through PayHere's recurring API (section 10). Many local buyers prefer not to leave a card on file, so a pass may be enough.

## 4. Setting up the PayHere account (owner)

| # | Task | Notes |
|---|---|---|
| 1 | Create a **sandbox** account at sandbox.payhere.lk | Free, no papers. Used for all building and testing |
| 2 | Note the **Merchant ID** | Settings in the PayHere dashboard |
| 3 | Add the staging domain under **Settings > Domains & Credentials** and copy its **Merchant Secret** | One secret per domain. Approval can take up to 24 hours. Vercel preview addresses change, so register the fixed staging address only |
| 4 | Set the secret and ID in Render (section 6.1) | Never in the repository |
| 5 | Create the **live** account at payhere.lk | Needs business registration (or NIC for a sole owner), a bank account in the business name, and the site's terms, privacy and refund pages |
| 6 | Add the production domain to the live account, copy its secret | A separate secret from the sandbox one |
| 7 | Later: create an **API key** (Settings > API Keys) | Only for looking up and refunding payments (section 7.3). Live calls also need the server address approved by PayHere support |

## 5. How a payment works

```
Visitor            Site (Next.js)            Backend (FastAPI)              PayHere
   |  Buy  -------->  |                           |                            |
   |                  |  POST /v1/payments/checkout --> create order (pending) |
   |                  |  <---- checkout fields + hash                          |
   |  form posts the fields to PayHere checkout --------------------------->   |
   |  pays on PayHere's page ---------------------------------------------->   |
   |                  |                           |  <-- POST notify (server to server)
   |                  |                           |  check md5sig, amount, currency
   |                  |                           |  mark paid, grant entitlement
   |  <-- PayHere sends the visitor to return_url  |                            |
   |  return page asks GET /v1/payments/orders/{id} until paid or failed       |
```

The rules that keep it safe:

1. **Only the notify call unlocks anything.** PayHere passes no status to `return_url`, and a visitor could open that page by hand. The return page only reads the order's status from the backend.
2. **The hash is made on the backend.** The merchant secret never reaches the browser.
3. **Every notify is checked** before it changes anything: the `md5sig`, our merchant ID, and that the amount and currency equal what the order was created with.
4. **A notify can arrive twice.** Granting is done once per order. A repeat changes nothing.
5. **The checkout form is posted by the visitor's browser** from our own registered domain. PayHere refuses checkouts that do not come from the registered domain (it checks the Referer).

### 5.1 PayHere status codes

| `status_code` | Meaning | What we do |
|---|---|---|
| 2 | Success | Mark paid, grant what was bought |
| 0 | Pending | Keep pending. A later notify brings the result |
| -1 | Cancelled by the buyer | Mark cancelled. Nothing unlocked |
| -2 | Failed | Mark failed. Nothing unlocked |
| -3 | Charged back | Mark charged back and **take the entitlement away** |

## 6. Backend

### 6.1 Settings

Added to `backend/app/config.py`, same `ASTRONOMIA_` prefix:

| Variable | Meaning |
|---|---|
| `ASTRONOMIA_PAYHERE_MERCHANT_ID` | From the PayHere dashboard |
| `ASTRONOMIA_PAYHERE_MERCHANT_SECRET` | The secret for this site's domain. Secret, dashboard only |
| `ASTRONOMIA_PAYHERE_SANDBOX` | `true` on staging and locally, `false` in production |
| `ASTRONOMIA_PUBLIC_URL` | The site's address, used to build `return_url`, `cancel_url` and `notify_url` |
| `ASTRONOMIA_PAYHERE_APP_ID`, `ASTRONOMIA_PAYHERE_APP_SECRET` | Later, for lookups and refunds. Secret |

When the merchant ID is empty, the payment endpoints answer 503 and the paid features stay as the setting from step 13 decides. Local runs and tests work without a PayHere account.

Checkout address: `https://sandbox.payhere.lk/pay/checkout` in the sandbox, `https://www.payhere.lk/pay/checkout` live (the `www` is needed).

### 6.2 Where the code goes

| File | What it holds |
|---|---|
| `backend/app/payments/payhere.py` | The hash, the notify check, the checkout fields. No database, no FastAPI, so it is easy to test |
| `backend/app/payments/catalog.py` | Products and prices in LKR and USD |
| `backend/app/store/orders.py` | The orders and entitlements tables, SQLite and PostgreSQL, the same way `store/shares.py` does it |
| `backend/app/api/payments.py` | The three endpoints below |
| `backend/app/tiers/` | Reads entitlements. The `*_access()` gates (`yearly_access()`, `wedding_access()` and the others) ask it |

### 6.3 Endpoints

| Endpoint | Who calls it | What it does |
|---|---|---|
| `POST /v1/payments/checkout` | The site, for a signed in user | Body: product and, for a single report, which result. Creates a pending order and returns the PayHere address and form fields, hash included |
| `POST /v1/payments/payhere/notify` | PayHere only | Form encoded, not JSON. Checks and records the result. Always answers 200 once the signature is good, so PayHere does not keep calling |
| `GET /v1/payments/orders/{order_id}` | The return page | The order's status. Only for the account that owns it |

### 6.4 Tables

`orders`:

| Column | Notes |
|---|---|
| `order_id` | Random and hard to guess, for example `SD-` and 16 random letters. Sent to PayHere |
| `account_id` | Who is buying |
| `product`, `item_ref` | What is bought. `item_ref` points at the report for a single report |
| `amount_cents`, `currency` | Whole cents, never floats. Sent as `1500.00` |
| `status` | `pending`, `paid`, `cancelled`, `failed`, `charged_back` |
| `payhere_payment_id`, `method` | From the notify |
| `created_at`, `updated_at` | |

`entitlements`: `account_id`, `kind` (`report` or `pass`), `item_ref`, `starts_at`, `ends_at`, `order_id`. One row per paid order, made in the same database transaction that marks the order paid. A unique key on `order_id` makes a repeated notify harmless.

Card details from the notify (`card_holder_name`, `card_no`, `card_expiry`) are **not stored and not logged**.

### 6.5 The hash and the notify check

```python
import hashlib
import hmac
from decimal import Decimal


def _md5_upper(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest().upper()


def checkout_hash(merchant_id: str, order_id: str, amount: Decimal, currency: str, secret: str) -> str:
    # amount always with two decimals, for example 1500.00
    return _md5_upper(f"{merchant_id}{order_id}{amount:.2f}{currency}{_md5_upper(secret)}")


def notify_is_genuine(form: dict[str, str], secret: str) -> bool:
    expected = _md5_upper(
        form.get("merchant_id", "")
        + form.get("order_id", "")
        + form.get("payhere_amount", "")
        + form.get("payhere_currency", "")
        + form.get("status_code", "")
        + _md5_upper(secret)
    )
    return hmac.compare_digest(expected, form.get("md5sig", ""))
```

After `notify_is_genuine`, the endpoint also checks that `merchant_id` is ours, the order exists, and `payhere_amount` and `payhere_currency` equal the order's own amount and currency. If any check fails, nothing changes and a warning is logged with the order ID only.

### 6.6 Fields sent to PayHere

PayHere requires `first_name`, `last_name`, `email`, `phone`, `address`, `city` and `country` on every checkout. Take them from the account where possible and ask for the rest on a short form before checkout.

- **Never send birth details, names of the people in a chart, or anything about the reading.** `items` is the product name only, for example "Porondam report".
- `custom_1` may carry the product code. Nothing personal.

## 7. Site, hosting and running it

### 7.1 Site (Next.js)

| Piece | What it does |
|---|---|
| Buy button on the lock teasers and the plans page | Calls `/api/v1/payments/checkout`, then builds a hidden form with the fields and submits it to PayHere |
| `/{lang}/payment/return?order=…` | Asks the order status every 2 seconds for up to a minute. Shows "Payment received" with a link back to the result, or "Payment failed", or "Still waiting, we will email you" |
| `/{lang}/payment/cancel?order=…` | "Payment cancelled", with a way to try again |

PayHere's pop up checkout (`payhere.js`) can replace the redirect later. It uses the same fields and hash.

### 7.2 Staging locks and the notify call

The two staging locks (docs/09) would stop PayHere's notify call:

- **The site's staging password** (`frontend/proxy.ts`). PayHere cannot send it. The notify path `/api/v1/payments/payhere/notify` must skip the password check. This is safe because the backend checks the signature.
- **The backend access key.** No change needed: the site adds the key to everything it forwards, so `notify_url` must be the **site's** address (`https://<site>/api/v1/payments/payhere/notify`), not Render's.

Tests check both: the notify path passes without the staging password, and every other path still needs it.

### 7.3 When a notify does not arrive

- The free Render plan sleeps after 15 minutes and takes about a minute to wake. A notify might time out. Production needs the paid plan anyway (docs/09).
- PayHere's pages do not say whether it retries a notify. So a small job looks up any order still pending after 30 minutes through PayHere's Retrieval API (`GET /merchant/v1/payment/search?order_id=…`, with a token from `/merchant/v1/oauth/token`) and settles it the same way a notify would. This needs the API key from section 4, step 7. The limit is 20 calls every 10 seconds.

### 7.4 Refunds and charge backs

- Refunds are done in the PayHere dashboard at first. The Refund API can come later.
- A refund or charge back takes the entitlement away (status `-3`, or a refund marked by hand).
- Write a short refund policy for the terms page. PayHere asks for one before going live.

## 8. Testing

| Where | How |
|---|---|
| Unit tests (`backend/tests/test_payhere.py`) | The hash against a worked example. A notify with a wrong signature, wrong merchant, wrong amount or wrong currency changes nothing. A repeated success grants once. Status `-1` and `-2` unlock nothing. `-3` takes the entitlement away. Card fields never reach the logs |
| API tests | The full flow with a fake notify signed with a test secret: checkout, notify, then the paid endpoint answers with paid fields. Without the notify it does not |
| Local runs | PayHere cannot reach `localhost`. Use the fake notify above, or a tunnel to a public address registered in the sandbox |
| Staging | Real sandbox payments with PayHere's test cards (listed on its support site under sandbox testing). Try success, decline and cancel |

This meets the check for step 18: test payments unlock exactly what was bought, and a failed payment unlocks nothing.

## 9. Going live

| # | Task | Who |
|---|---|---|
| 1 | Live PayHere account approved, production domain added, live secret copied | Owner |
| 2 | Terms, privacy and refund pages final, with a contact address | Owner |
| 3 | Production on paid Render plans, so notifies are not lost while it sleeps | Owner |
| 4 | Set the live merchant ID and secret, `ASTRONOMIA_PAYHERE_SANDBOX=false` | Owner |
| 5 | One real small payment and a refund, from start to end | Owner |
| 6 | Watch the first week of orders: pending orders, failures by country | Owner, then build |

## 10. Later

- **Auto renewing membership** with PayHere's recurring API: extra fields `recurrence` (for example `1 Month`) and `duration` (for example `Forever`). Notifies then carry `message_type` (`RECURRING_INSTALLMENT_SUCCESS`, `RECURRING_STOPPED` and others) and `subscription_id`. The pass simply gets extended on each paid installment. Check first which plan includes it.
- **A second gateway** for overseas buyers, if the data in section 1 asks for it.
- **Refunds from the account page** through the Refund API.

## 11. Open questions

| # | Question | Who |
|---|---|---|
| 1 | Prices for the single report and the passes, in LKR and USD | Owner |
| 2 | Does Lite include recurring payments, and what are the Lite limits today? | Owner, ask PayHere |
| 3 | Guest checkout for a single report, or sign in always? | Owner. Sign in is assumed above (step 17 comes before step 18) |

## Sources

- [PayHere fees](https://www.payhere.lk/fees)
- [PayHere limits and fees](https://support.payhere.lk/limits-and-fees)
- [PayHere USD payouts](https://support.payhere.lk/usd-payouts)
- [PayHere Checkout API](https://support.payhere.lk/api-&-mobile-sdk/checkout-api)
- [PayHere Recurring API](https://support.payhere.lk/api-&-mobile-sdk/recurring-api)
- [PayHere Retrieval API](https://support.payhere.lk/api-&-mobile-sdk/retrieval-api)
- [Sri Lankan payment providers (paymentproviders.io)](https://paymentproviders.io/country/lk)
- [Cheapest merchant of record in 2026 (aliteq)](https://aliteq.com/cheapest-merchant-of-record)
- [PayPal set for Sri Lanka launch on 15 May (Daily FT)](https://www.ft.lk/front-page/PayPal-set-for-Sri-Lanka-launch-on-15-May/44-791642)
- [What is the real status of PayPal in Sri Lanka (Fact Crescendo)](https://english.factcrescendo.com/2026/02/26/explainer-whats-the-real-status-of-paypal-in-sri-lanka)
