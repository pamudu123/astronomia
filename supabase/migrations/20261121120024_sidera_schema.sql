-- The app's own tables (docs/19). Only the backend reads and writes them, connected as the
-- database owner. They live in a private schema that the Data API does not publish, nobody but
-- the owner may use the schema, and row level security is on with no policies as a second lock.
--
-- These tables match backend/app/store/accounts.py and shares.py. The backend no longer creates
-- tables on PostgreSQL: change them here, in a new migration, and apply it to every project.

create schema sidera;
comment on schema sidera is 'Sidera app data. Private: only the backend (the owner) uses it.';

-- One row per account. The id is the Supabase Auth user id (step 2 of docs/19); until then the
-- backend's guest cookie makes the ids. Names and emails stay in Supabase Auth, not here.
create table sidera.users (
  id uuid primary key,
  kind text not null check (kind in ('guest', 'google')),
  created_at timestamptz not null,
  last_seen_at timestamptz not null
);

-- Reports a user chose to keep. The input hash stops the same report being kept twice.
create table sidera.saved_reports (
  id uuid primary key,
  user_id uuid not null references sidera.users (id) on delete cascade,
  kind text not null,
  title text not null,
  input jsonb not null,
  input_hash text not null,
  snapshot jsonb not null,
  summary jsonb not null,
  rules text not null,
  purchase_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (user_id, input_hash)
);
create index saved_reports_user on sidera.saved_reports (user_id, created_at);

-- Share links. Only hashes of the link code and the delete token are kept.
create table sidera.shares (
  code_hash text primary key,
  delete_hash text not null,
  kind text not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  payload jsonb not null
);

alter table sidera.users enable row level security;
alter table sidera.saved_reports enable row level security;
alter table sidera.shares enable row level security;

revoke all on schema sidera from public, anon, authenticated, service_role;
revoke all on all tables in schema sidera from public, anon, authenticated, service_role;
