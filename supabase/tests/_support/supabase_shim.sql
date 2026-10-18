-- =============================================================================
-- LOCAL TEST HARNESS ONLY — never applied to a Supabase project.
-- Recreates the small part of the Supabase platform that our migrations rely on
-- (API roles, the auth schema with auth.uid(), the extensions schema and
-- Supabase's default privileges), so migrations and RLS can be tested on a plain
-- Postgres server. Mirrors Supabase behaviour as documented for PostgREST/GoTrue.
-- =============================================================================
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), auth.jwt() ->> 'sub'), '')::uuid;
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.jwt() ->> 'role');
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase's default grants on the public schema (the reason RLS must be enabled everywhere).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
-- Supabase also grants EXECUTE on new functions in EVERY schema to the API roles
-- (global default privileges for the postgres role). Mirror it so tests catch
-- helper functions that forget to revoke it.
alter default privileges grant all on functions to anon, authenticated, service_role;
