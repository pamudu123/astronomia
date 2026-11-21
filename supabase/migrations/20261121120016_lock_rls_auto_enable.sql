-- Supabase puts public.rls_auto_enable() in new projects: an event trigger function that turns on
-- row level security for new tables in public. Anyone could call it through the Data API, and it
-- runs as its owner (security definer). The event trigger keeps working without these grants.
--
-- Guarded so the migrations also run on a plain PostgreSQL (the backend's CI) where it is absent.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
  end if;
end
$$;
