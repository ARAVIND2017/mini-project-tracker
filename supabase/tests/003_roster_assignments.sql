-- Phase 3: domains, expertise, roster import, projects, assignment requests,
-- review authorizations. Test IDs refer to docs/TEST_PLAN.md. Fictional users only.
begin;

create temporary table u (name text primary key, id uuid);
grant all on u to anon, authenticated;

insert into auth.users (email, raw_user_meta_data) values
  ('p3hod@example.test',   '{"full_name": "P3 HOD"}'),
  ('p3lead@example.test',  '{"full_name": "P3 Lead"}'),
  ('p3fac1@example.test',  '{"full_name": "P3 Faculty One"}'),
  ('p3fac2@example.test',  '{"full_name": "P3 Faculty Two"}'),
  ('p3stud1@example.test', '{"full_name": "P3 Student 01"}'),
  ('p3other@example.test', '{"full_name": "P3 Outsider"}');
insert into u select split_part(email, '@', 1), id from auth.users where email like 'p3%@example.test';

select app.bootstrap_hod('p3hod@example.test');

-- Semester with a lead and two faculty ------------------------------------------------
select tests.login_as((select id from u where name = 'p3hod'));
select public.app_create_semester('P3 Semester', '2026-27', '{"max_students": 3, "start_date": "2027-01-05"}') as sem \gset
insert into u values ('sem', :'sem');
select public.app_set_lead(:'sem', (select id from u where name = 'p3lead'));
select public.app_set_membership(:'sem', (select id from u where name = 'p3fac1'), 'faculty');
select public.app_set_membership(:'sem', (select id from u where name = 'p3fac2'), 'faculty');

-- Activation now needs a domain.
select tests.assert_raises(format($$select public.app_activate_semester(%L)$$, :'sem'),
  'GATE_NOT_MET: Add at least one project domain first', 'activation requires a domain');

-- Domains and criteria (FUN-06) ---------------------------------------------------------
select public.app_upsert_domain(:'sem', 'Artificial Intelligence', 'ML and AI projects') as d_ai \gset
select public.app_upsert_domain(:'sem', 'Web Systems') as d_web \gset
select public.app_upsert_domain(:'sem', 'Retired Domain', null, false) as d_old \gset
insert into u values ('d_ai', :'d_ai'), ('d_web', :'d_web'), ('d_old', :'d_old');
select tests.assert_raises(format($$select public.app_upsert_domain(%L, '  artificial intelligence ')$$, :'sem'),
  'VALIDATION: A domain with this name already exists in the semester', 'domain names are unique (ignoring case and spaces)');
select public.app_upsert_criterion(:'d_ai', 'Accuracy improvement over baseline', null, 1);
select public.app_activate_semester(:'sem');
select tests.reset();

select tests.login_as((select id from u where name = 'p3lead'));
select tests.assert_raises(format($$select public.app_upsert_domain(%L, 'Lead domain')$$, :'sem'),
  'FORBIDDEN: Only the HOD can manage domains', 'the lead cannot manage domains');
select tests.assert_raises(format($$insert into public.domains (semester_id, name) values (%L, 'direct')$$, :'sem'),
  'permission denied%', 'domains cannot be inserted directly');
select tests.reset();
select tests.pass('FUN-06 domains and criteria');

-- Expertise (FUN-07) -----------------------------------------------------------------------
select tests.login_as((select id from u where name = 'p3fac1'));
select public.app_set_expertise(:'sem', array[(select id from u where name = 'd_ai')]);
select tests.assert_raises(format($$select public.app_set_expertise(%L, array[%L]::uuid[], %L)$$, :'sem',
  (select id from u where name = 'd_web'), (select id from u where name = 'p3fac2')),
  'FORBIDDEN: You can only set your own expertise', 'faculty cannot set someone else''s expertise');
select tests.assert_raises(format($$select public.app_set_expertise(%L, array[%L]::uuid[])$$, :'sem',
  (select id from u where name = 'd_old')),
  'VALIDATION: Choose active domains of this semester', 'inactive domains cannot be chosen');
select tests.reset();
select tests.login_as((select id from u where name = 'p3fac2'));
select public.app_set_expertise(:'sem', array[(select id from u where name = 'd_web'), (select id from u where name = 'd_ai')]);
select public.app_set_expertise(:'sem', array[(select id from u where name = 'd_web')]);
select tests.reset();
select tests.assert_eq((select count(*)::int from public.faculty_expertise
  where user_id = (select id from u where name = 'p3fac2') and is_active), 1, 'removed expertise is switched off, not deleted');
select tests.assert_eq((select count(*)::int from public.faculty_expertise
  where user_id = (select id from u where name = 'p3fac2')), 2, 'expertise history is kept');
select tests.login_as((select id from u where name = 'p3other'));
select tests.assert_raises(format($$select public.app_set_expertise(%L, '{}'::uuid[])$$, :'sem'),
  'FORBIDDEN: Only faculty of this semester can record expertise', 'non-members cannot record expertise');
select tests.reset();
select tests.pass('FUN-07 expertise');

-- Roster import: preview (DATA-02, DATA-03) -------------------------------------------------
select tests.login_as((select id from u where name = 'p3hod'));
select public.app_import_roster(:'sem', $$[
  {"slot_no": "1", "institution_id": "1XX26CS001", "full_name": " P3 Student 01 ", "email": "p3stud1@example.test", "domain_name": "artificial intelligence"},
  {"slot_no": 2, "institution_id": "1XX26CS002", "full_name": "P3 Student 02", "email": "p3stud2@example.test", "domain_name": "Web Systems"},
  {"slot_no": 3},
  {"slot_no": 4, "full_name": "Bad Email", "email": "not-an-email"},
  {"slot_no": 1, "full_name": "Duplicate slot"},
  {"slot_no": 5, "full_name": "Unknown domain", "domain_name": "Quantum Basket Weaving"},
  {"slot_no": "x"}
]$$::jsonb) as preview \gset
select tests.assert_eq(((:'preview')::jsonb ->> 'dry_run')::boolean, true, 'imports are previews by default');
select tests.assert_eq(jsonb_array_length((:'preview')::jsonb -> 'errors'), 4, 'four rows have problems');
select tests.assert_eq(((:'preview')::jsonb ->> 'ok')::boolean, false, 'preview with problems is not ok');
select tests.assert_eq((select count(*)::int from public.students where semester_id = :'sem'), 0, 'a preview writes nothing');
select tests.assert_raises(format($$select public.app_import_roster(%L, %L::jsonb, false)$$, :'sem',
  '[{"slot_no": 4, "full_name": "Bad Email", "email": "not-an-email"}]'),
  'VALIDATION: 1 row(s) have problems. Preview the import and fix them first.', 'a real import refuses rows with problems');

-- Real import with two students and one empty slot.
select public.app_import_roster(:'sem', $$[
  {"slot_no": 1, "institution_id": "1XX26CS001", "full_name": " P3 Student 01 ", "email": "p3stud1@example.test", "domain_name": "artificial intelligence"},
  {"slot_no": 2, "institution_id": "1XX26CS002", "full_name": "P3 Student 02", "email": "p3stud2@example.test", "domain_name": "Web Systems"},
  {"slot_no": 3}
]$$::jsonb, false) as imported \gset
select tests.reset();

select tests.assert_eq(((:'imported')::jsonb -> 'counts' ->> 'create')::int, 3, 'three slots created');
select tests.assert_eq((select full_name from public.students where semester_id = :'sem' and slot_no = 1),
  'P3 Student 01', 'values are stored as given (only surrounding spaces trimmed)');
select tests.assert_eq((select institution_id from public.students where semester_id = :'sem' and slot_no = 1),
  '1XX26CS001', 'student ID stored exactly');
select tests.assert_eq((select status::text from public.students where semester_id = :'sem' and slot_no = 3),
  'empty', 'DATA-03 blank rows become empty slots');
select tests.assert_eq((select status::text from public.students where semester_id = :'sem' and slot_no = 1),
  'pending_invite', 'filled slots without an account wait for an invitation');
select tests.assert_eq((select count(*)::int from public.projects where semester_id = :'sem'), 2,
  'DATA-05 one project per filled slot, none for the empty slot');
select tests.assert_eq((select count(*)::int from public.project_stages ps join public.projects p on p.id = ps.project_id
  where p.semester_id = :'sem'), 18, 'each project gets its nine stages');
select tests.assert_eq((select d.name from public.projects p join public.students s on s.id = p.student_id
  join public.domains d on d.id = p.domain_id where s.semester_id = :'sem' and s.slot_no = 1),
  'Artificial Intelligence', 'domain matched ignoring case');
select tests.pass('DATA-02 / DATA-03 / DATA-05 roster import');

-- Re-import, conflicts and capacity (DATA-04) ------------------------------------------------
select tests.login_as((select id from u where name = 'p3hod'));
select tests.assert_eq((public.app_import_roster(:'sem', $$[
  {"slot_no": 1, "institution_id": "1XX26CS001", "full_name": "P3 Student 01", "email": "p3stud1@example.test"},
  {"slot_no": 3}]$$::jsonb) -> 'counts' ->> 'unchanged')::int, 2, 're-importing the same data changes nothing');
select tests.assert_eq(jsonb_array_length(public.app_import_roster(:'sem',
  '[{"slot_no": 2}]'::jsonb) -> 'errors'), 1, 'an import cannot empty a filled slot');
select tests.assert_eq(public.app_import_roster(:'sem',
  '[{"slot_no": 3, "full_name": "Copy", "institution_id": "1xx26cs002"}]'::jsonb) -> 'errors' -> 0 ->> 'message',
  'Student ID "1xx26cs002" is already used by another slot', 'student IDs are unique per semester (ignoring case)');

-- Capacity is 3: two filled + two more would be 4.
select tests.assert_eq((public.app_import_roster(:'sem',
  '[{"slot_no": 3, "full_name": "Third"}, {"slot_no": 4, "full_name": "Fourth"}]'::jsonb) ->> 'ok')::boolean,
  false, 'preview flags imports above capacity');
select tests.assert_raises(format($$select public.app_import_roster(%L, %L::jsonb, false)$$, :'sem',
  '[{"slot_no": 3, "full_name": "Third"}, {"slot_no": 4, "full_name": "Fourth"}]'),
  'CAPACITY_EXCEEDED: The roster would have 4 students but the semester capacity is 3', 'DATA-04 real import above capacity fails');
select tests.assert_eq((select count(*)::int from public.students where semester_id = :'sem'), 3, 'nothing changed after the failed import');
select tests.assert_raises(format($$select public.app_update_semester(%L, '{"max_students": 1}')$$, :'sem'),
  'VALIDATION: Capacity cannot be lower than the 2 students already on the roster', 'capacity cannot drop below the students on the roster');

-- Single-entry edit fills slot 3 and creates its project.
select public.app_update_student((select id from public.students where semester_id = :'sem' and slot_no = 3),
  '{"full_name": "P3 Student 03", "institution_id": "1XX26CS003"}');
select tests.assert_eq((select count(*)::int from public.projects where semester_id = :'sem'), 3, 'filling a slot creates its project');
select tests.assert_raises(format($$select public.app_update_student(%L, '{"full_name": ""}')$$,
  (select id from public.students where semester_id = :'sem' and slot_no = 3)),
  'INVALID_STATE: This slot has a student and a project; withdraw the student instead of emptying the slot', 'filled slots cannot be emptied');
select tests.assert_eq(public.app_add_empty_slots(:'sem', 5), 2, 'empty slots can be added up to a slot number');
select tests.reset();

-- Direct capacity guard (a deferred trigger) also protects the table.
select tests.assert_raises(format($outer$
  do $do$ begin
    insert into public.students (semester_id, slot_no, full_name) values (%L, 50, 'Overflow');
    set constraints students_capacity immediate;
  end $do$ $outer$, :'sem'),
  'CAPACITY_EXCEEDED:%', 'database trigger enforces capacity');

select tests.login_as((select id from u where name = 'p3lead'));
select tests.assert_raises(format($$select public.app_import_roster(%L, '[{"slot_no": 9}]'::jsonb)$$, :'sem'),
  'FORBIDDEN: Only the HOD can import the roster', 'the lead cannot import the roster');
select tests.assert_raises(format($$insert into public.students (semester_id, slot_no) values (%L, 20)$$, :'sem'),
  'permission denied%', 'roster rows cannot be inserted directly');
select tests.reset();
select tests.pass('DATA-04 capacity and roster edits');

-- Linking student accounts -------------------------------------------------------------------
select tests.login_as((select id from u where name = 'p3hod'));
select public.app_link_student((select id from public.students where semester_id = :'sem' and slot_no = 1),
  (select id from u where name = 'p3stud1'));
select tests.assert_raises(format($$select public.app_link_student(%L, %L)$$,
  (select id from public.students where semester_id = :'sem' and slot_no = 2), (select id from u where name = 'p3other')),
  'VALIDATION: The account email does not match the roster email', 'accounts link only to the matching roster email');
select tests.assert_raises(format($$select public.app_link_student(%L, %L)$$,
  (select id from public.students where semester_id = :'sem' and slot_no = 4), (select id from u where name = 'p3other')),
  'INVALID_STATE: Only a filled roster entry can be linked to an account', 'empty slots cannot be linked');
select tests.reset();
select tests.assert_eq((select status::text from public.students where semester_id = :'sem' and slot_no = 1), 'active',
  'linked roster entries become active');
select tests.assert_eq((select role::text from public.memberships where semester_id = :'sem'
  and user_id = (select id from u where name = 'p3stud1')), 'student', 'linking gives the student role');
select tests.pass('student account linking');

-- Row-level visibility (SEC-08 for these tables) ------------------------------------------------
select tests.login_as((select id from u where name = 'p3stud1'));
select tests.assert_eq((select count(*)::int from public.students), 1, 'a student sees only their own roster row');
select tests.assert_eq((select count(*)::int from public.projects), 1, 'a student sees only their own project');
select tests.assert_eq((select count(*)::int from public.v_projects), 1, 'the projects view is filtered too');
select tests.assert_eq((select slot_no from public.v_projects), 1, 'it is their own project');
select tests.assert_eq((select count(*)::int from public.project_stages), 9, 'a student sees their own nine stages');
select tests.assert_eq((select count(*)::int from public.assignment_requests), 0, 'students see no assignment requests');
select tests.assert_eq((select count(*)::int from public.faculty_expertise), 0, 'students see no expertise records');
select tests.assert_eq((select count(*)::int from public.domains where semester_id = :'sem'), 3, 'students can see domain names');
select tests.reset();

select tests.login_as((select id from u where name = 'p3fac2'));
select tests.assert_eq((select count(*)::int from public.v_projects where semester_id = :'sem'), 3, 'faculty see every project');
select tests.assert_eq((select count(*)::int from public.students where semester_id = :'sem'), 5, 'faculty see the whole roster');
select tests.reset();

select tests.login_as((select id from u where name = 'p3other'));
select tests.assert_eq((select count(*)::int from public.v_projects), 0, 'non-members see no projects');
select tests.assert_eq((select count(*)::int from public.students), 0, 'non-members see no roster');
select tests.reset();
select tests.pass('SEC-08 visibility of roster and projects');

-- Project ids by slot for the rest of the test.
insert into u select 'proj' || s.slot_no, p.id from public.projects p join public.students s on s.id = p.student_id
where s.semester_id = :'sem';

-- Guide and co-reviewer requests (FUN-08, SEC-05) -------------------------------------------------
select tests.login_as((select id from u where name = 'p3fac1'));
select public.app_request_assignment((select id from u where name = 'proj1'), 'guide',
  (select id from u where name = 'p3fac1'), 'AI is my research area') as req_fac1 \gset
insert into u values ('req_fac1', :'req_fac1');
select tests.assert_raises(format($$select public.app_request_assignment(%L, 'guide', %L, 'Please let me guide')$$,
  (select id from u where name = 'proj2'), (select id from u where name = 'p3fac1')),
  'FORBIDDEN: You can only request projects in your domains of expertise', 'FUN-08 requests only in expertise domains');
select tests.assert_raises(format($$select public.app_request_assignment(%L, 'guide', %L, 'AI is my research area')$$,
  (select id from u where name = 'proj1'), (select id from u where name = 'p3fac1')),
  'INVALID_STATE: The same request is already waiting for the HOD', 'duplicate pending requests are refused');
select tests.assert_raises(format($$select public.app_request_assignment(%L, 'guide', %L, 'No domain yet here')$$,
  (select id from u where name = 'proj3'), (select id from u where name = 'p3fac1')),
  'GATE_NOT_MET: The project has no domain yet; the HOD sets it first', 'projects need a domain before requests');
select tests.assert_raises(format($$select public.app_request_assignment(%L, 'co_reviewer', %L, 'Proposing a colleague')$$,
  (select id from u where name = 'proj1'), (select id from u where name = 'p3fac2')),
  'FORBIDDEN: Only the lead faculty can propose another faculty member', 'faculty cannot propose others');
select tests.assert_raises(format($$select public.app_decide_assignment_request(%L, true)$$, :'req_fac1'),
  'FORBIDDEN: Only the HOD can approve or reject assignment requests', 'requesters cannot approve their own request');
select tests.reset();
select tests.assert(
  (select guide_id is null from public.projects where id = (select id from u where name = 'proj1')),
  'SEC-05 a request has no effect before the HOD approves it');

-- The lead proposes fac2 as co-reviewer of project 1 and as an alternative guide.
select tests.login_as((select id from u where name = 'p3lead'));
select public.app_request_assignment((select id from u where name = 'proj1'), 'co_reviewer',
  (select id from u where name = 'p3fac2'), 'Second opinion on the model') as req_co \gset
select public.app_request_assignment((select id from u where name = 'proj1'), 'guide',
  (select id from u where name = 'p3fac2'), 'Alternative guide') as req_alt \gset
insert into u values ('req_co', :'req_co'), ('req_alt', :'req_alt');
select tests.assert_raises(format($$select public.app_decide_assignment_request(%L, true)$$, :'req_co'),
  'FORBIDDEN: Only the HOD can approve or reject assignment requests', 'the lead cannot approve requests');
select tests.reset();

select tests.login_as((select id from u where name = 'p3hod'));
select public.app_decide_assignment_request(:'req_fac1', true, 'Approved');
select public.app_decide_assignment_request(:'req_co', true);
select tests.assert_raises(format($$select public.app_decide_assignment_request(%L, true)$$, :'req_fac1'),
  'INVALID_STATE: This request has already been decided', 'requests are decided once');
select tests.reset();

select tests.assert_eq((select guide_id from public.projects where id = (select id from u where name = 'proj1')),
  (select id from u where name = 'p3fac1'), 'approved guide request sets the guide');
select tests.assert_eq((select status::text from public.assignment_requests where id = :'req_alt'), 'rejected',
  'other pending guide requests are closed when a guide is approved');
select tests.login_as((select id from u where name = 'p3fac2'));
select tests.assert_eq((select guide_name from public.v_projects where id = (select id from u where name = 'proj1')),
  'P3 Faculty One', 'UI-01 the projects view shows the guide name');
select tests.assert_eq((select co_reviewer_names from public.v_projects where id = (select id from u where name = 'proj1')),
  array['P3 Faculty Two'], 'the projects view lists co-reviewers');
select tests.assert(app.is_project_reviewer((select id from u where name = 'proj1')), 'a co-reviewer is a reviewer');
select tests.assert(not app.is_project_reviewer((select id from u where name = 'proj2')), 'but not of other projects');
select tests.reset();
select tests.login_as((select id from u where name = 'p3fac1'));
select tests.assert(app.is_project_reviewer((select id from u where name = 'proj1')), 'the guide is a reviewer');
select tests.assert(not app.is_project_reviewer((select id from u where name = 'proj2')), 'unassigned faculty are not reviewers');
select tests.reset();
select tests.login_as((select id from u where name = 'p3stud1'));
select tests.assert_eq((select guide_name from public.v_projects), 'P3 Faculty One', 'students see their guide''s name');
select tests.reset();
select tests.pass('FUN-08 / SEC-05 / UI-01 assignment requests');

-- Review authorizations (SEC-06) ----------------------------------------------------------------
select tests.login_as((select id from u where name = 'p3fac2'));
select tests.assert_raises(format($$select public.app_grant_review_authorization(%L, %L)$$,
  (select id from u where name = 'proj2'), (select id from u where name = 'p3fac1')),
  'FORBIDDEN: Only the lead faculty or the HOD can authorize reviews', 'faculty cannot grant authorizations');
select tests.reset();
select tests.login_as((select id from u where name = 'p3lead'));
select public.app_grant_review_authorization((select id from u where name = 'proj2'), (select id from u where name = 'p3fac1'),
  now() + interval '7 days', 'Cover for this week') as auth1 \gset
select tests.assert_raises(format($$select public.app_grant_review_authorization(%L, %L)$$,
  (select id from u where name = 'proj2'), (select id from u where name = 'p3fac1')),
  'INVALID_STATE: This person already has an active authorization for the project', 'one active authorization at a time');
select tests.assert_raises(format($$select public.app_grant_review_authorization(%L, %L, now() - interval '1 day')$$,
  (select id from u where name = 'proj3'), (select id from u where name = 'p3fac1')),
  'VALIDATION: The end date must be in the future', 'authorizations cannot end in the past');
select tests.reset();
select tests.login_as((select id from u where name = 'p3fac1'));
select tests.assert(app.is_project_reviewer((select id from u where name = 'proj2')), 'an authorized faculty member is a reviewer');
select tests.reset();
select tests.login_as((select id from u where name = 'p3lead'));
select public.app_revoke_review_authorization(:'auth1');
select tests.reset();
select tests.login_as((select id from u where name = 'p3fac1'));
select tests.assert(not app.is_project_reviewer((select id from u where name = 'proj2')), 'a revoked authorization stops working');
select tests.reset();
-- An expired authorization (written directly, as time passing would) also stops working.
insert into public.review_authorizations (project_id, faculty_id, granted_by, valid_until, created_at)
values ((select id from u where name = 'proj3'), (select id from u where name = 'p3fac1'),
        (select id from u where name = 'p3lead'), now() - interval '1 minute', now() - interval '2 days');
select tests.login_as((select id from u where name = 'p3fac1'));
select tests.assert(not app.is_project_reviewer((select id from u where name = 'proj3')), 'an expired authorization stops working');
select tests.reset();
select tests.pass('SEC-06 review authorizations');

-- Direct HOD changes, project domain and title ------------------------------------------------------
select tests.login_as((select id from u where name = 'p3hod'));
select public.app_set_project_domain((select id from u where name = 'proj3'), (select id from u where name = 'd_web'));
select tests.assert_raises(format($$select public.app_set_project_domain(%L, %L)$$,
  (select id from u where name = 'proj3'), (select id from u where name = 'd_old')),
  'VALIDATION: Choose an active domain of this semester', 'only active domains can be assigned');
select public.app_assign_guide((select id from u where name = 'proj2'), (select id from u where name = 'p3fac2'), 'Direct');
select public.app_remove_co_reviewer((select id from u where name = 'proj1'), (select id from u where name = 'p3fac2'));
select tests.assert_raises(format($$select public.app_assign_guide(%L, %L)$$,
  (select id from u where name = 'proj2'), (select id from u where name = 'p3other')),
  'VALIDATION: That person is not faculty in this semester', 'guides must be faculty of the semester');
select tests.reset();
select tests.assert_eq((select count(*)::int from public.project_reviewers
  where project_id = (select id from u where name = 'proj1')), 1, 'a removed co-reviewer row is kept');
select tests.assert_eq((select count(*)::int from public.project_reviewers
  where project_id = (select id from u where name = 'proj1') and is_active), 0, '…but no longer active');

select tests.login_as((select id from u where name = 'p3fac1'));
select tests.assert_raises(format($$select public.app_assign_guide(%L, %L)$$,
  (select id from u where name = 'proj3'), (select id from u where name = 'p3fac1')),
  'FORBIDDEN: Only the HOD can assign a guide directly', 'faculty cannot assign guides directly');
select tests.assert_raises(format($$select public.app_set_project_title(%L, 'A title')$$, (select id from u where name = 'proj1')),
  'FORBIDDEN: Only the student or the HOD can change the project title', 'faculty cannot set the title');
select tests.reset();

select tests.login_as((select id from u where name = 'p3stud1'));
select public.app_set_project_title((select id from u where name = 'proj1'), 'Improving model robustness');
select public.app_set_my_drive_folder((select id from public.students where user_id = (select id from u where name = 'p3stud1')),
  'https://drive.google.com/drive/folders/example');
select tests.assert_raises(format($$select public.app_set_my_drive_folder(%L, 'https://drive.google.com/x')$$,
  (select id from public.students where semester_id = :'sem' and slot_no = 2)),
  'NOT_FOUND: Roster entry not found', 'students cannot change another student''s Drive link');
select tests.assert_raises(format($$select public.app_set_project_title(%L, 'Hijack')$$, (select id from u where name = 'proj2')),
  'NOT_FOUND: Project not found', 'students cannot touch other projects');
select tests.reset();
select tests.assert_eq((select title from public.projects where id = (select id from u where name = 'proj1')),
  'Improving model robustness', 'students set their working title');
select tests.pass('HOD changes, domain and title');

-- Withdrawal ---------------------------------------------------------------------------------------
select tests.login_as((select id from u where name = 'p3hod'));
select public.app_withdraw_student((select id from public.students where semester_id = :'sem' and slot_no = 1), 'Left the course');
select tests.reset();
select tests.assert_eq((select is_active from public.memberships where semester_id = :'sem'
  and user_id = (select id from u where name = 'p3stud1')), false, 'withdrawal removes the student role');
select tests.login_as((select id from u where name = 'p3stud1'));
select tests.assert_eq((select count(*)::int from public.projects), 0, 'a withdrawn student loses access');
select tests.reset();
select tests.login_as((select id from u where name = 'p3hod'));
select tests.assert_eq(public.app_import_roster(:'sem', '[{"slot_no": 1, "full_name": "Replacement"}]'::jsonb) -> 'errors' -> 0 ->> 'message',
  'Slot 1 belongs to a withdrawn student and cannot be changed', 'withdrawn slots are protected');
select tests.reset();
select tests.pass('student withdrawal');

-- Audit ------------------------------------------------------------------------------------------
select tests.login_as((select id from u where name = 'p3lead'));
select tests.assert((select count(*) from public.audit_log where project_id = (select id from u where name = 'proj1')) > 0,
  'the lead can read project audit entries');
select tests.reset();
select tests.login_as((select id from u where name = 'p3fac1'));
select tests.assert_eq((select count(*)::int from public.audit_log), 0, 'faculty cannot read the audit log');
select tests.reset();
select tests.assert(
  (select count(*) from public.audit_log where action = 'assignment.approved' and actor_id = (select id from u where name = 'p3hod')) = 2,
  'approvals are audited with the HOD as actor');
select tests.pass('audit for Phase 3');

rollback;
