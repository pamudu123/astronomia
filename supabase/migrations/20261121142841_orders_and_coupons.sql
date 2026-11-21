-- Paid reports, coupons and orders (docs/18, sections 4 and 8, steps 3 and 4).
--
-- Only single reports are sold. Every unlock is an order, whether a coupon made it free or,
-- later, a payment provider took the money, so the rest of the site never has to tell the two
-- apart. An order never holds birth details: the report is named by its kind and a hash of the
-- request it was made from (the same hash saved_reports uses).
--
-- These tables match backend/app/store/orders.py. Prices are in the smallest unit of the
-- currency (cents), as payment providers count them.

-- Coupon codes. Never in the website or the repository: the owner adds them with
-- backend/scripts/coupons.py. A code is kept lower case with its spaces taken out, as it is
-- compared.
create table sidera.coupons (
  id uuid primary key,
  code text not null unique check (code <> '' and code = lower(code) and code !~ '\s'),
  percent_off integer not null check (percent_off between 1 and 100),
  -- Which reports it applies to: 'hadahan', 'porondam' or 'hadahan,porondam'.
  kinds text not null check (kinds ~ '^(hadahan|porondam)(,(hadahan|porondam))?$'),
  max_uses integer check (max_uses >= 0),               -- null: no total limit
  max_uses_per_account integer not null default 1 check (max_uses_per_account >= 1),
  ends_at timestamptz,                                  -- null: never ends
  active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null
);

-- One row per unlocked report. When an account is deleted its orders stay, as the law asks of
-- sales records, with the account left empty.
create table sidera.orders (
  id uuid primary key,
  user_id uuid references sidera.users (id) on delete set null,
  report_kind text not null check (report_kind in ('hadahan', 'porondam')),
  report_hash text not null,
  price integer not null check (price >= 0),            -- the list price, before any coupon
  currency text not null check (currency in ('LKR', 'USD')),
  coupon_id uuid references sidera.coupons (id),
  percent_off integer not null default 0 check (percent_off between 0 and 100),
  amount_paid integer not null check (amount_paid >= 0 and amount_paid <= price),
  method text not null check (method in ('coupon', 'payment')),
  -- 'void' undoes an unlock (misuse) and gives the coupon use back. Refunds come with payments.
  status text not null default 'paid' check (status in ('paid', 'void')),
  created_at timestamptz not null
);
-- One paid order per report and account: the same report is never sold twice.
create unique index orders_one_per_report
  on sidera.orders (user_id, report_kind, report_hash) where status = 'paid';
create index orders_coupon on sidera.orders (coupon_id) where coupon_id is not null;

-- Wrong coupon guesses, for the limit of about 10 an hour per account. Only the time is kept.
create table sidera.coupon_misses (
  user_id uuid not null references sidera.users (id) on delete cascade,
  at timestamptz not null
);
create index coupon_misses_user on sidera.coupon_misses (user_id, at);

alter table sidera.coupons enable row level security;
alter table sidera.orders enable row level security;
alter table sidera.coupon_misses enable row level security;

revoke all on sidera.coupons, sidera.orders, sidera.coupon_misses
  from public, anon, authenticated, service_role;
