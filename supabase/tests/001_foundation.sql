-- Phase 1 foundation tests: enums, error helper, protected columns, immutability, audit log.
begin;

-- Enum types ------------------------------------------------------------------
select tests.assert_eq(
  (select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'),
  25, 'all 25 workflow enum types exist');
select tests.assert_eq(
  (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e
    where e.enumtypid = 'public.execution_status'::regtype),
  array['not_started', 'repository_identified', 'environment_setup', 'execution_successful',
        'execution_failed', 'blocked_dependency_dataset', 'verification_pending', 'verified'],
  'execution_status has the eight states in order');
select tests.pass('enum types');

-- Error helper ----------------------------------------------------------------
select tests.assert_raises($$select app.raise_error('FORBIDDEN', 'nope')$$,
  'FORBIDDEN: nope', 'raise_error formats CODE: message');
select tests.assert_raises($$select app.raise_error('MADE_UP', 'x')$$,
  '%unknown error code MADE_UP%', 'raise_error rejects unknown codes');
select tests.pass('raise_error');

-- Fixture table using the shared triggers --------------------------------------
create table public.t_fixture (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid,
  title      text,
  status     public.record_status not null default 'draft',
  approved_by uuid
);
alter table public.t_fixture enable row level security;
create policy t_fixture_all on public.t_fixture for all to authenticated using (true) with check (true);
create trigger guard before insert or update on public.t_fixture
  for each row execute function app.guard_protected_columns('status=draft', 'approved_by=');
select app.enable_audit('public.t_fixture');

-- A stand-in for a workflow RPC: SECURITY DEFINER, owned by the migration role.
create function public.t_fixture_approve(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.t_fixture set status = 'approved', approved_by = auth.uid() where id = p_id;
$$;

create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated;
insert into ids values ('user', tests.create_user('fixture.user@example.test'));

-- Protected columns -----------------------------------------------------------
select tests.login_as((select id from ids where name = 'user'));

insert into public.t_fixture (title, project_id) values ('first', gen_random_uuid()) returning id \gset fixture_
insert into ids values ('row', :'fixture_id');

select tests.assert_raises(
  $$insert into public.t_fixture (title, status) values ('sneaky', 'approved')$$,
  'FORBIDDEN: t_fixture.status is set by workflow actions only', 'API role cannot insert a non-initial status');
select tests.assert_raises(
  format($$update public.t_fixture set status = 'approved' where id = %L$$, :'fixture_id'),
  'FORBIDDEN: t_fixture.status can only be changed through workflow actions', 'API role cannot update status directly');

update public.t_fixture set title = 'edited' where id = :'fixture_id';
select tests.assert_eq((select title from public.t_fixture where id = :'fixture_id'), 'edited',
  'content columns stay editable');

select public.t_fixture_approve(:'fixture_id');
select tests.assert_eq((select status::text from public.t_fixture where id = :'fixture_id'), 'approved',
  'workflow function (security definer) may change protected columns');
select tests.pass('guard_protected_columns');

-- Audit log -------------------------------------------------------------------
select tests.assert_eq((select count(*)::int from public.audit_log), 0,
  'ordinary users see no audit entries (RLS; HOD/admin policy added in Phase 2)');
select tests.reset();

select tests.assert_eq(
  (select count(*)::int from public.audit_log where row_id = :'fixture_id'), 3,
  'insert, content update and workflow update are each audited');
select tests.assert_eq(
  (select count(*)::int from public.audit_log
    where row_id = :'fixture_id' and actor_id = (select id from ids where name = 'user')), 3,
  'audit rows record the acting user');
select tests.assert(
  (select project_id is not null from public.audit_log where row_id = :'fixture_id' limit 1),
  'audit rows carry project_id');
select tests.assert_eq(
  (select old_data ->> 'status' || '>' || (new_data ->> 'status') from public.audit_log
    where row_id = :'fixture_id' and action = 'UPDATE' order by id desc limit 1),
  'draft>approved', 'audit stores before/after values');

update public.t_fixture set title = title where id = :'fixture_id';
select tests.assert_eq(
  (select count(*)::int from public.audit_log where row_id = :'fixture_id'), 3,
  'no-op updates are not audited');

set local role service_role;
select tests.assert_raises($$delete from public.audit_log$$, 'permission denied%',
  'service_role cannot delete audit entries');
reset role;
set local role authenticated;
select tests.assert_raises($$update public.audit_log set action = 'x'$$, 'permission denied%',
  'authenticated cannot update audit entries');
reset role;
select tests.pass('audit log');

-- Immutability helper ---------------------------------------------------------
create trigger immutable before update or delete on public.t_fixture
  for each row execute function app.prevent_mutation();
select tests.login_as((select id from ids where name = 'user'));
select tests.assert_raises(
  format($$delete from public.t_fixture where id = %L$$, :'fixture_id'),
  'FORBIDDEN: t_fixture records cannot be changed or deleted', 'prevent_mutation blocks deletes by API roles');
select tests.reset();
select tests.pass('prevent_mutation');

-- Helper schema is private ----------------------------------------------------
select tests.login_as((select id from ids where name = 'user'));
select tests.assert_raises($$select app.log_action('x', 'y', null)$$, 'permission denied%',
  'API roles cannot call internal app helpers');
select tests.reset();
select tests.pass('app schema privileges');

rollback;
