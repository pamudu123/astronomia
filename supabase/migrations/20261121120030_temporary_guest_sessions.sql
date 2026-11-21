-- TEMPORARY. The backend's guest cookie sessions, kept only until step 2 of docs/19 moves sign in
-- to Supabase Auth, which keeps its own sessions. Step 2 drops this table in a new migration.
-- Without it, saving on staging would stop working between steps 1 and 2.
--
-- Only hashes of the session codes are kept.

create table sidera.sessions (
  token_hash text primary key,
  user_id uuid not null references sidera.users (id) on delete cascade,
  created_at timestamptz not null,
  expires_at timestamptz not null
);
create index sessions_user on sidera.sessions (user_id);

alter table sidera.sessions enable row level security;

revoke all on sidera.sessions from public, anon, authenticated, service_role;
