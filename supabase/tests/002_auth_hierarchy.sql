-- Phase 2: profiles, system roles, semesters, memberships, RLS and RPCs.
-- Test IDs refer to docs/TEST_PLAN.md. All people here are fictional test users.
begin;

create temporary table u (name text primary key, id uuid);
grant all on u to anon, authenticated;

insert into auth.users (email, raw_user_meta_data) values
  ('hod@example.test',      '{"full_name": "Test HOD"}'),
  ('lead@example.test',     '{"full_name": "Test Lead"}'),
  ('fac1@example.test',     '{"full_name": "Test Faculty One", "designation": "Asst. Prof."}'),
  ('fac2@example.test',     '{"full_name": "Test Faculty Two"}'),
  ('stud1@example.test',    '{"full_name": "Test Student 01"}'),
  ('stud2@example.test',    '{"full_name": "Test Student 02"}'),
  ('admin@example.test',    '{"full_name": "Test Admin"}'),
  ('cfgadmin@example.test', '{"full_name": "Test Config Admin"}'),
  ('outsider@example.test', '{}');
insert into u select split_part(email, '@', 1), id from auth.users where email like '%@example.test';

-- Profiles are created from auth users -------------------------------------------
select tests.assert_eq((select full_name from public.profiles where id = (select id from u where name = 'fac1')),
  'Test Faculty One', 'profile takes full_name from invite metadata');
select tests.assert_eq((select designation from public.profiles where id = (select id from u where name = 'fac1')),
  'Asst. Prof.', 'profile takes designation from invite metadata');
select tests.assert_eq((select full_name from public.profiles where id = (select id from u where name = 'outsider')),
  'outsider', 'profile falls back to the email name');
select tests.pass('profiles created on sign-up/invite');

-- Bootstrap HOD (SQL editor only) -------------------------------------------------
select app.bootstrap_hod('HOD@example.test');
select tests.assert_raises($$select app.bootstrap_hod('lead@example.test')$$,
  '%An HOD already exists%', 'bootstrap works only once');
select tests.login_as((select id from u where name = 'outsider'));
select tests.assert_raises($$select app.bootstrap_hod('outsider@example.test')$$,
  'permission denied%', 'API roles cannot bootstrap an HOD');
select tests.reset();
select tests.pass('bootstrap_hod');

-- SEC-10: anon has no access --------------------------------------------------------
select tests.login_anon();
select tests.assert_raises($$select * from public.semesters$$, 'permission denied%', 'anon cannot read semesters');
select tests.assert_raises($$select * from public.profiles$$, 'permission denied%', 'anon cannot read profiles');
select tests.assert_raises($$select public.app_my_context()$$, 'permission denied%', 'anon cannot call RPCs');
select tests.reset();
select tests.pass('SEC-10 anon has no access');

-- System roles ----------------------------------------------------------------------
select tests.login_as((select id from u where name = 'hod'));
select public.app_grant_system_role((select id from u where name = 'admin'), 'admin', array['manage_users']);
select public.app_grant_system_role((select id from u where name = 'cfgadmin'), 'admin', array['manage_config']);
select tests.assert_raises(
  format($$select public.app_grant_system_role(%L, 'admin', array['launch_rockets'])$$, (select id from u where name = 'fac2')),
  'VALIDATION: Unknown administrator permission', 'unknown admin permissions are rejected');
select tests.assert_raises(
  format($$select public.app_revoke_system_role(%L, 'hod')$$, (select id from u where name = 'hod')),
  'INVALID_STATE: The last active HOD cannot be removed', 'the last HOD cannot be revoked');
select tests.assert_eq((public.app_my_context() -> 'system_roles' -> 0 ->> 'role'), 'hod', 'context lists the HOD role');
select tests.reset();

select tests.login_as((select id from u where name = 'admin'));
select tests.assert_raises(
  format($$select public.app_grant_system_role(%L, 'admin', '{}')$$, (select id from u where name = 'fac2')),
  'FORBIDDEN: Only the HOD can grant system roles', 'admins cannot grant system roles');
select tests.reset();
select tests.pass('system roles');

-- SEC-01: semester creation --------------------------------------------------------------
select tests.login_as((select id from u where name = 'hod'));
select public.app_create_semester('Odd Semester 2026-27', '2026-27', '{"max_students": 30}') as sem \gset
insert into u values ('sem', :'sem');
select tests.assert_eq((select max_students from public.semesters where id = :'sem'), 30, 'settings applied on create');
select tests.assert_eq((select status::text from public.semesters where id = :'sem'), 'draft', 'new semesters are drafts');
select tests.assert_eq((select timezone from public.semesters where id = :'sem'), 'Asia/Kolkata', 'default timezone');
select tests.reset();

select tests.login_as((select id from u where name = 'cfgadmin'));
select tests.assert(public.app_create_semester('Config admin semester') is not null,
  'admin with manage_config can create a semester');
select tests.reset();

select tests.login_as((select id from u where name = 'admin'));
select tests.assert_raises($$select public.app_create_semester('Nope')$$,
  'FORBIDDEN: Only the HOD can create a semester', 'admin without manage_config cannot create a semester');
select tests.reset();

select tests.login_as((select id from u where name = 'fac1'));
select tests.assert_raises($$select public.app_create_semester('Nope')$$,
  'FORBIDDEN: Only the HOD can create a semester', 'faculty cannot create a semester');
select tests.assert_raises($$insert into public.semesters (name) values ('direct')$$,
  'permission denied%', 'semesters cannot be inserted directly');
select tests.reset();
select tests.pass('SEC-01 semester creation');

-- Settings validation (DATA-10 and friends) ---------------------------------------------------
select tests.login_as((select id from u where name = 'hod'));
select tests.assert_raises(format($$select public.app_update_semester(%L, '{"timezone": "Mars/Olympus"}')$$, :'sem'),
  'VALIDATION: Unknown timezone%', 'invalid timezone rejected');
select tests.assert_raises(format($$select public.app_update_semester(%L, '{"stage_weights": {"exploration": 100}}')$$, :'sem'),
  'VALIDATION: Stage weights must list each of the nine stages%', 'weights must cover all stages');
select tests.assert_raises(format($$select public.app_update_semester(%L, %L)$$, :'sem',
  '{"stage_weights": {"exploration": 5, "paper_selection": 10, "paper_analysis": 10, "code_execution": 15, "objectives": 10, "implementation": 20, "evaluation": 10, "paper_writing": 10, "final": 11}}'),
  'VALIDATION: Stage weights must total 100 (currently 101)', 'DATA-10 weights must total 100');
select tests.assert_raises(format($$select public.app_update_semester(%L, '{"colour": "blue"}')$$, :'sem'),
  'VALIDATION: Unknown setting(s): colour', 'unknown settings rejected');
select tests.assert_raises(format($$select public.app_update_semester(%L, '{"week_count": 3}')$$, :'sem'),
  'VALIDATION: A semester setting is out of range', 'paper-change cutoff must fall within the weeks');
select tests.assert_raises(format($$select public.app_update_semester(%L, '{"start_date": "not-a-date"}')$$, :'sem'),
  'VALIDATION: A semester setting has an invalid value', 'bad dates rejected');
select tests.assert_raises(format($$select public.app_update_semester(%L, '{"lab_start": "17:00"}')$$, :'sem'),
  'VALIDATION: A semester setting is out of range', 'lab must end after it starts');
select public.app_update_semester(:'sem', '{"lab_weekday": 2, "lab_start": "14:00", "lab_end": "16:40"}');
select tests.reset();
select tests.pass('semester settings validation');

-- SEC-02 / DATA-01: memberships and the lead ------------------------------------------------
select tests.login_as((select id from u where name = 'hod'));
select public.app_set_membership(:'sem', (select id from u where name = 'fac1'), 'faculty');
select public.app_set_lead(:'sem', (select id from u where name = 'lead'));
select public.app_set_membership(:'sem', (select id from u where name = 'stud1'), 'student');
select public.app_set_membership(:'sem', (select id from u where name = 'stud2'), 'student');
select tests.assert_eq(
  (select reports_to from public.memberships where semester_id = :'sem' and user_id = (select id from u where name = 'fac1')),
  (select id from public.memberships where semester_id = :'sem' and role = 'lead_faculty'),
  'faculty report to the lead');
select tests.assert_raises(format($$select public.app_set_membership(%L, %L, 'faculty')$$, :'sem', (select id from u where name = 'hod')),
  'VALIDATION: The HOD already has faculty-level access%', 'the HOD needs no membership');
select tests.reset();

-- Admin with manage_users may add new faculty, but not touch the hierarchy.
select tests.login_as((select id from u where name = 'admin'));
select public.app_set_membership(:'sem', (select id from u where name = 'fac2'), 'faculty');
select tests.assert_raises(format($$select public.app_set_lead(%L, %L)$$, :'sem', (select id from u where name = 'fac2')),
  'FORBIDDEN: Only the HOD can change roles or the hierarchy', 'admins cannot appoint the lead');
select tests.reset();

select tests.login_as((select id from u where name = 'lead'));
select tests.assert_raises(format($$select public.app_set_lead(%L, %L)$$, :'sem', (select id from u where name = 'fac1')),
  'FORBIDDEN: Only the HOD can change roles or the hierarchy', 'the lead cannot change the hierarchy');
select tests.assert_raises(format($$update public.memberships set role = 'lead_faculty' where user_id = %L$$, (select id from u where name = 'fac1')),
  'permission denied%', 'memberships cannot be updated directly');
select tests.reset();

select tests.login_as((select id from u where name = 'fac1'));
select tests.assert_raises(format($$select public.app_set_membership(%L, %L, 'faculty', false)$$, :'sem', (select id from u where name = 'fac2')),
  'FORBIDDEN: Only the HOD can change roles or the hierarchy', 'faculty cannot change memberships');
select tests.reset();

-- Appointing a new lead demotes the previous one (DATA-01).
select tests.login_as((select id from u where name = 'hod'));
select public.app_set_lead(:'sem', (select id from u where name = 'fac1'));
select tests.reset();
select tests.assert_eq((select count(*)::int from public.memberships where semester_id = :'sem' and role = 'lead_faculty' and is_active),
  1, 'DATA-01 exactly one active lead');
select tests.assert_eq((select role::text from public.memberships where semester_id = :'sem' and user_id = (select id from u where name = 'lead')),
  'faculty', 'previous lead becomes faculty');
select tests.assert_eq(
  (select count(*)::int from public.memberships where semester_id = :'sem' and role = 'faculty'
     and reports_to is distinct from (select id from public.memberships where semester_id = :'sem' and role = 'lead_faculty')),
  0, 'all faculty re-pointed to the new lead');
select tests.assert_raises(
  format($$insert into public.memberships (semester_id, user_id, role) values (%L, %L, 'lead_faculty')$$, :'sem', (select id from u where name = 'outsider')),
  'duplicate key value violates unique constraint "memberships_one_active_lead"', 'database index allows one active lead');
select tests.pass('SEC-02 / DATA-01 hierarchy');

-- Row-level visibility ------------------------------------------------------------------
select tests.login_as((select id from u where name = 'stud1'));
select tests.assert_eq((select count(*)::int from public.semesters where id = :'sem'), 1, 'students see their semester');
select tests.assert_eq((select count(*)::int from public.memberships where semester_id = :'sem' and role = 'student'), 1,
  'students see only their own student membership');
select tests.assert_eq((select count(*)::int from public.memberships where semester_id = :'sem' and role <> 'student'), 3,
  'students see the faculty of their semester');
select tests.assert_eq((select count(*)::int from public.profiles where id = (select id from u where name = 'stud2')), 0,
  'students cannot see other students');
select tests.assert_eq((select count(*)::int from public.profiles where id in (select id from u where name in ('fac1', 'hod'))), 2,
  'students can see their faculty and the HOD');
select tests.assert_eq((select count(*)::int from public.system_roles), 0, 'students see no system roles');
select tests.reset();

select tests.login_as((select id from u where name = 'fac2'));
select tests.assert_eq((select count(*)::int from public.memberships where semester_id = :'sem'), 5,
  'faculty see every membership of their semester');
select tests.assert_eq((select count(*)::int from public.profiles where id = (select id from u where name = 'stud2')), 1,
  'faculty see student profiles in their semester');
select tests.reset();

select tests.login_as((select id from u where name = 'outsider'));
select tests.assert_eq((select count(*)::int from public.semesters), 0, 'non-members see no semesters');
select tests.assert_eq((select count(*)::int from public.memberships), 0, 'non-members see no memberships');
select tests.assert_eq((select count(*)::int from public.profiles), 2, 'non-members see only themselves and the HOD');
select tests.assert_eq((public.app_my_context() ->> 'active'), 'true', 'context works for any active user');
select tests.reset();
select tests.pass('row-level visibility');

-- Profile self-service --------------------------------------------------------------------
select tests.login_as((select id from u where name = 'stud1'));
update public.profiles set full_name = 'Test Student 01 (edited)' where id = (select id from u where name = 'stud1');
select tests.assert_raises(format($$update public.profiles set is_active = false where id = %L$$, (select id from u where name = 'stud1')),
  'permission denied%', 'users cannot change their active flag');
update public.profiles set full_name = 'Hacked' where id = (select id from u where name = 'fac1');
select tests.reset();
select tests.assert_eq((select full_name from public.profiles where id = (select id from u where name = 'stud1')),
  'Test Student 01 (edited)', 'users can edit their own name');
select tests.assert_eq((select full_name from public.profiles where id = (select id from u where name = 'fac1')),
  'Test Faculty One', 'users cannot edit other profiles');
select tests.pass('profile self-service');

-- Activation gates and closed semesters ---------------------------------------------------------
select tests.login_as((select id from u where name = 'hod'));
select tests.assert_raises(format($$select public.app_activate_semester(%L)$$, :'sem'),
  'GATE_NOT_MET: Set the semester start date%', 'activation requires a start date');
select public.app_update_semester(:'sem', '{"start_date": "2027-01-05"}');
select public.app_activate_semester(:'sem');
select tests.assert_raises(format($$select public.app_activate_semester(%L)$$, :'sem'),
  'INVALID_STATE: Only a draft semester can be activated', 'cannot activate twice');
select public.app_create_semester('No lead yet', null, '{"start_date": "2027-01-05"}') as nolead \gset
select tests.assert_raises(format($$select public.app_activate_semester(%L)$$, :'nolead'),
  'GATE_NOT_MET: Appoint a lead faculty first', 'activation requires a lead');
select public.app_close_semester(:'sem');
select tests.assert_raises(format($$select public.app_update_semester(%L, '{"max_students": 25}')$$, :'sem'),
  'INVALID_STATE: A closed semester cannot be changed', 'closed semesters are read-only');
select tests.assert_raises(format($$select public.app_set_membership(%L, %L, 'faculty')$$, :'sem', (select id from u where name = 'outsider')),
  'INVALID_STATE: A closed semester cannot be changed', 'closed semesters keep their memberships');
select tests.reset();
select tests.pass('semester lifecycle');

-- SEC-04: deactivated accounts -----------------------------------------------------------------
select tests.login_as((select id from u where name = 'hod'));
select tests.assert_raises(format($$select public.app_set_user_active(%L, false, 'self')$$, (select id from u where name = 'hod')),
  'VALIDATION: You cannot deactivate your own account', 'cannot deactivate yourself');
select tests.assert_raises(format($$select public.app_set_user_active(%L, false, '')$$, (select id from u where name = 'fac2')),
  'VALIDATION: Give a reason%', 'a reason is required');
select public.app_set_user_active((select id from u where name = 'fac2'), false, 'Left the department');
select tests.reset();

select tests.login_as((select id from u where name = 'admin'));
select tests.assert_raises(format($$select public.app_set_user_active(%L, false, 'testing')$$, (select id from u where name = 'hod')),
  'FORBIDDEN: Only the HOD can change HOD or administrator accounts', 'admins cannot deactivate the HOD');
select tests.reset();

select tests.login_as((select id from u where name = 'fac2'));
select tests.assert_eq((select count(*)::int from public.semesters), 0, 'deactivated users see no semesters');
select tests.assert_eq((select count(*)::int from public.profiles), 0, 'deactivated users see no profiles');
select tests.assert_eq((public.app_my_context() ->> 'active'), 'false', 'context reports the account as inactive');
select tests.assert_raises($$select public.app_create_semester('x')$$,
  'FORBIDDEN: Sign in with an active account', 'deactivated users cannot call RPCs');
select tests.reset();
select tests.pass('SEC-04 deactivated accounts');

-- AUD-01 / audit visibility --------------------------------------------------------------------
select tests.assert(
  (select count(*) from public.audit_log where action = 'semester.created' and semester_id = :'sem'
     and actor_id = (select id from u where name = 'hod')) = 1,
  'named workflow events are audited with the actor');
select tests.assert(
  (select count(*) from public.audit_log where table_name = 'memberships' and action = 'UPDATE') >= 1,
  'row changes to memberships are audited');
select tests.login_as((select id from u where name = 'hod'));
select tests.assert((select count(*) from public.audit_log) > 0, 'the HOD can read the audit log');
select tests.reset();
select tests.login_as((select id from u where name = 'fac1'));
select tests.assert_eq((select count(*)::int from public.audit_log), 0, 'faculty cannot read the audit log');
select tests.reset();
select tests.pass('AUD-01 audit');

-- Soft revoke of system roles ----------------------------------------------------------------
select tests.login_as((select id from u where name = 'hod'));
select public.app_revoke_system_role((select id from u where name = 'cfgadmin'), 'admin');
select tests.assert_raises(format($$select public.app_revoke_system_role(%L, 'admin')$$, (select id from u where name = 'cfgadmin')),
  'NOT_FOUND: That user does not have this role', 'a revoked role cannot be revoked again');
select tests.reset();
select tests.assert_eq(
  (select count(*)::int from public.system_roles where user_id = (select id from u where name = 'cfgadmin') and revoked_at is not null and revoked_by = (select id from u where name = 'hod')),
  1, 'revoking keeps the row with who revoked it and when');
select tests.login_as((select id from u where name = 'cfgadmin'));
select tests.assert_raises($$select public.app_create_semester('After revoke')$$,
  'FORBIDDEN: Only the HOD can create a semester', 'a revoked admin loses its permissions');
select tests.assert_eq(jsonb_array_length(public.app_my_context() -> 'system_roles'), 0, 'context omits revoked roles');
select tests.reset();
select tests.login_as((select id from u where name = 'hod'));
select public.app_grant_system_role((select id from u where name = 'cfgadmin'), 'admin', array['manage_config']);
select tests.reset();
select tests.login_as((select id from u where name = 'cfgadmin'));
select tests.assert(public.app_create_semester('After regrant') is not null, 're-granting restores the role');
select tests.reset();
select tests.pass('soft revoke of system roles');

rollback;
