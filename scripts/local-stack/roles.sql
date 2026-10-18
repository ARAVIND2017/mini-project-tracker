-- LOCAL STACK ONLY. Creates the roles and schemas a Supabase project has before
-- any migration runs, so GoTrue, PostgREST and our migrations behave as on Supabase.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'postgres';
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login createrole noinherit password 'postgres';

create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;
grant create on database postgres to supabase_auth_admin;

create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
-- Supabase grants EXECUTE on new functions in every schema to the API roles.
alter default privileges grant all on functions to anon, authenticated, service_role;
