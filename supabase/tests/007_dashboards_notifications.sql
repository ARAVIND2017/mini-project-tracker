-- Phase 7: notifications (FUN-18), deadline reminders, escalation, review meetings,
-- progress (DATA-09), the faculty workload view and a performance check with 30 projects.
-- Test IDs refer to docs/TEST_PLAN.md. Fictional users only.
begin;

create temporary table u (name text primary key, id uuid);
grant all on u to anon, authenticated;

insert into auth.users (email, raw_user_meta_data) values
  ('p7hod@example.test',   '{"full_name": "P7 HOD"}'),
  ('p7lead@example.test',  '{"full_name": "P7 Lead"}'),
  ('p7guide@example.test', '{"full_name": "P7 Guide"}'),
  ('p7fac@example.test',   '{"full_name": "P7 Faculty"}'),
  ('p7studa@example.test', '{"full_name": "P7 Student A"}'),
  ('p7studb@example.test', '{"full_name": "P7 Student B"}');
insert into u select split_part(email, '@', 1), id from auth.users where email like 'p7%@example.test';
select app.bootstrap_hod('p7hod@example.test');

select tests.login_as((select id from u where name = 'p7hod'));
select public.app_create_semester('P7 Semester', '2026-27', '{"start_date": "2027-01-05"}') as sem \gset
select public.app_set_lead(:'sem', (select id from u where name = 'p7lead'));
select public.app_set_membership(:'sem', (select id from u where name = 'p7guide'), 'faculty');
select public.app_set_membership(:'sem', (select id from u where name = 'p7fac'), 'faculty');
select public.app_upsert_domain(:'sem', 'Machine Learning') as d_ml \gset
select public.app_activate_semester(:'sem');
select public.app_import_roster(:'sem', $$[
  {"slot_no": 1, "full_name": "P7 Student A", "email": "p7studa@example.test", "domain_name": "Machine Learning"},
  {"slot_no": 2, "full_name": "P7 Student B", "email": "p7studb@example.test", "domain_name": "Machine Learning"}
]$$::jsonb, false);
select public.app_link_student((select id from public.students where semester_id = :'sem' and slot_no = 1), (select id from u where name = 'p7studa'));
select public.app_link_student((select id from public.students where semester_id = :'sem' and slot_no = 2), (select id from u where name = 'p7studb'));
select tests.reset();
select p.id as pa from public.projects p join public.students s on s.id = p.student_id where s.semester_id = :'sem' and s.slot_no = 1 \gset
select p.id as pb from public.projects p join public.students s on s.id = p.student_id where s.semester_id = :'sem' and s.slot_no = 2 \gset

-- =============================================================================
-- FUN-18 notifications from the workflow events
-- =============================================================================
-- Assignment decision → the faculty member who asked.
select tests.login_as((select id from u where name = 'p7guide'));
select public.app_set_expertise(:'sem', array[:'d_ml']::uuid[]);
select public.app_request_assignment(:'pa', 'guide', (select id from u where name = 'p7guide'), 'Machine learning is my area') as req \gset
select tests.reset();
select tests.login_as((select id from u where name = 'p7hod'));
select public.app_decide_assignment_request(:'req', true, 'Approved');
select public.app_assign_guide(:'pb', (select id from u where name = 'p7guide'));
select tests.reset();
select tests.assert_eq((select title from public.notifications where user_id = (select id from u where name = 'p7guide') and type = 'assignment'),
  'Guide request for P7 Student A was approved by the HOD', 'assignment decision notifies the faculty member');
select tests.assert_eq((select count(*)::int from public.notifications where user_id = (select id from u where name = 'p7hod')),
  0, 'the person who acts is not notified of their own action');

-- Submission → reviewers; review outcome → student; addressed correction → reviewers.
select id as t1 from public.tasks where project_id = :'pa' and week_no = 1 \gset
select tests.login_as((select id from u where name = 'p7studa'));
select public.app_start_task(:'t1');
select public.app_submit_task(:'t1', repeat('Week one progress report. ', 5),
  '[{"category": "other", "url": "https://drive.example.test/notes", "description": "Search notes for week 1"}]') as sub1 \gset
select tests.reset();
select tests.assert_eq((select title || ' → ' || link from public.notifications where user_id = (select id from u where name = 'p7guide') and type = 'submission'),
  format('P7 Student A submitted week 1: %s (version 1) → /projects/%s?view=tasks&submission=%s',
         (select title from public.tasks where id = :'t1'), :'pa', :'sub1'),
  'FUN-18 a submission notifies the guide, with a link to it');
select tests.assert_eq((select count(*)::int from public.notifications where user_id = (select id from u where name = 'p7fac')),
  0, 'faculty who do not review the project are not notified');

select tests.login_as((select id from u where name = 'p7guide'));
select public.app_record_review('task_submission', :'sub1', 'changes_requested', 'One thing to fix', null,
  array['Add two more sources']) as rev1 \gset
select tests.reset();
select tests.assert_eq((select title from public.notifications where user_id = (select id from u where name = 'p7studa') and type = 'review'),
  'Your weekly task: changes requested (1 correction(s))', 'FUN-18 a review outcome notifies the student');
select id as c1 from public.corrections where review_id = :'rev1' \gset
select tests.login_as((select id from u where name = 'p7studa'));
select public.app_address_correction(:'c1', 'Two more sources added to the notes.');
select tests.reset();
select tests.assert_eq((select title from public.notifications where user_id = (select id from u where name = 'p7guide') and type = 'correction'),
  'P7 Student A addressed a correction: Add two more sources', 'FUN-18 an addressed correction notifies the reviewer');

-- Inbox access: own notifications only; marking as read.
select tests.login_as((select id from u where name = 'p7studa'));
select tests.assert_eq((select count(*)::int from public.notifications), 1, 'SEC-08 a student sees only their own notifications');
select tests.assert_raises($$insert into public.notifications (user_id, type, title) values (auth.uid(), 'x', 'x')$$,
  'permission denied for table notifications', 'notifications cannot be written directly');
select tests.assert_raises($$update public.notifications set read_at = now()$$, 'permission denied for table notifications', 'nor updated directly');
select tests.assert_eq(public.app_mark_notifications_read(), 1, 'marking all as read');
select tests.assert_eq(public.app_mark_notifications_read(), 0, 'already read');
select tests.reset();
select tests.login_as((select id from u where name = 'p7guide'));
select tests.assert_eq(public.app_mark_notifications_read(array[(select id from public.notifications where type = 'submission')]),
  1, 'marking one as read');
select tests.assert_eq((select count(*)::int from public.notifications where read_at is null), 2, 'the others stay unread');
select tests.reset();
select tests.login_anon();
select tests.assert_raises($$select public.app_mark_notifications_read()$$, 'permission denied for function app_mark_notifications_read', 'SEC-01 anonymous visitors cannot call it');
select tests.reset();
select tests.pass('FUN-18 notifications from workflow events');

-- =============================================================================
-- Deadline reminders (48 h), once per task
-- =============================================================================
update public.tasks set due_at = now() + interval '24 hours' where project_id = :'pa' and week_no = 2;
update public.tasks set due_at = now() + interval '72 hours' where project_id = :'pa' and week_no = 3;
select tests.login_as((select id from u where name = 'p7studa'));
select tests.assert_eq(public.app_refresh_my_reminders(), (select count(*)::int from public.tasks where project_id = :'pa' and week_no = 2),
  'FUN-18 a reminder for each task due within 48 hours');
select tests.assert_eq(public.app_refresh_my_reminders(), 0, 'each task is reminded only once');
select tests.assert(exists (select 1 from public.notifications where type = 'deadline' and title like 'Week 2 task due %'),
  'the reminder names the week');
select tests.reset();
select tests.login_as((select id from u where name = 'p7guide'));
select tests.assert_eq(public.app_refresh_my_reminders(), 0, 'faculty have no task reminders');
select tests.reset();
select tests.pass('deadline reminders');

-- =============================================================================
-- Escalation to the HOD
-- =============================================================================
select tests.login_as((select id from u where name = 'p7guide'));
select tests.assert_raises(format($$select public.app_escalate_to_hod(%L, 'Student has not submitted for weeks')$$, :'pa'),
  'FORBIDDEN: Only the lead faculty can escalate to the HOD', 'only the lead escalates');
select tests.reset();
select tests.login_as((select id from u where name = 'p7studa'));
select tests.assert_raises(format($$select public.app_escalate_to_hod(%L, 'Please look at my project')$$, :'pa'),
  'FORBIDDEN: Only the lead faculty can escalate to the HOD', 'students cannot escalate');
select tests.reset();
select tests.login_as((select id from u where name = 'p7lead'));
select tests.assert_raises(format($$select public.app_escalate_to_hod(%L, 'short')$$, :'pa'),
  'VALIDATION: The note needs at least 10 characters', 'the escalation needs a note');
select public.app_escalate_to_hod(:'pa', 'No submission for three weeks; guide has tried twice.');
select tests.reset();
select tests.assert_eq((select body from public.notifications where user_id = (select id from u where name = 'p7hod') and type = 'escalation'),
  'No submission for three weeks; guide has tried twice.', 'the HOD is notified with the note');
select tests.assert_eq((select count(*)::int from public.audit_log where action = 'project.escalated' and project_id = :'pa'), 1,
  'the escalation is audited');
select tests.pass('escalation');

-- =============================================================================
-- Review meetings: attendees, per-project outcomes, students see only their own
-- =============================================================================
select tests.login_as((select id from u where name = 'p7studa'));
select tests.assert_raises(format($$select public.app_record_meeting(%L, now(), 'Review', null, '{}', '[]')$$, :'sem'),
  'FORBIDDEN: Only faculty can record a review meeting', 'students cannot record meetings');
select tests.reset();
select tests.login_as((select id from u where name = 'p7lead'));
select tests.assert_raises(format($$select public.app_record_meeting(%L, now() + interval '3 days', 'Review', null, '{}', '[]')$$, :'sem'),
  'VALIDATION: Give the date and time the meeting was held', 'a meeting is recorded after it happens');
select tests.assert_raises(format($$select public.app_record_meeting(%L, now(), 'Review', null, '{}', %L)$$, :'sem',
  jsonb_build_array(jsonb_build_object('project_id', gen_random_uuid(), 'outcome', 'Fine'))),
  'VALIDATION: Each outcome must be for a project of this semester', 'outcomes are for projects of the semester');
select public.app_record_meeting(:'sem', now() - interval '1 hour', 'Week 3 review', 'Weekly review meeting',
  array[(select id from u where name = 'p7lead'), (select id from u where name = 'p7guide'), (select id from u where name = 'p7studa')],
  jsonb_build_array(
    jsonb_build_object('project_id', :'pa', 'outcome', 'Search is thin; widen the sources', 'action_items', jsonb_build_array('Add 5 sources')),
    jsonb_build_object('project_id', :'pb', 'outcome', 'On track'))) as m1 \gset
select tests.assert_raises(format($$update public.meeting_outcomes set outcome = 'changed' where meeting_id = %L$$, :'m1'),
  'permission denied for table meeting_outcomes', 'meeting outcomes are not edited afterwards');
select tests.reset();
select tests.login_as((select id from u where name = 'p7studa'));
select tests.assert_eq((select string_agg(outcome, ',') from public.meeting_outcomes), 'Search is thin; widen the sources',
  'SEC-08 a student sees only the outcome for their own project');
select tests.assert_eq((select count(*)::int from public.review_meetings), 1, 'and the meeting it belongs to');
select tests.assert_eq((select count(*)::int from public.meeting_attendees), 0, 'but not the attendance list');
select tests.assert_eq((select title from public.notifications where type = 'meeting'), 'Meeting outcome recorded: Week 3 review',
  'the student is notified of the outcome');
select tests.reset();
select tests.login_as((select id from u where name = 'p7studb'));
select tests.assert_eq((select string_agg(outcome, ',') from public.meeting_outcomes), 'On track', 'student B sees only theirs');
select tests.reset();
select tests.login_as((select id from u where name = 'p7fac'));
select tests.assert_eq((select count(*)::int from public.meeting_outcomes where meeting_id = :'m1'), 2, 'faculty see every outcome');
select tests.assert_eq((select count(*)::int from public.meeting_attendees where meeting_id = :'m1'), 3, 'and the attendees');
select tests.reset();
select tests.pass('review meetings');

-- =============================================================================
-- DATA-09 progress
-- =============================================================================
select tests.assert_eq((select count(*)::int from information_schema.columns
                        where table_schema = 'public' and column_name like '%progress%'
                          and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')
                          and column_name <> 'progress_report'),
  0, 'DATA-09 there is no stored progress column anyone could set');
select tests.login_as((select id from u where name = 'p7studa'));
select tests.assert_eq((select progress from public.v_project_overview where id = :'pa'), 0,
  'nothing approved or verified yet: 0 (submitted work does not count)');
select tests.reset();
update public.project_stages set status = 'approved' where project_id = :'pa' and stage_key = 'exploration';
update public.project_stages set status = 'exception_approved' where project_id = :'pa' and stage_key = 'paper_selection';
update public.tasks set status = 'verified'
where id in (select id from public.tasks where project_id = :'pa' and stage_key = 'implementation' and is_active order by week_no limit 2);
select count(*) as impl_n from public.tasks where project_id = :'pa' and stage_key = 'implementation' and is_active \gset
select tests.login_as((select id from u where name = 'p7studa'));
select tests.assert_eq((select progress from public.v_project_overview where id = :'pa'),
  round(5 + 10 + 20 * 2.0 / :impl_n)::int,
  'DATA-09 progress = Σ weight × (1 if approved, else verified ÷ active tasks of the stage)');
select tests.assert_eq((select (progress_breakdown -> 'implementation' ->> 'completion')::numeric from public.v_project_overview where id = :'pa'),
  round(2.0 / :impl_n, 3), 'the breakdown shows each stage');
select tests.assert_eq((select progress from public.v_project_overview where id = :'pb'), null::int,
  'SEC-08 a student cannot read another project''s progress');
select tests.reset();
select tests.login_as((select id from u where name = 'p7hod'));
select public.app_update_semester(:'sem', '{"stage_weights": {"exploration": 20, "paper_selection": 10,
  "paper_analysis": 10, "code_execution": 10, "objectives": 10, "implementation": 10, "evaluation": 10,
  "paper_writing": 10, "final": 10}}');
select tests.assert_eq((select progress from public.v_project_overview where id = :'pa'),
  round(20 + 10 + 10 * 2.0 / :impl_n)::int, 'the semester weights are used');
select tests.assert_eq((select overdue_tasks from public.v_project_overview where id = :'pa'), 0, 'no overdue tasks yet');
select tests.reset();
update public.tasks set due_at = now() - interval '3 days' where project_id = :'pa' and week_no = 3;
select tests.login_as((select id from u where name = 'p7guide'));
select tests.assert_eq((select overdue_tasks from public.v_project_overview where id = :'pa'),
  (select count(*)::int from public.tasks where project_id = :'pa' and week_no = 3 and is_active), 'overdue tasks are counted');
select tests.assert_eq((select min(days_overdue) from public.v_task_flags where project_id = :'pa'), 3, 'days overdue');
select tests.assert_eq((select open_corrections + addressed_corrections from public.v_project_overview where id = :'pa'), 1,
  'corrections are counted');
select tests.reset();
select tests.pass('DATA-09 progress and the overview');

-- =============================================================================
-- Faculty workload: the lead and the HOD only
-- =============================================================================
select tests.login_as((select id from u where name = 'p7guide'));
select tests.assert_eq((select count(*)::int from public.v_faculty_workload), 0, 'faculty do not see the workload table');
select tests.reset();
select tests.login_as((select id from u where name = 'p7studa'));
select tests.assert_eq((select count(*)::int from public.v_faculty_workload), 0, 'nor do students');
select tests.reset();
select tests.login_as((select id from u where name = 'p7lead'));
select tests.assert_eq((select string_agg(role, ',' order by role) from public.v_faculty_workload where semester_id = :'sem'),
  'faculty,faculty,hod,lead_faculty', 'the lead sees every faculty member and the HOD');
select tests.assert_eq((select guided_projects || '/' || pending_reviews || '/' || corrections_to_verify || '/' || reviews_last_7_days
                        from public.v_faculty_workload where semester_id = :'sem' and user_id = (select id from u where name = 'p7guide')),
  '2/1/1/1', 'guided projects, pending reviews, corrections to verify, recent reviews');
select tests.assert(
  (select avg_turnaround_hours from public.v_faculty_workload where semester_id = :'sem' and user_id = (select id from u where name = 'p7guide')) is not null,
  'turnaround is measured');
select tests.reset();
select tests.pass('faculty workload');

-- =============================================================================
-- Performance: 30 projects × 16 weeks
-- =============================================================================
select tests.login_as((select id from u where name = 'p7hod'));
select public.app_create_semester('P7 Load', '2026-27', '{"start_date": "2026-09-01"}') as sem2 \gset
select public.app_set_lead(:'sem2', (select id from u where name = 'p7lead'));
select public.app_set_membership(:'sem2', (select id from u where name = 'p7guide'), 'faculty');
select public.app_upsert_domain(:'sem2', 'Machine Learning');
select public.app_activate_semester(:'sem2');
-- Fictional test entries (clearly labelled), one project each.
select public.app_import_roster(:'sem2', (select jsonb_agg(jsonb_build_object('slot_no', n,
  'full_name', format('P7 Load Student %s', n), 'domain_name', 'Machine Learning')) from generate_series(1, 30) n), false);
select public.app_assign_guide(p.id, (select id from u where name = 'p7guide')) from public.projects p where p.semester_id = :'sem2';
select tests.reset();
select tests.assert_eq((select count(*)::int from public.projects where semester_id = :'sem2'), 30, '30 projects');
select tests.assert(
  (select count(*) from public.tasks k join public.projects p on p.id = k.project_id where p.semester_id = :'sem2') >= 30 * 16,
  'at least a task per week for each project');
-- The live database keeps planner statistics current (autovacuum); this throwaway one
-- does not, so gather them first, as production would have them.
analyze;
create temporary table timing (what text, ms numeric);
grant all on timing to authenticated;
select tests.login_as((select id from u where name = 'p7hod'));
do $$
declare t0 timestamptz; s uuid := (select id from public.semesters where name = 'P7 Load');
begin
  t0 := clock_timestamp(); perform * from public.v_project_overview where semester_id = s;
  insert into timing values ('overview', extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); perform * from public.v_review_queue where semester_id = s;
  insert into timing values ('queue', extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); perform * from public.v_faculty_workload where semester_id = s;
  insert into timing values ('workload', extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); perform * from public.v_task_flags where semester_id = s;
  insert into timing values ('flags', extract(epoch from clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); perform * from public.v_timeliness where semester_id = s;
  insert into timing values ('timeliness', extract(epoch from clock_timestamp() - t0) * 1000);
end $$;
select tests.reset();
do $$ begin raise notice '    timings (ms): %', (select string_agg(what || '=' || round(ms), ', ' order by what) from timing); end $$;
select tests.assert_eq((select string_agg(what, ',') from timing where ms >= 1000), null, 'every dashboard view answers in under 1 s');
select tests.pass('performance with 30 projects');

rollback;
