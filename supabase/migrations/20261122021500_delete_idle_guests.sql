-- A daily clean up of guests nobody uses (docs/19, step 5).
--
-- The first Save signs a visitor in anonymously with Supabase Auth. A guest who keeps nothing
-- and does not come back would stay in auth.users for ever. This deletes, once a day, every
-- anonymous user who has nothing saved here and has not been used for 7 days, together with
-- their sidera.users row. It runs inside the database with pg_cron, which every Supabase plan
-- has: no server needs to be awake and no key leaves the database. Supabase's own guide to
-- anonymous sign ins suggests this kind of SQL delete.
--
-- Free saved reports expire after 7 days (docs/18), deleted by a separate job. Once a guest's
-- last report has gone, the guest has nothing saved and is deleted here when also idle, so the
-- two never touch the same rows: this job never deletes a report, and never a user who has one.

create function sidera.delete_idle_guests(idle interval default interval '7 days')
returns integer
language plpgsql
set search_path = ''
as $$
declare
  cutoff constant timestamptz := now() - idle;
  ids uuid[];
begin
  -- Anonymous Supabase users with no sign of use since the cut off: not made, signed in or
  -- changed (auth.users), no sign in renewed (auth.sessions; the browser renews its token
  -- hourly while the site is open), and not seen by the backend (sidera.users.last_seen_at,
  -- written at most once a day). A user who linked Google is not anonymous any more.
  select coalesce(array_agg(a.id), '{}') into ids
  from auth.users a
  where a.is_anonymous
    and greatest(a.created_at, a.last_sign_in_at, a.updated_at) < cutoff
    and not exists (
      select 1 from auth.sessions s
      where s.user_id = a.id
        and greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC') >= cutoff
    )
    and not exists (
      select 1 from sidera.users u
      where u.id = a.id and (u.kind <> 'guest' or u.last_seen_at >= cutoff)
    )
    and not exists (select 1 from sidera.saved_reports r where r.user_id = a.id)
    and not exists (select 1 from sidera.orders o where o.user_id = a.id);

  -- Guest rows left without their Supabase user (deleted some other way), on the same terms.
  ids := ids || array(
    select u.id
    from sidera.users u
    where u.kind = 'guest'
      and u.last_seen_at < cutoff
      and not exists (select 1 from auth.users a where a.id = u.id)
      and not exists (select 1 from sidera.saved_reports r where r.user_id = u.id)
      and not exists (select 1 from sidera.orders o where o.user_id = u.id)
  );

  -- coupon_misses goes with the row (on delete cascade). Supabase removes the user's
  -- identities, sessions and refresh tokens with the auth.users row.
  delete from sidera.users where id = any (ids);
  delete from auth.users where id = any (ids);
  return cardinality(ids);
end
$$;

comment on function sidera.delete_idle_guests(interval) is
  'Deletes anonymous users with nothing saved and unused for 7 days, here and in auth.users. '
  'Run daily by pg_cron (job sidera-delete-idle-guests). Returns how many went.';

-- Only the owner runs it (pg_cron runs jobs as the role that scheduled them).
revoke execute on function sidera.delete_idle_guests(interval)
  from public, anon, authenticated, service_role;

-- Every day at 20:30 UTC, 02:00 in Sri Lanka, when the site is quietest. Guarded so the
-- migrations also run on a plain PostgreSQL (the backend's CI), which has no pg_cron. pg_cron
-- itself is switched on in the Supabase dashboard (see supabase/README.md): creating it here
-- fails on Supabase, whose own set-up for the extension runs again and refuses.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'sidera-delete-idle-guests', '30 20 * * *', 'select sidera.delete_idle_guests()'
    );
  end if;
end
$$;
