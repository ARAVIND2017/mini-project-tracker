-- Live journey check: runs a full workflow on a deployed database AS the real users
-- (HOD, lead, guide, student) through the deployed workflow functions, row-level
-- security and triggers — then ALWAYS rolls everything back. Nothing is kept: the last
-- statement raises an exception that carries the results, which aborts the transaction.
-- Safe on staging or production (it refuses to run if a HOD already exists, so that it
-- never acts next to real data). Run it as one statement (e.g. the SQL editor).
do $$
declare
  hod uuid := gen_random_uuid();
  lead uuid := gen_random_uuid();
  guide uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  stud uuid := gen_random_uuid();
  sem uuid; dom uuid; prj uuid; task uuid; sub uuid; rev uuid; corr uuid;
  ok text[] := '{}';
  n int; v text;
begin
  if exists (select 1 from public.system_roles where role = 'hod' and revoked_at is null) then
    raise exception 'LIVE_CHECK_SKIPPED: a HOD already exists; this check only runs on an empty project';
  end if;

  insert into auth.users (id, email, raw_user_meta_data, aud, role) values
    (hod,   'live.check.hod@example.invalid',     '{"full_name": "Live Check HOD"}', 'authenticated', 'authenticated'),
    (lead,  'live.check.lead@example.invalid',    '{"full_name": "Live Check Lead"}', 'authenticated', 'authenticated'),
    (guide, 'live.check.guide@example.invalid',   '{"full_name": "Live Check Guide"}', 'authenticated', 'authenticated'),
    (other, 'live.check.faculty@example.invalid', '{"full_name": "Live Check Faculty"}', 'authenticated', 'authenticated'),
    (stud,  'live.check.student@example.invalid', '{"full_name": "Live Check Student"}', 'authenticated', 'authenticated');
  select count(*) into n from public.profiles where id in (hod, lead, guide, other, stud);
  if n <> 5 then raise exception 'LIVE_CHECK_FAILED: profiles were not created on sign-up (%)', n; end if;
  ok := ok || 'profiles created by the sign-up trigger'::text;
  perform app.bootstrap_hod('live.check.hod@example.invalid');

  -- HOD: semester, lead, faculty, domain, roster, activation, guide.
  perform set_config('request.jwt.claims', json_build_object('sub', hod, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  sem := public.app_create_semester('Live check semester', '2026-27', jsonb_build_object('start_date', current_date - 8));
  perform public.app_set_lead(sem, lead);
  perform public.app_set_membership(sem, guide, 'faculty');
  perform public.app_set_membership(sem, other, 'faculty');
  dom := public.app_upsert_domain(sem, 'Live check domain');
  perform public.app_import_roster(sem, jsonb_build_array(jsonb_build_object('slot_no', 1,
    'full_name', 'Live Check Student', 'email', 'live.check.student@example.invalid', 'domain_name', 'Live check domain'),
    jsonb_build_object('slot_no', 2)), false);
  perform public.app_link_student((select id from public.students where semester_id = sem and slot_no = 1), stud);
  perform public.app_activate_semester(sem);
  select id into prj from public.projects where semester_id = sem;
  perform public.app_assign_guide(prj, guide);
  select count(*) into n from public.tasks where project_id = prj and is_active;
  ok := ok || format('HOD set up the semester; activation generated %s weekly tasks', n);
  execute 'reset role';

  -- Student: sees only their own project; submits week 1 (late, the semester began 8 days ago).
  perform set_config('request.jwt.claims', json_build_object('sub', stud, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.v_projects;
  if n <> 1 then raise exception 'LIVE_CHECK_FAILED: the student sees % projects', n; end if;
  select id into task from public.tasks where project_id = prj and week_no = 1 order by id limit 1;
  perform public.app_start_task(task);
  sub := public.app_submit_task(task, repeat('Live check progress report for week one. ', 4),
    '[{"category": "other", "url": "https://drive.example.invalid/week1", "description": "Search notes for week 1"}]');
  begin
    perform public.app_record_review('task_submission', sub, 'accepted', 'self-approval');
    raise exception 'LIVE_CHECK_FAILED: a student could accept their own work';
  exception when others then
    if sqlerrm like 'LIVE_CHECK_FAILED%' then raise; end if;
  end;
  ok := ok || 'student sees only their own project, submitted week 1 and could not approve it'::text;
  execute 'reset role';
  select is_late::text into v from public.submissions where id = sub;
  ok := ok || format('submission recorded as late = %s', v);

  -- Unassigned faculty: can comment, cannot decide.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.app_record_review('task_submission', sub, 'accepted', 'not my project');
    raise exception 'LIVE_CHECK_FAILED: unassigned faculty could decide';
  exception when others then
    if sqlerrm like 'LIVE_CHECK_FAILED%' then raise; end if;
  end;
  perform public.app_record_review('task_submission', sub, 'comment_only', null, 'A comment from a colleague');
  ok := ok || 'unassigned faculty could comment but not decide (SEC-07)'::text;
  execute 'reset role';

  -- Guide: requests a change with one correction.
  perform set_config('request.jwt.claims', json_build_object('sub', guide, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.notifications where type = 'submission';
  if n < 1 then raise exception 'LIVE_CHECK_FAILED: the guide was not notified of the submission'; end if;
  perform public.app_start_review(sub);
  rev := public.app_record_review('task_submission', sub, 'changes_requested', 'Widen the search', null,
    array['Add two more digital libraries']);
  ok := ok || 'guide was notified, opened the review and requested a change'::text;
  execute 'reset role';
  select id into corr from public.corrections where review_id = rev;

  -- Student: notified; addresses the correction and resubmits.
  perform set_config('request.jwt.claims', json_build_object('sub', stud, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select title into v from public.notifications where type = 'review' and title like '%changes requested%';
  if v is null then raise exception 'LIVE_CHECK_FAILED: the student was not notified of the review'; end if;
  perform public.app_address_correction(corr, 'Two more libraries added to the notes.');
  perform public.app_submit_task(task, repeat('Live check progress report, resubmitted. ', 4),
    '[{"category": "other", "url": "https://drive.example.invalid/week1-v2", "description": "Updated search notes"}]');
  ok := ok || format('student was notified ("%s"), addressed the correction and resubmitted', v);
  execute 'reset role';

  -- Guide: verifies the correction and accepts; the task becomes verified.
  perform set_config('request.jwt.claims', json_build_object('sub', guide, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.app_resolve_correction(corr, 'verify');
  perform public.app_record_review('task_submission',
    (select id from public.submissions where task_id = task order by version desc limit 1), 'accepted', 'Good');
  select status::text into v from public.tasks where id = task;
  if v <> 'verified' then raise exception 'LIVE_CHECK_FAILED: task status is %', v; end if;
  ok := ok || 'guide verified the correction and accepted: task verified'::text;
  execute 'reset role';

  -- Dashboards as the lead: progress and one overdue rule; workload visible.
  perform set_config('request.jwt.claims', json_build_object('sub', lead, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select format('progress %s%%, overdue %s (weekly list says %s)', o.progress, o.overdue_tasks,
                (select count(*) from public.v_tasks t where t.project_id = o.id and t.is_overdue))
    into v from public.v_project_overview o where o.id = prj;
  if (select o.overdue_tasks from public.v_project_overview o where o.id = prj)
     <> (select count(*) from public.v_tasks t where t.project_id = prj and t.is_overdue) then
    raise exception 'LIVE_CHECK_FAILED: overdue counts disagree: %', v;
  end if;
  ok := ok || ('lead dashboard: ' || v);
  select count(*) into n from public.v_faculty_workload where semester_id = sem;
  ok := ok || format('workload table shows %s people to the lead', n);
  perform public.app_record_meeting(sem, now() - interval '1 hour', 'Live check meeting', null, array[guide],
    jsonb_build_array(jsonb_build_object('project_id', prj, 'outcome', 'On track after the correction')));
  ok := ok || 'lead recorded a review meeting'::text;
  execute 'reset role';

  select count(*) into n from public.audit_log where semester_id = sem or project_id = prj;
  ok := ok || format('%s audit entries were written', n);

  raise exception 'LIVE_CHECK_OK (rolled back, nothing kept): %', array_to_string(ok, ' | ');
end $$;
