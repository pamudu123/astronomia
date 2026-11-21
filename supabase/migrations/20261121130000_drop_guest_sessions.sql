-- Sign in is Supabase Auth's now (docs/19, step 2): the browser sends a Supabase access token and
-- Supabase keeps the sessions. The backend's guest cookie sessions, kept in the temporary table
-- that 20261121120030_temporary_guest_sessions.sql made, are no longer used.

drop table sidera.sessions;

-- Guest accounts made with the old cookie have ids that are not Supabase users, so nobody can
-- reach them any more. They go, with their reports (on delete cascade). Guarded so the
-- migrations also run on a plain PostgreSQL (the backend's CI), which has no auth schema.
do $$
begin
  if to_regclass('auth.users') is not null then
    delete from sidera.users u where not exists (select 1 from auth.users a where a.id = u.id);
  end if;
end
$$;

comment on table sidera.users is
  'One row per Supabase Auth user, under the same id. kind: guest (anonymous) or google.';
