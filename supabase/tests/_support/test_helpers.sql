-- LOCAL TEST HARNESS ONLY. Assertion and identity helpers used by supabase/tests/*.sql.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_condition is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
end;
$$;

create or replace function tests.assert_eq(p_actual anyelement, p_expected anyelement, p_message text)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ASSERTION FAILED: % (expected %, got %)', p_message, p_expected, p_actual;
  end if;
end;
$$;

-- Runs p_sql and requires it to fail with a message matching p_pattern (LIKE syntax).
create or replace function tests.assert_raises(p_sql text, p_pattern text, p_message text)
returns void language plpgsql as $$
declare
  v_error text;
begin
  begin
    execute p_sql;
  exception when others then
    v_error := sqlerrm;
  end;
  if v_error is null then
    raise exception 'ASSERTION FAILED: % (statement succeeded, expected error like "%")', p_message, p_pattern;
  end if;
  if v_error not like p_pattern then
    raise exception 'ASSERTION FAILED: % (expected error like "%", got "%")', p_message, p_pattern, v_error;
  end if;
end;
$$;

create or replace function tests.create_user(p_email text)
returns uuid language sql as $$
  insert into auth.users (email) values (p_email) returning id;
$$;

-- Switch to the PostgREST `authenticated` role with the given user's JWT claims
-- (transaction-local). Call tests.reset() to return to the superuser.
create or replace function tests.login_as(p_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create or replace function tests.login_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
end;
$$;

create or replace function tests.reset()
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

create or replace function tests.pass(p_name text)
returns void language plpgsql as $$
begin
  raise notice 'ok - %', p_name;
end;
$$;
grant execute on function tests.pass(text) to anon, authenticated, service_role;
