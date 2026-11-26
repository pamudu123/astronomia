-- Payments for the part of a report's price a coupon does not cover (docs/23).
--
-- A payment is one try at paying. It unlocks nothing: a report is paid for only when there is an
-- order, and the backend makes one only when the provider's signed notice says the payment was
-- paid. No real provider is connected yet; `mock` is a stand-in that takes no money.
--
-- These tables match backend/app/store/orders.py. A payment never holds birth details or card
-- details, and goes with its account. What was sold stays in sidera.orders.
--
-- Apply this before deploying the backend that reads it: the backend checks its tables are there.

create table sidera.payments (
  id uuid primary key,
  user_id uuid not null references sidera.users (id) on delete cascade,
  report_kind text not null check (report_kind in ('hadahan', 'porondam')),
  report_hash text not null,
  price integer not null check (price >= 0),            -- the list price, before any coupon
  currency text not null check (currency in ('LKR', 'USD')),
  coupon_id uuid references sidera.coupons (id),
  percent_off integer not null default 0 check (percent_off between 0 and 100),
  -- What is to be paid. Nothing to pay is never a payment: a free coupon makes an order itself.
  amount integer not null check (amount > 0 and amount <= price),
  provider text not null check (provider <> ''),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index payments_user on sidera.payments (user_id, report_kind, report_hash);
create index payments_coupon on sidera.payments (coupon_id) where coupon_id is not null;

-- Who took the money for an order, and their number for it. Empty for a coupon.
alter table sidera.orders add column provider text;
alter table sidera.orders add column provider_ref text;
alter table sidera.orders add constraint orders_provider
  check ((method = 'payment') = (provider is not null) and (provider is not null or provider_ref is null));

alter table sidera.payments enable row level security;

revoke all on sidera.payments from public, anon, authenticated, service_role;
