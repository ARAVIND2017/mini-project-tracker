-- Phase 5: semester plan, task generation, weekly submissions, reviews, resubmissions,
-- overdue/blocked flags and the review queue. Test IDs refer to docs/TEST_PLAN.md.
-- Fictional users only.
begin;

create temporary table u (name text primary key, id uuid);
grant all on u to anon, authenticated;

insert into auth.users (email, raw_user_meta_data) values
  ('p5hod@example.test',   '{"full_name": "P5 HOD"}'),
  ('p5lead@example.test',  '{"full_name": "P5 Lead"}'),
  ('p5guide@example.test', '{"full_name": "P5 Guide"}'),
  ('p5fac@example.test',   '{"full_name": "P5 Other Faculty"}'),
  ('p5studa@example.test', '{"full_name": "P5 Student A"}'),
  ('p5studb@example.test', '{"full_name": "P5 Student B"}');
insert into u select split_part(email, '@', 1), id from auth.users where email like 'p5%@example.test';
select app.bootstrap_hod('p5hod@example.test');

-- =============================================================================
-- FUN-09 the default plan and deadlines
-- =============================================================================
select tests.login_as((select id from u where name = 'p5hod'));
-- 2027-01-05 is a Tuesday (the lab day).
select public.app_create_semester('P5 Semester', '2026-27', '{"start_date": "2027-01-05"}') as sem \gset
select tests.reset();
select tests.assert_eq((select count(*)::int from public.milestones where semester_id = :'sem'), 16, 'a new semester gets 16 milestones');
select tests.assert_eq((select count(*)::int from public.task_templates where semester_id = :'sem'), 19, 'and the 19 default task templates');
select tests.assert_eq((select count(*)::int from public.milestones where semester_id = :'sem' and is_gate), 7, 'seven gates G1–G7');
select tests.assert_eq(app.week_due_at(:'sem', 1), '2027-01-11 23:59:00+05:30'::timestamptz,
  'week 1 is due Monday 23:59 (semester time zone) before the week 2 lab');
select tests.assert_eq(app.week_due_at(:'sem', 16), '2027-04-26 23:59:00+05:30'::timestamptz, 'week 16 deadline');

select tests.login_as((select id from u where name = 'p5hod'));
select public.app_upsert_milestone(:'sem', 3, '{"title": "Analysis week (moved)", "stage_key": "paper_analysis",
  "start_date_override": "2027-01-21"}');
select tests.reset();
select tests.assert_eq(app.week_due_at(:'sem', 3), '2027-01-25 23:59:00+05:30'::timestamptz,
  'FUN-02 a milestone start-date override moves that week''s deadline');

select tests.login_as((select id from u where name = 'p5hod'));
select public.app_upsert_milestone(:'sem', 3, '{"title": "Paper analysis and repository", "stage_key": "paper_analysis"}');
select public.app_set_lead(:'sem', (select id from u where name = 'p5lead'));
select public.app_set_membership(:'sem', (select id from u where name = 'p5guide'), 'faculty');
select public.app_set_membership(:'sem', (select id from u where name = 'p5fac'), 'faculty');
select public.app_upsert_domain(:'sem', 'Machine Learning') as d_ml \gset
select public.app_upsert_domain(:'sem', 'Web Systems') as d_web \gset
-- Domain override: Web projects test features instead of baseline metrics in week 11.
select public.app_upsert_task_template(:'sem', jsonb_build_object(
  'week_no', 11, 'stage_key', 'evaluation', 'domain_id', :'d_web',
  'replaces_template_id', (select id from public.task_templates where semester_id = :'sem' and week_no = 11),
  'title', 'Baseline feature and performance comparison',
  'acceptance_criteria', array['Feature comparison table', 'Response times measured'],
  'required_evidence', array['test_results'])) as tpl_web \gset
select tests.assert_raises(format($$select public.app_upsert_task_template(%L, '{"week_no": 2, "stage_key": "exploration",
  "title": "X", "acceptance_criteria": ["a"], "replaces_template_id": "%s"}')$$, :'sem',
  (select id from public.task_templates where semester_id = :'sem' and week_no = 1)),
  'VALIDATION: Only a domain task can replace a generic task', 'only domain templates replace generic ones');
select tests.assert_raises(format($$select public.app_upsert_task_template(%L, '{"week_no": 2, "stage_key": "exploration",
  "title": "X", "acceptance_criteria": []}')$$, :'sem'),
  'VALIDATION: Give at least one acceptance criterion', 'a template needs acceptance criteria');
select tests.assert_raises(format($$select public.app_upsert_task_template(%L, '{"week_no": 2, "stage_key": "exploration",
  "title": "X", "acceptance_criteria": ["a"], "required_evidence": ["selfie"]}')$$, :'sem'),
  'VALIDATION: Unknown kind of evidence', 'evidence kinds are checked');
select tests.assert_raises(format($$select public.app_upsert_task_template(%L, '{"week_no": 17, "stage_key": "exploration",
  "title": "X", "acceptance_criteria": ["a"]}')$$, :'sem'),
  'VALIDATION: Week must be from 1 to 16', 'weeks stay within the semester');
select tests.reset();

select tests.login_as((select id from u where name = 'p5lead'));
select tests.assert_raises(format($$select public.app_upsert_milestone(%L, 1, '{"title": "x", "stage_key": "exploration"}')$$, :'sem'),
  'FORBIDDEN: Only the HOD can change the semester plan', 'the lead cannot change the plan');
select tests.assert_raises(format($$select public.app_generate_tasks(%L)$$, :'sem'),
  'FORBIDDEN: Only the HOD can change the semester plan', 'the lead cannot generate tasks');
select tests.assert_raises(format($$insert into public.tasks (project_id, week_no, stage_key, title, due_at)
  values (gen_random_uuid(), 1, 'exploration', 'x', now())$$), 'permission denied%', 'tasks cannot be inserted directly');
select tests.reset();
select tests.pass('FUN-09 default plan, deadlines and plan editing');

-- =============================================================================
-- Generation with domain overrides (FUN-09)
-- =============================================================================
select tests.login_as((select id from u where name = 'p5hod'));
select public.app_import_roster(:'sem', $$[
  {"slot_no": 1, "full_name": "P5 Student A", "email": "p5studa@example.test", "domain_name": "Machine Learning"},
  {"slot_no": 2, "full_name": "P5 Student B", "email": "p5studb@example.test", "domain_name": "Web Systems"},
  {"slot_no": 3}
]$$::jsonb, false);
select public.app_link_student((select id from public.students where semester_id = :'sem' and slot_no = 1), (select id from u where name = 'p5studa'));
select public.app_link_student((select id from public.students where semester_id = :'sem' and slot_no = 2), (select id from u where name = 'p5studb'));
select tests.reset();
select p.id as pa from public.projects p join public.students s on s.id = p.student_id where s.semester_id = :'sem' and s.slot_no = 1 \gset
select p.id as pb from public.projects p join public.students s on s.id = p.student_id where s.semester_id = :'sem' and s.slot_no = 2 \gset
select tests.assert_eq((select count(*)::int from public.tasks where project_id = :'pa'), 0, 'no tasks before the semester is active');

select tests.login_as((select id from u where name = 'p5hod'));
select public.app_activate_semester(:'sem');
select public.app_assign_guide(:'pa', (select id from u where name = 'p5guide'));
select public.app_assign_guide(:'pb', (select id from u where name = 'p5guide'));
select tests.reset();
select tests.assert_eq((select count(*)::int from public.tasks where project_id = :'pa' and is_active), 19, 'activation generates every task');
select tests.assert_eq((select title from public.tasks where project_id = :'pa' and week_no = 11), 'Testing',
  'a Machine Learning project gets the generic week 11 task');
select tests.assert_eq((select string_agg(title, ',') from public.tasks where project_id = :'pb' and week_no = 11 and is_active),
  'Baseline feature and performance comparison', 'a Web Systems project gets the domain replacement instead');
select tests.assert_eq((select due_at from public.tasks where project_id = :'pa' and week_no = 1),
  '2027-01-11 23:59:00+05:30'::timestamptz, 'tasks carry the computed deadline');

select tests.login_as((select id from u where name = 'p5hod'));
select tests.assert_eq(public.app_generate_tasks(:'sem'), 0, 'generating again creates nothing new');
select public.app_upsert_task_template(:'sem', jsonb_build_object('week_no', 1, 'stage_key', 'exploration',
  'title', 'Explore the assigned domain (revised)', 'acceptance_criteria', array['At least 3 candidate topics'],
  'required_evidence', array['other']),
  (select id from public.task_templates where semester_id = :'sem' and week_no = 1));
select tests.assert_eq(public.app_generate_tasks(:'sem', null, true), 2, 'regenerating refreshes the unsubmitted tasks of both projects');
-- Moving project B to Machine Learning switches the Web task off and adds the generic one.
select public.app_set_project_domain(:'pb', :'d_ml');
select tests.reset();
select tests.assert_eq((select string_agg(title || '=' || is_active, ',' order by title) from public.tasks where project_id = :'pb' and week_no = 11),
  'Baseline feature and performance comparison=false,Testing=true', 'a domain change swaps the replaced task');
select tests.pass('FUN-09 generation with domain overrides');

-- =============================================================================
-- Weekly loop: submit on time → review with 2 corrections → address → resubmit late → verify
-- =============================================================================
select id as t1 from public.tasks where project_id = :'pa' and week_no = 1 \gset
select tests.login_as((select id from u where name = 'p5studa'));
select public.app_start_task(:'t1');
select tests.assert_eq((select status::text from public.tasks where id = :'t1'), 'in_progress', 'starting moves the task to in progress');
select tests.assert_raises(format($$select public.app_submit_task(%L, 'Too short')$$, :'t1'),
  'VALIDATION: The progress report needs at least 100 characters', 'a progress report of at least 100 characters');
select tests.assert_raises(format($$select public.app_submit_task(%L, %L)$$, :'t1', repeat('Weekly progress. ', 8)),
  'VALIDATION: Attach at least one evidence link for this task', 'tasks with required evidence need a link');
select tests.assert_raises(format($$select public.app_submit_task(%L, %L, '[{"category": "other", "url": "http://x.example.test", "description": "Search notes link"}]')$$,
  :'t1', repeat('Weekly progress. ', 8)),
  'VALIDATION: Each evidence link must be a link starting with https://', 'SEC-12 evidence links on submissions');
select public.app_submit_task(:'t1', repeat('Week one progress report. ', 5),
  '[{"category": "other", "url": "https://drive.example.test/notes", "description": "Search notes for week 1"}]') as sub1 \gset
select tests.assert_raises(format($$select public.app_submit_task(%L, %L)$$, :'t1', repeat('Again. ', 20)),
  'INVALID_STATE: This task is already waiting for review', 'no second submission while waiting for review');
select tests.reset();
select tests.assert_eq((select is_late from public.submissions where id = :'sub1'), false, 'FUN-10 on time');
select tests.assert_eq((select count(*)::int from public.submission_evidence where submission_id = :'sub1'), 1, 'evidence is attached to the submission');

-- Only reviewers open and decide (SEC-07).
select tests.login_as((select id from u where name = 'p5fac'));
select tests.assert_raises(format($$select public.app_start_review(%L)$$, :'sub1'),
  'FORBIDDEN: Only a reviewer of this project can review it', 'unassigned faculty cannot open a review');
select tests.assert_raises(format($$select public.app_record_review('task_submission', %L, 'accepted')$$, :'sub1'),
  'FORBIDDEN: Only a reviewer of this project can accept, request changes or reject', 'journey 5: unassigned faculty is refused');
select public.app_record_review('task_submission', :'sub1', 'comment_only', null, 'Nice notes');
select tests.reset();

select tests.login_as((select id from u where name = 'p5guide'));
select public.app_start_review(:'sub1');
select tests.reset();
select tests.assert_eq((select status::text from public.tasks where id = :'t1'), 'under_review', 'opening moves the task to under review');
select tests.login_as((select id from u where name = 'p5guide'));
select public.app_record_review('task_submission', :'sub1', 'changes_requested', 'Two things to fix', null,
  array['Add two more sources', 'Link the search notes per source']) as rev1 \gset
select tests.reset();
select tests.assert_eq((select status::text from public.tasks where id = :'t1'), 'changes_requested', 'changes requested');

-- Resubmission waits for both corrections; it is late because the deadline has passed.
update public.tasks set due_at = now() - interval '1 day' where id = :'t1';
select tests.login_as((select id from u where name = 'p5studa'));
select tests.assert_raises(format($$select public.app_submit_task(%L, %L, '[{"category": "other", "url": "https://drive.example.test/n2", "description": "Updated search notes"}]')$$,
  :'t1', repeat('Revised. ', 15)),
  'GATE_NOT_MET: Address the 2 open correction(s) before resubmitting', 'open corrections block a resubmission');
select public.app_address_correction(c.id, 'Done as requested in version 2.') from public.corrections c where c.review_id = :'rev1';
select public.app_submit_task(:'t1', repeat('Week one, revised after review. ', 4),
  '[{"category": "other", "url": "https://drive.example.test/n2", "description": "Updated search notes"}]') as sub2 \gset
select tests.reset();
select tests.assert_eq((select version || ':' || is_late from public.submissions where id = :'sub2'), '2:true',
  'DATA-07 / FUN-10 version 2 is recorded as late');
select tests.assert_eq((select is_late from public.submissions where id = :'sub1'), false, 'version 1 stays on time');
select tests.assert_eq((select status::text from public.tasks where id = :'t1'), 'resubmitted', 'the task is resubmitted');

-- DATA-07: submissions are history.
select tests.login_as((select id from u where name = 'p5studa'));
select tests.assert_raises(format($$update public.submissions set is_late = false where id = %L$$, :'sub2'),
  'permission denied%', 'DATA-07 a student cannot change a submission');
select tests.reset();
set local role service_role;
select tests.assert_raises(format($$update public.submissions set is_late = false where id = %L$$, :'sub2'),
  '%', 'DATA-07 not even the service role can change a submission');
reset role;

select tests.login_as((select id from u where name = 'p5guide'));
select tests.assert_raises(format($$select public.app_record_review('task_submission', %L, 'accepted')$$, :'sub1'),
  'INVALID_STATE: Only work that is waiting for review can be decided', 'an older version cannot be decided');
select tests.assert_raises(format($$select public.app_record_review('task_submission', %L, 'accepted')$$, :'sub2'),
  'GATE_NOT_MET: Verify or waive the 2 outstanding correction(s) before accepting', 'corrections from version 1 must be resolved');
select public.app_resolve_correction(c.id, 'verify') from public.corrections c where c.review_id = :'rev1';
select public.app_record_review('task_submission', :'sub2', 'accepted', 'Verified');
select tests.reset();
select tests.assert_eq((select status::text from public.tasks where id = :'t1'), 'verified', 'the task is verified');
select tests.assert_eq((select count(*)::int || '/' || count(*) filter (where is_late) from public.submissions where task_id = :'t1'), '2/1',
  'timeliness: one on time, one late');
select tests.pass('weekly loop / DATA-07 / FUN-10 / WF-03 / WF-04 for tasks');

-- =============================================================================
-- WF-02: S6 work needs approved objectives (or an HOD override)
-- =============================================================================
select id as t7 from public.tasks where project_id = :'pa' and week_no = 7 \gset
select tests.login_as((select id from u where name = 'p5studa'));
select tests.assert_raises(format($$select public.app_submit_task(%L, %L, '[{"category": "implementation_evidence", "url": "https://code.example.test/plan", "description": "Implementation plan"}]')$$,
  :'t7', repeat('Implementation plan. ', 6)),
  'GATE_NOT_MET: Objectives (S5) must be approved before this work can be submitted', 'WF-02 S6 is gated on S5');
select tests.reset();
select tests.login_as((select id from u where name = 'p5hod'));
select public.app_override(:'pa', 'objective_gate', 'Approved in the lab; recorded in the system later');
select tests.reset();
select tests.login_as((select id from u where name = 'p5studa'));
select public.app_submit_task(:'t7', repeat('Implementation plan. ', 6),
  '[{"category": "implementation_evidence", "url": "https://code.example.test/plan", "description": "Implementation plan"}]');
select tests.reset();
select tests.assert_eq((select status::text from public.tasks where id = :'t7'), 'submitted', 'WF-02 succeeds after the HOD override');
select tests.pass('WF-02 objectives gate');

-- =============================================================================
-- S6 is approved when all its tasks are verified (after S1–S5)
-- =============================================================================
update public.project_stages set status = 'approved'
where project_id = :'pb' and stage_key in ('exploration', 'paper_selection', 'paper_analysis', 'code_execution', 'objectives');
select tests.login_as((select id from u where name = 'p5studb'));
select public.app_submit_task(t.id, repeat('Implementation work this week. ', 4),
  '[{"category": "implementation_evidence", "url": "https://code.example.test/commit", "description": "Commit with the changes"}]')
from public.tasks t where t.project_id = :'pb' and t.stage_key = 'implementation' and t.is_active order by t.week_no;
select tests.reset();
select tests.login_as((select id from u where name = 'p5guide'));
select public.app_record_review('task_submission', s.id, 'accepted', 'Verified')
from public.submissions s join public.tasks t on t.id = s.task_id
where t.project_id = :'pb' and t.stage_key = 'implementation' and t.week_no < 10;
select tests.reset();
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pb' and stage_key = 'implementation'),
  'in_progress', 'S6 stays open while a task is not verified');
select tests.login_as((select id from u where name = 'p5guide'));
select public.app_record_review('task_submission', s.id, 'accepted', 'Verified')
from public.submissions s join public.tasks t on t.id = s.task_id
where t.project_id = :'pb' and t.stage_key = 'implementation' and t.week_no = 10;
select tests.reset();
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pb' and stage_key = 'implementation'),
  'approved', 'S6 approved when every S6 task is verified');
select tests.pass('S6 completion');

-- =============================================================================
-- FUN-11 overdue and blocked; the review queue
-- =============================================================================
update public.tasks set due_at = now() - interval '2 days' where project_id = :'pa' and week_no = 2;
select tests.login_as((select id from u where name = 'p5studa'));
select tests.assert_eq((select is_overdue from public.v_tasks where project_id = :'pa' and week_no = 2), true, 'FUN-11 overdue is computed');
select tests.assert_eq((select is_overdue from public.v_tasks where project_id = :'pa' and week_no = 1), false, 'a verified task is never overdue');
select tests.assert_raises(format($$select public.app_set_blocked('task', %L, true)$$,
  (select id from public.tasks where project_id = :'pa' and week_no = 2)),
  'VALIDATION: The reason needs at least 5 characters', 'blocking needs a reason');
select public.app_set_blocked('task', (select id from public.tasks where project_id = :'pa' and week_no = 2), true, 'Waiting for dataset access');
select tests.reset();
select tests.assert_eq((select blocked::text || '|' || status from public.tasks where project_id = :'pa' and week_no = 2),
  'true|not_started', 'FUN-11 blocked is a flag; the status does not change');
select tests.login_as((select id from u where name = 'p5studb'));
select tests.assert_raises(format($$select public.app_set_blocked('project', %L, true, 'Not my project')$$, :'pa'),
  'NOT_FOUND: Not found', 'another student cannot block this project');
select tests.reset();
select tests.login_as((select id from u where name = 'p5fac'));
select tests.assert_raises(format($$select public.app_set_blocked('project', %L, true, 'Server down')$$, :'pa'),
  'FORBIDDEN: Only the student or a reviewer of this project can change the blocked flag', 'unassigned faculty cannot block');
select tests.reset();
select tests.login_as((select id from u where name = 'p5guide'));
select public.app_set_blocked('project', :'pa', true, 'Lab machines unavailable this week');
select public.app_set_blocked('project', :'pa', false);
select tests.assert_eq((select count(*)::int from public.v_review_queue where project_id = :'pa' and item_type = 'submission'
  and (select id from u where name = 'p5guide') = any (reviewer_ids)), 1, 'the guide''s queue has the week 7 submission');
select tests.reset();
select tests.assert_eq((select blocked from public.projects where id = :'pa'), false, 'the flag can be cleared');

-- Journey 5: the lead authorizes the other faculty member; the authorization expires.
select tests.login_as((select id from u where name = 'p5lead'));
select public.app_grant_review_authorization(:'pa', (select id from u where name = 'p5fac'), now() + interval '1 day', 'Cross-review of week 7') as auth \gset
select tests.reset();
select tests.login_as((select id from u where name = 'p5fac'));
select tests.assert_eq((select count(*)::int from public.v_review_queue where project_id = :'pa'
  and (select id from u where name = 'p5fac') = any (reviewer_ids)), 1, 'the authorized faculty member sees it in "mine"');
select public.app_record_review('task_submission', s.id, 'changes_requested', 'Add the dataset plan', null, array['Describe the dataset split'])
from public.submissions s where s.task_id = :'t7';
select tests.reset();
update public.review_authorizations set valid_until = now() - interval '1 minute' where id = :'auth';
select tests.login_as((select id from u where name = 'p5fac'));
select tests.assert_raises(format($$select public.app_resolve_correction(%L, 'waive', 'Not needed after all')$$,
  (select c.id from public.corrections c join public.submissions s on s.id = c.target_id where s.task_id = :'t7')),
  'FORBIDDEN: Only a reviewer of this project can resolve corrections', 'journey 5: refused again after expiry');
select tests.reset();
select tests.pass('FUN-11 overdue and blocked / review queue / journey 5');

-- =============================================================================
-- SEC-08 isolation
-- =============================================================================
select tests.login_as((select id from u where name = 'p5studb'));
select tests.assert_eq((select count(*)::int from public.tasks where project_id = :'pa'), 0, 'SEC-08 tasks');
select tests.assert_eq((select count(*)::int from public.v_tasks where project_id = :'pa'), 0, 'SEC-08 v_tasks');
select tests.assert_eq((select count(*)::int from public.submissions where project_id = :'pa'), 0, 'SEC-08 submissions');
select tests.assert_eq((select count(*)::int from public.submission_evidence se join public.submissions s on s.id = se.submission_id
  where s.project_id = :'pa'), 0, 'SEC-08 submission evidence');
select tests.assert_eq((select count(*)::int from public.v_review_queue where project_id = :'pa'), 0, 'SEC-08 review queue');
select tests.assert_eq((select count(*)::int from public.milestones where semester_id = :'sem'), 16, 'students see the plan');
select tests.assert_raises(format($$select public.app_submit_task(%L, %L)$$, :'t1', repeat('x', 120)),
  'NOT_FOUND: Task not found', 'SEC-08 B cannot submit A''s task');
select tests.assert_raises(format($$update public.tasks set status = 'verified' where project_id = %L$$, :'pb'),
  'permission denied%', 'SEC-09 task status cannot be written directly');
select tests.reset();
select tests.pass('SEC-08 / SEC-09 for tasks');

-- Audit
select tests.assert(
  (select count(*) from public.audit_log where action = 'task.submitted' and project_id = :'pa') >= 3, 'submissions are logged');
select tests.assert(
  (select count(*) from public.audit_log where action = 'tasks.generated' and semester_id = :'sem') >= 2, 'generation is logged');
select tests.pass('audit for Phase 5');

rollback;
