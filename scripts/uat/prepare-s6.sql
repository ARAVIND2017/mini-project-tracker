-- UAT only (docs/UAT_CHECKLIST.md, session 3): fast-forwards ONE fictional project to S6
-- by marking S1–S5 approved, so the final stages can be tested in a short session.
-- It refuses any project whose student is not a fictional "UAT …" roster entry, so it
-- can never touch a real student. Run on staging in the SQL editor or with psql:
--   psql "$STAGING_DB_URL" -v student_name='UAT Student 05' -f scripts/uat/prepare-s6.sql
-- (In the SQL editor, replace :'student_name' below with the quoted name.)
begin;
select set_config('uat.student_name', :'student_name', true);
do $$
declare
  v_name text := current_setting('uat.student_name');
  v_project uuid;
  v_count int;
begin
  if v_name !~ '^UAT ' then
    raise exception 'Refusing: only fictional students whose name starts with "UAT " can be fast-forwarded';
  end if;
  select count(*), min(p.id::text)::uuid into v_count, v_project
  from public.projects p join public.students s on s.id = p.student_id
  join public.semesters se on se.id = p.semester_id
  where s.full_name = v_name and se.status = 'active';
  if v_count <> 1 then
    raise exception 'Expected exactly one active project for %, found %', v_name, v_count;
  end if;
  update public.project_stages set status = 'approved', approved_at = now()
  where project_id = v_project
    and stage_key in ('exploration', 'paper_selection', 'paper_analysis', 'code_execution', 'objectives');
  insert into public.audit_log (actor_id, action, table_name, row_id, project_id, semester_id, new_data)
  select null, 'uat.fast_forward', 'project_stages', v_project, v_project, p.semester_id,
         jsonb_build_object('note', 'UAT preparation: S1–S5 marked approved by the developer', 'student', v_name)
  from public.projects p where p.id = v_project;
  raise notice 'Project % (%): S1–S5 approved; S6 is open', v_project, v_name;
end $$;
commit;
