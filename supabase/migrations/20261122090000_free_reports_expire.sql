-- Free saved reports are deleted 7 days after saving (docs/18, section 3, build step 2).
--
-- Every free report carries the moment it is deleted; a paid report (one kept with an order)
-- has none and is kept for as long as the account exists. Unlocking a saved free report sets
-- its order and clears its expiry in one update (backend/app/store/accounts.py), so it keeps
-- its place in My reports.
--
-- The deletion is real and is done here, in the database, by pg_cron once an hour. The
-- backend on Render's free plan sleeps when nobody visits, so a job inside it would not run
-- on time; Supabase Cron runs on every plan, the free one included. The backend also hides and
-- deletes an account's expired reports whenever it reads them, so nobody sees a report after
-- its time, even in the hour before the job comes round.

alter table sidera.saved_reports add column expires_at timestamptz;

update sidera.saved_reports
  set expires_at = created_at + interval '7 days'
  where purchase_id is null;

-- A free report always expires; a paid one never does.
alter table sidera.saved_reports
  add constraint saved_reports_free_expire check ((purchase_id is null) = (expires_at is not null));

create index saved_reports_expiry on sidera.saved_reports (expires_at) where expires_at is not null;

-- What the hourly job runs. Returns how many reports it deleted.
create function sidera.delete_expired_reports() returns integer
  language plpgsql
  set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from sidera.saved_reports where expires_at <= now();
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;
comment on function sidera.delete_expired_reports() is
  'Deletes free saved reports past their expiry. Run hourly by pg_cron (job sidera-expire-free-reports).';

revoke all on function sidera.delete_expired_reports() from public, anon, authenticated, service_role;

-- Schedule it. Supabase has pg_cron; a plain PostgreSQL (the test database in CI) does not, and
-- there the backend's own deletion is what the tests check. cron.schedule with a job name
-- replaces a job of that name, so running this again changes nothing.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'sidera-expire-free-reports',
      '7 * * * *',  -- every hour, at 7 minutes past
      'select sidera.delete_expired_reports()'
    );
  end if;
end;
$$;
