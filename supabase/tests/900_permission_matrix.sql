-- Generated authorization matrix (TEST_PLAN.md §2). The expected results are data in
-- permission_matrix.json (also rendered to docs/PERMISSION_MATRIX.md); this file builds
-- one fixture, then runs every action as every caller. Each attempt is rolled back, so
-- the cells are independent. Fictional users only.
begin;

-- -----------------------------------------------------------------------------
-- Fixture
-- -----------------------------------------------------------------------------
create temporary table m (name text primary key, id uuid);
grant all on m to anon, authenticated;

insert into auth.users (email, raw_user_meta_data)
select 'mx.' || n || '@example.test', jsonb_build_object('full_name', 'Matrix ' || n)
from unnest(array['hod', 'admin_all', 'admin_none', 'lead', 'guide', 'co_reviewer', 'authorized',
                  'expired_auth', 'faculty', 'spare_faculty', 'deactivated', 'student_own', 'student_other', 'newuser']) n;
insert into m select split_part(split_part(email, '@', 1), '.', 2), id from auth.users where email like 'mx.%@example.test';
select app.bootstrap_hod('mx.hod@example.test');

select tests.login_as((select id from m where name = 'hod'));
select public.app_grant_system_role((select id from m where name = 'admin_all'), 'admin',
  array['manage_users', 'manage_config', 'manage_roster']);
select public.app_grant_system_role((select id from m where name = 'admin_none'), 'admin', '{}');
select public.app_create_semester('Matrix Semester', '2026-27', jsonb_build_object('start_date', current_date - 21)) as sem \gset
select public.app_create_semester('Matrix Draft', '2026-27', jsonb_build_object('start_date', current_date + 30)) as sem_draft \gset
insert into m values ('sem', :'sem'), ('sem_draft', :'sem_draft');
select public.app_set_lead(:'sem', (select id from m where name = 'lead'));
select public.app_set_lead(:'sem_draft', (select id from m where name = 'lead'));
select public.app_set_membership(:'sem', id, 'faculty') from m
where name in ('guide', 'co_reviewer', 'authorized', 'expired_auth', 'faculty', 'spare_faculty', 'deactivated');
select public.app_upsert_domain(:'sem', 'Machine Learning') as d_ml \gset
select public.app_upsert_domain(:'sem', 'Web Systems') as d_web \gset
select public.app_upsert_domain(:'sem_draft', 'Machine Learning');
insert into m values ('d_ml', :'d_ml'), ('d_web', :'d_web');
select public.app_activate_semester(:'sem');
select public.app_import_roster(:'sem', $$[
  {"slot_no": 1, "full_name": "Matrix Student Own", "email": "mx.student_own@example.test", "domain_name": "Machine Learning"},
  {"slot_no": 2, "full_name": "Matrix Student Other", "email": "mx.student_other@example.test", "domain_name": "Machine Learning"},
  {"slot_no": 3, "full_name": "Matrix Student Unlinked", "email": "mx.newuser@example.test", "domain_name": "Machine Learning"}
]$$::jsonb, false);
insert into m select 'sa_student', id from public.students where semester_id = :'sem' and slot_no = 1;
insert into m select 'sb_student', id from public.students where semester_id = :'sem' and slot_no = 2;
insert into m select 'sc_student', id from public.students where semester_id = :'sem' and slot_no = 3;
select public.app_link_student((select id from m where name = 'sa_student'), (select id from m where name = 'student_own'));
select public.app_link_student((select id from m where name = 'sb_student'), (select id from m where name = 'student_other'));
insert into m select 'pa', id from public.projects where student_id = (select id from m where name = 'sa_student');
insert into m select 'pb', id from public.projects where student_id = (select id from m where name = 'sb_student');
select public.app_set_expertise(:'sem', array[:'d_ml']::uuid[], id) from m
where name in ('guide', 'co_reviewer', 'authorized', 'expired_auth', 'faculty', 'spare_faculty', 'deactivated', 'lead');
select public.app_assign_guide((select id from m where name = 'pa'), (select id from m where name = 'guide'));
select public.app_assign_guide((select id from m where name = 'pb'), (select id from m where name = 'guide'));
select tests.reset();

-- Co-reviewers of A (proposed by the lead, approved by the HOD).
select tests.login_as((select id from m where name = 'lead'));
select public.app_request_assignment((select id from m where name = 'pa'), 'co_reviewer', id, 'Second opinion on the model')
from m where name in ('co_reviewer', 'deactivated');
select public.app_grant_review_authorization((select id from m where name = 'pa'), (select id from m where name = 'authorized'),
  now() + interval '7 days', 'Cross-review') as authz \gset
select public.app_grant_review_authorization((select id from m where name = 'pa'), (select id from m where name = 'expired_auth'),
  now() + interval '1 day', 'Cross-review') as authz_exp \gset
insert into m values ('authorization', :'authz');
select tests.reset();
update public.review_authorizations set valid_until = now() - interval '1 minute' where id = :'authz_exp';
select tests.login_as((select id from m where name = 'hod'));
select public.app_decide_assignment_request(r.id, true) from public.assignment_requests r
where r.project_id = (select id from m where name = 'pa') and r.status = 'pending';
select tests.reset();

-- A pending guide request for B from the unassigned faculty member.
select tests.login_as((select id from m where name = 'faculty'));
insert into m select 'request', public.app_request_assignment((select id from m where name = 'pb'), 'guide',
  (select id from m where name = 'faculty'), 'Machine learning is my area');
select tests.reset();

-- Project A content: S1 approved, a candidate paper, evidence, tasks with corrections.
select tests.login_as((select id from m where name = 'student_own'));
insert into m select 'exploration', public.app_save_exploration((select id from m where name = 'pa'), jsonb_build_object(
  'candidate_topics', array['Topic one', 'Topic two'], 'keywords', array['k1', 'k2', 'k3'],
  'sources', jsonb_build_array(jsonb_build_object('name', 'Digital library', 'url', 'https://library.example.test')),
  'proposed_problem', repeat('A fictional research problem statement. ', 3)));
select public.app_submit_record('exploration', (select id from m where name = 'exploration'));
select tests.reset();
select tests.login_as((select id from m where name = 'guide'));
select public.app_record_review('exploration', (select id from m where name = 'exploration'), 'accepted', 'Fine');
select tests.reset();
select tests.login_as((select id from m where name = 'student_own'));
insert into m select 'paper', public.app_save_paper((select id from m where name = 'pa'), '{"title": "Matrix fixture paper"}');
insert into m select 'evidence', public.app_add_evidence((select id from m where name = 'pa'), 'exploration', 'other',
  'https://drive.example.test/fixture', 'Fixture evidence link');
select tests.reset();
with r as (
  insert into public.code_repositories (project_id, paper_id, repo_url)
  values ((select id from m where name = 'pa'), (select id from m where name = 'paper'), 'https://code.example.test/fixture')
  returning id)
insert into m select 'repository', id from r;

create temporary table fixture_tasks as
select week_no, id from public.tasks where project_id = (select id from m where name = 'pa') and is_active;
grant select on fixture_tasks to authenticated;
create or replace function pg_temp.submit_week(p_week int) returns uuid language plpgsql as $$
declare v_task uuid := (select id from fixture_tasks where week_no = p_week order by id limit 1);
begin
  perform tests.login_as((select id from m where name = 'student_own'));
  perform public.app_start_task(v_task);
  return public.app_submit_task(v_task, repeat('Fixture progress report. ', 6),
    '[{"category": "other", "url": "https://drive.example.test/f", "description": "Fixture evidence"}]');
end $$;
insert into m select 'submission', pg_temp.submit_week(1);
select tests.reset();
select pg_temp.submit_week(2) as sub2 \gset
select tests.reset();
select pg_temp.submit_week(3) as sub3 \gset
select tests.reset();
select tests.login_as((select id from m where name = 'guide'));
select public.app_record_review('task_submission', :'sub2', 'changes_requested', 'Fix', null, array['Fixture correction to address']) as rev2 \gset
select public.app_record_review('task_submission', :'sub3', 'changes_requested', 'Fix', null, array['Fixture correction to verify']) as rev3 \gset
select tests.reset();
insert into m select 'correction_open', id from public.corrections where review_id = :'rev2';
insert into m select 'correction_addressed', id from public.corrections where review_id = :'rev3';
select tests.login_as((select id from m where name = 'student_own'));
select public.app_address_correction((select id from m where name = 'correction_addressed'), 'Fixed in the notes.');
select tests.reset();
insert into m select 'task_open', id from fixture_tasks where week_no = 4 order by id limit 1;
insert into m select 'deliverable', id from public.final_deliverables
where project_id = (select id from m where name = 'pa') and item = 'final_paper';

-- Panel for A, a meeting with attendees, and finally the deactivation.
select tests.login_as((select id from m where name = 'hod'));
select public.app_set_panel(:'sem', 'Panel A', array[(select id from m where name = 'guide'), (select id from m where name = 'co_reviewer')]::uuid[],
  array[(select id from m where name = 'pa')]::uuid[]);
select tests.reset();
select tests.login_as((select id from m where name = 'lead'));
select public.app_record_meeting(:'sem', now() - interval '2 hours', 'Fixture meeting', null,
  array[(select id from m where name = 'guide')]::uuid[],
  jsonb_build_array(jsonb_build_object('project_id', (select id from m where name = 'pa'), 'outcome', 'Fixture outcome')));
select tests.reset();
select tests.login_as((select id from m where name = 'hod'));
select public.app_set_user_active((select id from m where name = 'deactivated'), false, 'Left the department');
select tests.reset();

-- -----------------------------------------------------------------------------
-- Runner
-- -----------------------------------------------------------------------------
\set matrix `cat "$ROOT/supabase/tests/permission_matrix.json"`
create temporary table matrix as select :'matrix'::jsonb as doc;

-- Runs p_sql as the caller (null = anonymous) and always rolls it back. Returns 'ok' or
-- the error message.
create or replace function pg_temp.attempt(p_user uuid, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  begin
    if p_user is null then perform tests.login_anon(); else perform tests.login_as(p_user); end if;
    execute p_sql;
    raise exception 'MATRIX_ROLLBACK';
  exception when others then
    v := sqlerrm;
  end;
  return case when v = 'MATRIX_ROLLBACK' then 'ok' else v end;
end $$;

create or replace function pg_temp.fill(p_sql text) returns text language plpgsql as $$
declare r record; v text := p_sql;
begin
  for r in select name, id from m order by length(name) desc loop
    v := replace(v, '{' || r.name || '}', quote_literal(r.id) || '::uuid');
  end loop;
  if v ~ '\{[a-z_]+\}' then raise exception 'Unknown fixture name in: %', p_sql; end if;
  return v;
end $$;

create temporary table results (action text, caller text, allowed boolean, strict boolean, got text);
do $$
declare
  a jsonb;
  c text;
  v_sql text;
begin
  for a in select x from matrix, jsonb_array_elements(doc -> 'sections') s, jsonb_array_elements(s -> 'actions') x loop
    v_sql := pg_temp.fill(a ->> 'sql');
    for c in select jsonb_object_keys(doc -> 'callers') from matrix loop
      insert into results values (a ->> 'id', c, (a -> 'allow') ? c, coalesce((a ->> 'strict')::boolean, true),
        pg_temp.attempt(case when c = 'anon' then null else (select id from m where name = c) end, v_sql));
    end loop;
  end loop;
end $$;

-- Refused means one of these; anything else (ok, VALIDATION, INVALID_STATE, …) got past
-- the permission check.
create or replace function pg_temp.refused(p text) returns boolean language sql immutable as $$
  select p ~ '^(FORBIDDEN|NOT_FOUND):' or p like 'permission denied%';
$$;

do $$
declare v text;
begin
  select string_agg(format('%s as %s: expected %s, got "%s"', action, caller,
           case when not allowed then 'refused' when strict then 'ok' else 'not refused' end, got), E'\n' order by action, caller)
  into v
  from results
  where (not allowed and not pg_temp.refused(got))
     or (allowed and strict and got <> 'ok')
     or (allowed and not strict and pg_temp.refused(got));
  if v is not null then raise exception E'ASSERTION FAILED: permission matrix cells differ:\n%', v; end if;
  raise notice 'ok - permission matrix: % cells (% actions × % callers)',
    (select count(*) from results), (select count(distinct action) from results), (select count(distinct caller) from results);
end $$;

-- Every workflow function is covered by at least one row of the matrix.
select tests.assert_eq(
  (select string_agg(p.proname, ', ' order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'app\_%'
     and p.proname not in (select x ->> 'rpc' from matrix, jsonb_array_elements(doc -> 'sections') s,
                           jsonb_array_elements(s -> 'actions') x)),
  null, 'every workflow function appears in the permission matrix');

-- -----------------------------------------------------------------------------
-- Tables: no direct writes for anyone (SEC-09/SEC-10); reads of project A follow
-- can_view_project; the listed views follow their own rules.
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
  c text;
  got text;
  bad text := '';
begin
  for t in select c.relname,
                  (select a.attname from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                     and a.attidentity = '' and a.attgenerated = '' order by a.attnum limit 1) as col
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' order by 1 loop
    foreach c in array array['anon', 'student_own', 'guide', 'hod', 'admin_all'] loop
      foreach got in array array[
        pg_temp.attempt((select id from m where name = c), format('insert into public.%I default values', t.relname)),
        pg_temp.attempt((select id from m where name = c), format('update public.%I set %I = %I', t.relname, t.col, t.col)),
        pg_temp.attempt((select id from m where name = c), format('delete from public.%I', t.relname))] loop
        if got not like 'permission denied%' then
          bad := bad || format(E'\n%s as %s: %s', t.relname, c, got);
        end if;
      end loop;
    end loop;
  end loop;
  -- Every column of every table, as a student and as the HOD (column-level grants).
  for t in select c.relname, a.attname as col
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
           join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
             and a.attidentity = '' and a.attgenerated = ''
           where n.nspname = 'public' and c.relkind = 'r' order by 1, 2 loop
    foreach c in array array['student_own', 'hod'] loop
      got := pg_temp.attempt((select id from m where name = c), format('update public.%I set %I = %I', t.relname, t.col, t.col));
      if got not like 'permission denied%' then
        bad := bad || format(E'\n%s.%s as %s: %s', t.relname, t.col, c, got);
      end if;
    end loop;
  end loop;
  if bad <> '' then raise exception 'ASSERTION FAILED: direct writes not refused:%', bad; end if;
  raise notice 'ok - SEC-09 no direct insert, update or delete on any table or column for any caller';
end $$;

create or replace function pg_temp.visible(p_user uuid, p_sql text) returns int language plpgsql as $$
declare n int;
begin
  begin
    if p_user is null then perform tests.login_anon(); else perform tests.login_as(p_user); end if;
    execute p_sql into n;
    perform tests.reset();
  exception when others then
    perform tests.reset();
    n := -1;  -- refused outright (anon has no grant)
  end;
  return n;
end $$;

do $$
declare
  t record;
  c text;
  n int;
  expect boolean;
  bad text := '';
  v jsonb;
  checked int := 0;
begin
  -- Every table with a project_id column: rows about project A.
  for t in select c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
           join pg_attribute a on a.attrelid = c.oid and a.attname = 'project_id' and not a.attisdropped
           where ns.nspname = 'public' and c.relkind in ('r', 'v') order by 1 loop
    -- Only tables that actually hold rows for A in the fixture say anything.
    execute format('select count(*) from public.%I where project_id = %L', t.relname, (select id from m where name = 'pa')) into n;
    continue when n = 0;
    -- These are per-user or role-restricted, checked separately.
    continue when t.relname in ('notifications', 'audit_log', 'v_faculty_workload');
    checked := checked + 1;
    for c in select jsonb_object_keys(doc -> 'callers') from matrix loop
      expect := (select (doc -> 'reads' -> 'project_visible') ? c
                        and not (c = 'student_own' and (doc -> 'reads' -> 'staff_only_tables') ? t.relname) from matrix);
      n := pg_temp.visible(case when c = 'anon' then null else (select id from m where name = c) end,
             format('select count(*) from public.%I where project_id = %L', t.relname, (select id from m where name = 'pa')));
      if (n > 0) <> expect then
        bad := bad || format(E'\n%s as %s: %s row(s), expected %s', t.relname, c, n, case when expect then 'some' else 'none' end);
      end if;
    end loop;
  end loop;
  for v in select x from matrix, jsonb_array_elements(doc -> 'reads' -> 'views') x loop
    for c in select jsonb_object_keys(doc -> 'callers') from matrix loop
      expect := (v -> 'visible') ? c;
      n := pg_temp.visible(case when c = 'anon' then null else (select id from m where name = c) end,
             format('select count(*) from public.%I where %s', v ->> 'view', pg_temp.fill(v ->> 'where')));
      if (n > 0) <> expect then
        bad := bad || format(E'\n%s (%s) as %s: %s row(s), expected %s', v ->> 'view', v ->> 'where', c, n,
                             case when expect then 'some' else 'none' end);
      end if;
    end loop;
  end loop;
  if bad <> '' then raise exception 'ASSERTION FAILED: read visibility differs:%', bad; end if;
  raise notice 'ok - SEC-08 read visibility of project A: % tables and views × 13 callers, plus the restricted views', checked;
end $$;

rollback;
