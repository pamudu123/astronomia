# Supabase

The database and sign in (docs/19). Staging is project `ihzvwnwkbcqldhrvsrle`, Singapore.

## Migrations

`migrations/` holds every change to the database, applied in name order. The backend never
makes tables on PostgreSQL: it checks at start up that its tables are there and stops with a
message naming the missing ones. Local runs and tests without `ASTRONOMIA_DATABASE_URL` use
SQLite, which makes its own tables.

- The app's tables are in the private schema `sidera`, which the Data API does not publish.
  Only the database owner (the backend) may use it. Row level security is on, with no policies.
- To change a table, add a new file named `<yyyymmddhhmmss>_<what>.sql`. Never edit a file that
  has been applied. Apply it to staging (Supabase MCP `apply_migration`, or `supabase db push`),
  run the security and performance advisors, and later apply it to production in the same order.
- The backend's PostgreSQL tests build their database from these files (`backend/tests/pg.py`),
  so CI checks every migration too.
- `20261121120030_temporary_guest_sessions.sql` kept the guest cookie working until sign in
  moved to Supabase Auth. `20261121130000_drop_guest_sessions.sql` (docs/19, step 2) drops it.
