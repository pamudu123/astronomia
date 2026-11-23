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
- `20261122021500_delete_idle_guests.sql` (docs/19, step 5) adds `sidera.delete_idle_guests()`
  and schedules it daily with pg_cron (job `sidera-delete-idle-guests`, 20:30 UTC). See the
  jobs below.
- `20261122090000_free_reports_expire.sql` (docs/18, step 2) gives each free saved report an
  `expires_at` (7 days after saving; none when paid), adds `sidera.delete_expired_reports()`
  and runs it every hour with pg_cron (job `sidera-expire-free-reports`).

## Scheduled jobs

Jobs run inside the database with pg_cron, so they work while the free backend sleeps and need
no key outside the database.

**On a new project (production), switch pg_cron on first:** Supabase dashboard → Database →
Extensions → pg_cron → on, with the default schema. Then apply the migrations. The migrations
only schedule the jobs when pg_cron is already on; they do not create the extension, because on
Supabase `create extension pg_cron` inside a migration runs Supabase's own set-up again, which
fails with "dependent privileges exist" (seen on staging, 2026-11-23). After the migrations, check
that both jobs below are listed.

| Job | When | Does |
|---|---|---|
| `sidera-delete-idle-guests` | Daily, 20:30 UTC (02:00 Sri Lanka) | Deletes anonymous users with nothing saved and unused for 7 days, from `auth.users` and `sidera.users` |
| `sidera-expire-free-reports` | Hourly, 7 minutes past (`7 * * * *`) | Deletes free saved reports 7 days after saving (docs/18, section 3). A guest left with nothing is then removed by the job above once idle 7 days |

- See them: `select jobname, schedule, active from cron.job;` and the last runs:
  `select * from cron.job_run_details order by start_time desc limit 20;`
- Run one now: `select sidera.delete_idle_guests();` or `select sidera.delete_expired_reports();`
  (each returns how many went).
- A new table that points at `sidera.users` needs `on delete cascade` (or `set null` for
  records that must stay), or the clean up fails for a guest with a row in it.
