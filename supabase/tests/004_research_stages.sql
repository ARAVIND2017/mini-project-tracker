-- Phase 4: research stages S1–S5, reviews, corrections, evidence, exceptions and
-- overrides. Test IDs refer to docs/TEST_PLAN.md. Fictional users and papers only.
begin;

create temporary table u (name text primary key, id uuid);
grant all on u to anon, authenticated;

insert into auth.users (email, raw_user_meta_data) values
  ('p4hod@example.test',   '{"full_name": "P4 HOD"}'),
  ('p4lead@example.test',  '{"full_name": "P4 Lead"}'),
  ('p4guide@example.test', '{"full_name": "P4 Guide"}'),
  ('p4fac@example.test',   '{"full_name": "P4 Unassigned Faculty"}'),
  ('p4studa@example.test', '{"full_name": "P4 Student A"}'),
  ('p4studb@example.test', '{"full_name": "P4 Student B"}');
insert into u select split_part(email, '@', 1), id from auth.users where email like 'p4%@example.test';
select app.bootstrap_hod('p4hod@example.test');

-- Semester (target paper year 2026, started this week), two students, a guide for A.
select tests.login_as((select id from u where name = 'p4hod'));
select public.app_create_semester('P4 Semester', '2026-27',
  jsonb_build_object('start_date', current_date - 2, 'target_paper_year', 2026)) as sem \gset
select public.app_set_lead(:'sem', (select id from u where name = 'p4lead'));
select public.app_set_membership(:'sem', (select id from u where name = 'p4guide'), 'faculty');
select public.app_set_membership(:'sem', (select id from u where name = 'p4fac'), 'faculty');
select public.app_upsert_domain(:'sem', 'Machine Learning') as dom \gset
select public.app_activate_semester(:'sem');
select public.app_import_roster(:'sem', $$[
  {"slot_no": 1, "full_name": "P4 Student A", "email": "p4studa@example.test", "domain_name": "Machine Learning"},
  {"slot_no": 2, "full_name": "P4 Student B", "email": "p4studb@example.test", "domain_name": "Machine Learning"}
]$$::jsonb, false);
select public.app_link_student((select id from public.students where semester_id = :'sem' and slot_no = 1),
  (select id from u where name = 'p4studa'));
select public.app_link_student((select id from public.students where semester_id = :'sem' and slot_no = 2),
  (select id from u where name = 'p4studb'));
select tests.reset();
select p.id as pa from public.projects p join public.students s on s.id = p.student_id
  where s.semester_id = :'sem' and s.slot_no = 1 \gset
select p.id as pb from public.projects p join public.students s on s.id = p.student_id
  where s.semester_id = :'sem' and s.slot_no = 2 \gset
select tests.login_as((select id from u where name = 'p4hod'));
select public.app_assign_guide(:'pa', (select id from u where name = 'p4guide'));
select public.app_assign_guide(:'pb', (select id from u where name = 'p4guide'));
select tests.reset();

-- =============================================================================
-- S1 Exploration
-- =============================================================================
select tests.login_as((select id from u where name = 'p4studa'));
select public.app_save_exploration(:'pa', '{"candidate_topics": ["Topic one"], "keywords": ["k1", "k2"],
  "sources": [], "proposed_problem": "short"}') as expl \gset
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'exploration'),
  'in_progress', 'the first save moves the stage to in progress');
select tests.assert_raises(format($$select public.app_submit_record('exploration', %L)$$, :'expl'),
  'VALIDATION: Complete these before submitting: Research keywords (at least 3); Sources searched; Proposed research problem (at least 50 characters)',
  'submission lists every missing field');
select tests.assert_raises(format($$select public.app_save_exploration(%L, '{"sources": [{"name": "Bad", "url": "javascript:alert(1)"}]}')$$, :'pa'),
  'VALIDATION: Each source link must be a link starting with https://', 'SEC-12 javascript: links are rejected');
select tests.assert_raises(format($$select public.app_save_exploration(%L, '{"sources": [{"name": "Plain", "url": "http://example.test"}]}')$$, :'pa'),
  'VALIDATION: Each source link must be a link starting with https://', 'SEC-12 http: links are rejected');
select tests.assert_raises(format($$select public.app_save_exploration(%L, '{"grade": "A"}')$$, :'pa'),
  'VALIDATION: Unknown field(s): grade', 'unknown fields are rejected');
select public.app_save_exploration(:'pa', jsonb_build_object(
  'candidate_topics', array['Topic one', ' ', 'Topic two'],
  'keywords', array['k1', 'k2', 'k3'],
  'sources', jsonb_build_array(jsonb_build_object('name', 'Digital library', 'url', 'https://library.example.test'),
                               jsonb_build_object('name', '', 'url', '')),
  'proposed_problem', repeat('A fictional research problem statement. ', 3)));
select tests.assert_eq((select cardinality(candidate_topics) from public.research_explorations where id = :'expl'), 2,
  'blank list entries are dropped');
select tests.assert_eq((select jsonb_array_length(sources) from public.research_explorations where id = :'expl'), 1,
  'blank source rows are dropped');
select public.app_submit_record('exploration', :'expl');
select tests.assert_raises(format($$select public.app_save_exploration(%L, '{"keywords": ["x"]}')$$, :'pa'),
  'INVALID_STATE: The exploration is locked while it is submitted or approved', 'WF-07 submitted records are locked');
select tests.reset();
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'exploration'),
  'awaiting_approval', 'submitting moves the stage to awaiting approval');

-- SEC-07: an unassigned faculty member may comment but not decide.
select tests.login_as((select id from u where name = 'p4fac'));
select public.app_record_review('exploration', :'expl', 'comment_only', null, 'A helpful remark');
select tests.assert_raises(format($$select public.app_record_review('exploration', %L, 'accepted')$$, :'expl'),
  'FORBIDDEN: Only a reviewer of this project can accept, request changes or reject', 'SEC-07 unassigned faculty cannot accept');
select tests.assert_raises(format($$select public.app_record_review('exploration', %L, 'comment_only', null, 'x', array['fix it'])$$, :'expl'),
  'VALIDATION: A comment cannot create corrections; record "changes requested" instead', 'comments create no corrections');
select tests.reset();
select tests.assert_eq((select status::text from public.research_explorations where id = :'expl'), 'submitted',
  'a comment changes no status');

-- Students cannot review.
select tests.login_as((select id from u where name = 'p4studa'));
select tests.assert_raises(format($$select public.app_record_review('exploration', %L, 'comment_only', null, 'self')$$, :'expl'),
  'FORBIDDEN: Only faculty can comment on a project', 'students cannot comment as reviewers');
select tests.reset();

-- WF-03: changes requested needs a correction.
select tests.login_as((select id from u where name = 'p4guide'));
select tests.assert_raises(format($$select public.app_record_review('exploration', %L, 'changes_requested', 'Needs work')$$, :'expl'),
  'VALIDATION: List at least one correction when requesting changes', 'WF-03 changes requested without a correction is rejected');
select tests.assert_raises(format($$select public.app_record_review('exploration', %L, 'rejected')$$, :'expl'),
  'VALIDATION: Give the reason for rejecting in the observations', 'a rejection needs a reason');
select public.app_record_review('exploration', :'expl', 'changes_requested', 'Narrow the scope',
  null, array['Add two more keywords', '  ']) as rev1 \gset
select tests.reset();
select tests.assert_eq((select count(*)::int from public.corrections where review_id = :'rev1'), 1, 'blank corrections are ignored');
select tests.assert_eq((select status::text from public.research_explorations where id = :'expl'), 'changes_requested',
  'the record returns to the student');
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'exploration'),
  'changes_requested', 'the stage shows changes requested');
select id as corr1 from public.corrections where review_id = :'rev1' \gset

-- WF-04: correction transitions.
select tests.login_as((select id from u where name = 'p4studa'));
select tests.assert_raises(format($$select public.app_submit_record('exploration', %L)$$, :'expl'),
  'GATE_NOT_MET: Address the 1 open correction(s) before submitting again', 'open corrections block resubmission');
select tests.assert_raises(format($$select public.app_resolve_correction(%L, 'verify')$$, :'corr1'),
  'FORBIDDEN: Only a reviewer of this project can resolve corrections', 'students cannot verify corrections');
select tests.assert_raises(format($$select public.app_address_correction(%L, 'short')$$, :'corr1'),
  'VALIDATION: Your response needs at least 10 characters', 'a response is required');
select public.app_save_exploration(:'pa', jsonb_build_object(
  'candidate_topics', array['Topic one'], 'keywords', array['k1', 'k2', 'k3', 'k4', 'k5'],
  'sources', jsonb_build_array(jsonb_build_object('name', 'Digital library', 'url', 'https://library.example.test')),
  'proposed_problem', repeat('A fictional research problem statement. ', 3)));
select public.app_address_correction(:'corr1', 'Added two keywords as requested.');
select tests.assert_raises(format($$select public.app_address_correction(%L, 'Again, the same response')$$, :'corr1'),
  'INVALID_STATE: Only an open correction can be marked as addressed', 'WF-04 addressed cannot be addressed again');
select public.app_submit_record('exploration', :'expl');
select tests.reset();

select tests.login_as((select id from u where name = 'p4guide'));
select tests.assert_raises(format($$select public.app_record_review('exploration', %L, 'accepted')$$, :'expl'),
  'GATE_NOT_MET: Verify or waive the 1 outstanding correction(s) before accepting', 'corrections must be resolved before accepting');
select tests.assert_raises(format($$select public.app_resolve_correction(%L, 'reopen')$$, :'corr1'),
  'VALIDATION: A note needs at least 5 characters', 'reopening needs a note');
select public.app_resolve_correction(:'corr1', 'reopen', 'Keyword 5 is not relevant');
select tests.assert_raises(format($$select public.app_resolve_correction(%L, 'verify')$$, :'corr1'),
  'INVALID_STATE: A correction that is open cannot be verified', 'WF-04 open cannot be verified');
select public.app_resolve_correction(:'corr1', 'waive', 'Accepted after discussion in the lab');
select tests.assert_raises(format($$select public.app_resolve_correction(%L, 'waive', 'again please')$$, :'corr1'),
  'INVALID_STATE: A correction that is waived cannot be waived', 'WF-04 waived is final');
select tests.assert_raises(format($$select public.app_resolve_correction(%L, 'delete', 'x')$$, :'corr1'),
  'VALIDATION: The action must be verify, reopen or waive', 'unknown actions are rejected');
select public.app_record_review('exploration', :'expl', 'accepted', 'Good exploration');
select tests.reset();
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'exploration'),
  'approved', 'S1 approved');
select tests.assert_eq((select approved_by from public.project_stages where project_id = :'pa' and stage_key = 'exploration'),
  (select id from u where name = 'p4guide'), 'the approver is recorded');
select tests.pass('S1 exploration / SEC-07 / SEC-12 / WF-03 / WF-04 / WF-07');

-- =============================================================================
-- S2 Papers, duplicate check (DATA-06), paper change cutoff (WF-08)
-- =============================================================================
select tests.login_as((select id from u where name = 'p4studa'));
select public.app_save_paper(:'pa', '{"title": "A Fictional Study of Test Data", "authors": ["Author One"], "pub_year": 2024,
  "venue": "Fictional Conference", "doi": "https://doi.org/10.5555/fict.0001", "pdf_drive_url": "https://drive.example.test/a.pdf",
  "abstract": "Fictional abstract.", "research_problem": "Fictional problem.",
  "relevance_note": "This fictional paper is relevant to the machine learning domain because of its test data.",
  "code_availability": "available"}') as paper_a \gset
select tests.assert_eq((select doi::text from public.papers where id = :'paper_a'), '10.5555/fict.0001', 'DOI links are stored as bare DOIs');
select tests.assert_raises(format($$select public.app_save_paper(%L, '{"title": "X", "doi": "not-a-doi"}')$$, :'pa'),
  'VALIDATION: DOI must look like 10.1234/abcd', 'invalid DOIs are rejected');
select tests.assert_raises(format($$select public.app_save_paper(%L, '{"title": "X", "pdf_drive_url": "data:text/html,hi"}')$$, :'pa'),
  'VALIDATION: PDF Drive link must be a link starting with https://', 'SEC-12 data: links are rejected');
select tests.assert_raises(format($$select public.app_submit_record('paper', %L)$$, :'paper_a'),
  'INVALID_STATE: Select the paper before submitting it', 'only the selected paper is submitted');
select public.app_select_paper(:'paper_a');
select tests.assert_raises(format($$select public.app_submit_record('paper', %L)$$, :'paper_a'),
  'VALIDATION: Complete these before submitting: Foundational justification (the paper is not from 2026)',
  'a paper outside the target year needs a foundational justification');
select public.app_save_paper(:'pa', '{"title": "A Fictional Study of Test Data", "authors": ["Author One"], "pub_year": 2024,
  "venue": "Fictional Conference", "doi": "10.5555/fict.0001", "pdf_drive_url": "https://drive.example.test/a.pdf",
  "abstract": "Fictional abstract.", "research_problem": "Fictional problem.",
  "relevance_note": "This fictional paper is relevant to the machine learning domain because of its test data.",
  "code_availability": "available",
  "foundational_justification": "It introduced the fictional method that later work builds on."}', :'paper_a');
select public.app_submit_record('paper', :'paper_a');
select tests.assert_raises(format($$select public.app_save_paper(%L, '{"title": "Changed"}', %L)$$, :'pa', :'paper_a'),
  'INVALID_STATE: Only a candidate paper can be edited; this one is locked', 'WF-07 a submitted paper is locked');
select tests.reset();

select tests.login_as((select id from u where name = 'p4guide'));
select public.app_record_review('paper', :'paper_a', 'accepted', 'Suitable paper');
select tests.reset();
select tests.assert_eq((select status::text from public.papers where id = :'paper_a'), 'approved', 'paper approved');
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'paper_selection'),
  'approved', 'S2 approved');

-- Student B picks the same paper with a differently written title: blocked as duplicate.
select tests.login_as((select id from u where name = 'p4studb'));
select public.app_save_exploration(:'pb', jsonb_build_object('candidate_topics', array['T'], 'keywords', array['a', 'b', 'c'],
  'sources', jsonb_build_array(jsonb_build_object('name', 'Library', 'url', 'https://library.example.test')),
  'proposed_problem', repeat('Another fictional research problem. ', 3))) as expl_b \gset
select public.app_submit_record('exploration', :'expl_b');
select public.app_save_paper(:'pb', '{"title": "a fictional study of TEST data!", "authors": ["Author One"], "pub_year": 2026,
  "venue": "Fictional Conference", "url": "https://publisher.example.test/p", "pdf_drive_url": "https://drive.example.test/b.pdf",
  "abstract": "Fictional abstract.", "research_problem": "Fictional problem.",
  "relevance_note": "This fictional paper is relevant to the machine learning domain because of its test data."}') as paper_b \gset
select public.app_select_paper(:'paper_b');
select public.app_submit_record('paper', :'paper_b');
select tests.reset();

select tests.login_as((select id from u where name = 'p4guide'));
select public.app_record_review('exploration', :'expl_b', 'accepted', 'Fine');
select tests.assert_raises(format($$select public.app_record_review('paper', %L, 'accepted', 'ok')$$, :'paper_b'),
  'DUPLICATE_PAPER: Another project in this semester already has this paper approved (same DOI or title). The HOD can override this with a reason',
  'DATA-06 a duplicate normalized title is rejected');
select tests.assert_raises(format($$select public.app_override(%L, 'duplicate_paper', 'Different dataset')$$, :'pb'),
  'FORBIDDEN: Only the HOD can override a rule', 'only the HOD overrides');
select tests.reset();
select tests.login_as((select id from u where name = 'p4hod'));
select tests.assert_raises(format($$select public.app_override(%L, 'duplicate_paper', 'short')$$, :'pb'),
  'VALIDATION: The reason needs at least 10 characters', 'an override needs a reason');
select public.app_override(:'pb', 'duplicate_paper', 'Same paper, but a different dataset and objective');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select public.app_record_review('paper', :'paper_b', 'accepted', 'Approved after the HOD override');
select tests.reset();
select tests.assert_eq((select status::text from public.papers where id = :'paper_b'), 'approved', 'DATA-06 succeeds with an HOD override');
select tests.assert_eq((select count(*)::int from public.audit_log where action = 'override.duplicate_paper'
  and project_id = :'pb' and new_data ->> 'reason' = 'Same paper, but a different dataset and objective'), 1,
  'DATA-06 the override reason is logged');

-- Rejected paper: deselected; the student chooses another.
select tests.login_as((select id from u where name = 'p4studa'));
select public.app_save_paper(:'pa', '{"title": "Second fictional candidate"}') as paper_a2 \gset
select tests.assert_raises(format($$select public.app_select_paper(%L)$$, :'paper_a2'),
  'INVALID_STATE: A paper is already approved. Ask your guide to withdraw it before choosing another', 'an approved paper must be withdrawn first');
select tests.reset();

-- WF-08: after the cutoff week only the HOD may withdraw an approved paper.
update public.semesters set start_date = current_date - 70 where id = :'sem';
select tests.login_as((select id from u where name = 'p4guide'));
select tests.assert_raises(format($$select public.app_withdraw_paper(%L, 'Changing direction now')$$, :'paper_a'),
  'FORBIDDEN: After week 4 only the HOD can change an approved paper', 'WF-08 paper change after the cutoff is rejected');
select tests.reset();
update public.semesters set start_date = current_date - 2 where id = :'sem';
select tests.login_as((select id from u where name = 'p4fac'));
select tests.assert_raises(format($$select public.app_withdraw_paper(%L, 'Changing direction now')$$, :'paper_a'),
  'FORBIDDEN: Only a reviewer of this project can withdraw an approved paper', 'unassigned faculty cannot withdraw');
select tests.reset();
select tests.pass('S2 papers / DATA-06 / WF-08');

-- =============================================================================
-- S3 Analysis: changes requested → resubmitted → approved; versions (WF-07)
-- =============================================================================
select tests.login_as((select id from u where name = 'p4studa'));
select public.app_save_analysis(:'paper_a', jsonb_build_object(
  'problem_addressed', 'P', 'research_objectives', 'O', 'methodology', 'M', 'datasets', 'D', 'tools', 'T',
  'algorithms', 'A', 'reported_results', 'R', 'limitations', 'L', 'research_gaps', 'G',
  'own_understanding', 'Too short')) as an1 \gset
select tests.assert_raises(format($$select public.app_submit_record('paper_analysis', %L)$$, :'an1'),
  'VALIDATION: Complete these before submitting: Own understanding (at least 150 characters)', 'own understanding needs 150 characters');
select public.app_save_analysis(:'paper_a', jsonb_build_object(
  'problem_addressed', 'P', 'research_objectives', 'O', 'methodology', 'M', 'datasets', 'D', 'tools', 'T',
  'algorithms', 'A', 'reported_results', 'R', 'limitations', 'L', 'research_gaps', 'G',
  'own_understanding', repeat('My own fictional understanding. ', 6)));
select public.app_submit_record('paper_analysis', :'an1');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select public.app_record_review('paper_analysis', :'an1', 'changes_requested', 'Expand methodology', null,
  array['Describe the training procedure']) as rev_an \gset
select tests.reset();
select id as corr_an from public.corrections where review_id = :'rev_an' \gset
select tests.login_as((select id from u where name = 'p4studa'));
select public.app_save_analysis(:'paper_a', jsonb_build_object(
  'problem_addressed', 'P', 'research_objectives', 'O', 'methodology', 'M with the training procedure', 'datasets', 'D',
  'tools', 'T', 'algorithms', 'A', 'reported_results', 'R', 'limitations', 'L', 'research_gaps', 'G',
  'own_understanding', repeat('My own fictional understanding. ', 6)));
select public.app_address_correction(:'corr_an', 'Training procedure described in methodology.');
select public.app_submit_record('paper_analysis', :'an1');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select public.app_resolve_correction(:'corr_an', 'verify');
select public.app_record_review('paper_analysis', :'an1', 'accepted', 'Clear analysis');
select tests.reset();
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'paper_analysis'),
  'approved', 'S3 approved');
select tests.assert_eq((select status::text from public.corrections where id = :'corr_an'), 'verified', 'correction verified');

select tests.login_as((select id from u where name = 'p4studa'));
select tests.assert_raises(format($$select public.app_save_analysis(%L, '{"methodology": "new"}')$$, :'paper_a'),
  'INVALID_STATE: This analysis is approved. Start a new version to change it', 'WF-07 approved records are locked');
select public.app_new_analysis_version(:'paper_a') as an2 \gset
select tests.assert_eq((select version from public.paper_analyses where id = :'an2'), 2, 'WF-07 a new version can be created');
select tests.assert_eq((select methodology from public.paper_analyses where id = :'an2'), 'M with the training procedure',
  'the new version starts from the approved one');
select tests.assert_raises(format($$select public.app_new_analysis_version(%L)$$, :'paper_a'),
  'INVALID_STATE: A new version can be started only from the approved analysis', 'only one open version at a time');
select public.app_submit_record('paper_analysis', :'an2');
select tests.reset();
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'paper_analysis'),
  'approved', 'the approved version stays in force while a new one is reviewed');
select tests.login_as((select id from u where name = 'p4guide'));
select public.app_record_review('paper_analysis', :'an2', 'accepted', 'Version 2 is fine');
select tests.reset();
select tests.assert_eq((select status::text from public.paper_analyses where id = :'an1'), 'superseded', 'the old version is superseded');
select tests.assert_eq((select status::text from public.paper_analyses where id = :'an2'), 'approved', 'the new version is approved');
select tests.pass('S3 analysis versions / WF-07');

-- =============================================================================
-- S4 Repository and execution (WF-01), exception
-- =============================================================================
select tests.login_as((select id from u where name = 'p4studa'));
select public.app_save_repository(:'pa', '{"repo_url": "https://code.example.test/fictional/repo", "owner": "fictional",
  "name": "repo", "language": "Python", "framework": "PyTorch", "dataset_requirements": "Fictional dataset",
  "environment": "Python 3.12", "setup_instructions": "pip install -r requirements.txt"}') as repo \gset
select tests.assert_eq((select status::text from public.code_repositories where id = :'repo'), 'repository_identified',
  'a recorded repository is identified');
select tests.assert_raises(format($$select public.app_record_execution_attempt(%L, now(), 'failed', 'oops')$$, :'repo'),
  'VALIDATION: Errors encountered needs at least 10 characters', 'a failed attempt needs the errors');
select public.app_record_execution_attempt(:'repo', now() - interval '1 day', 'failed',
  'ImportError: fictional module missing', 'Installed the missing module');
select tests.assert_eq((select status::text from public.code_repositories where id = :'repo'), 'execution_failed', 'failed attempt');
select tests.assert_raises(format($$select public.app_submit_record('repository', %L)$$, :'repo'),
  'GATE_NOT_MET: Record a successful execution attempt with evidence before asking for verification',
  'WF-01 no verification without a successful attempt');
select public.app_record_execution_attempt(:'repo', now(), 'success', null, null, 'Ran without evidence');
select tests.assert_raises(format($$select public.app_submit_record('repository', %L)$$, :'repo'),
  'GATE_NOT_MET: Record a successful execution attempt with evidence before asking for verification',
  'WF-01 a successful attempt also needs evidence');
select tests.assert_raises(format($$select public.app_record_execution_attempt(%L, now(), 'success', null, null, null,
  '[{"category": "execution_log", "url": "http://drive.example.test/log", "description": "Run log of the original code"}]')$$, :'repo'),
  'VALIDATION: Each evidence link must be a link starting with https://', 'SEC-12 evidence links must be https');
select public.app_record_execution_attempt(:'repo', now(), 'success', null, null, null,
  '[{"category": "execution_log", "url": "https://drive.example.test/log", "description": "Run log of the original code"}]') as att \gset
select tests.reset();

-- WF-01: only a reviewer can verify.
select tests.login_as((select id from u where name = 'p4studa'));
select public.app_submit_record('repository', :'repo');
select tests.assert_raises(format($$select public.app_record_execution_attempt(%L, now(), 'success')$$, :'repo'),
  'INVALID_STATE: The repository is locked while it is waiting for verification or verified', 'no attempts while pending verification');
select tests.assert_raises(format($$select public.app_record_review('repository', %L, 'accepted')$$, :'repo'),
  'FORBIDDEN: Only a reviewer of this project can accept, request changes or reject', 'WF-01 the student cannot verify');
select tests.reset();
select tests.login_as((select id from u where name = 'p4fac'));
select tests.assert_raises(format($$select public.app_record_review('repository', %L, 'accepted')$$, :'repo'),
  'FORBIDDEN: Only a reviewer of this project can accept, request changes or reject', 'WF-01 unassigned faculty cannot verify');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select public.app_record_review('repository', :'repo', 'changes_requested', 'Log is incomplete', null, array['Attach the full run log']) as rev_repo \gset
select tests.reset();
select tests.assert_eq((select status::text from public.code_repositories where id = :'repo'), 'environment_setup',
  'changes requested returns the repository to environment setup');
select id as corr_repo from public.corrections where review_id = :'rev_repo' \gset
select tests.login_as((select id from u where name = 'p4studa'));
select public.app_record_execution_attempt(:'repo', now(), 'success', null, null, null,
  '[{"category": "execution_log", "url": "https://drive.example.test/full-log", "description": "Full run log of the original code"}]');
select public.app_address_correction(:'corr_repo', 'Full log attached to the new attempt.');
select public.app_submit_record('repository', :'repo');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select public.app_resolve_correction(:'corr_repo', 'verify');
select public.app_record_review('repository', :'repo', 'accepted', 'Execution verified');
select tests.reset();
select tests.assert_eq((select status::text from public.code_repositories where id = :'repo'), 'verified', 'WF-01 verified by a reviewer');
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'code_execution'),
  'approved', 'S4 approved');

-- Exception path on project B (S2 approved after override).
select tests.login_as((select id from u where name = 'p4fac'));
select tests.assert_raises(format($$select public.app_approve_stage_exception(%L, 'code_execution', 'The paper has no public code at all')$$, :'pb'),
  'FORBIDDEN: Only the guide, the lead faculty or the HOD can approve an exception', 'unassigned faculty cannot approve exceptions');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select tests.assert_raises(format($$select public.app_approve_stage_exception(%L, 'paper_analysis', 'The paper has no public code at all')$$, :'pb'),
  'VALIDATION: Only stage S4 (original code execution) can have an exception', 'only S4 has exceptions');
select tests.assert_raises(format($$select public.app_approve_stage_exception(%L, 'code_execution', 'no code')$$, :'pb'),
  'VALIDATION: The reason needs at least 20 characters', 'an exception needs a reason');
select public.app_approve_stage_exception(:'pb', 'code_execution', 'The paper has no public code; reimplement it in S6');
select tests.reset();
select tests.assert_eq((select status::text || '|' || exception_reason from public.project_stages where project_id = :'pb' and stage_key = 'code_execution'),
  'exception_approved|The paper has no public code; reimplement it in S6', 'S4 exception approved with the reason');
select tests.login_as((select id from u where name = 'p4studb'));
select tests.assert_raises(format($$select public.app_save_repository(%L, '{"repo_url": "https://code.example.test/x"}')$$, :'pb'),
  'INVALID_STATE: Stage S4 is already complete', 'no repository work after an exception');
select tests.reset();
select tests.pass('S4 repository / WF-01 / exception');

-- =============================================================================
-- S5 Objectives: v1 changes requested → v2 approved; gates
-- =============================================================================
select tests.login_as((select id from u where name = 'p4studb'));
select public.app_save_objective(:'pb', jsonb_build_object('original_limitations', 'L', 'research_gap', 'G',
  'problem_statement', 'P', 'main_objective', 'M', 'specific_objectives', array['O1', 'O2'], 'contribution', 'C',
  'scope', 'S', 'exclusions', 'E', 'evaluation_criteria', array['Accuracy'])) as obj_b \gset
select public.app_submit_record('objective', :'obj_b');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select tests.assert_raises(format($$select public.app_record_review('objective', %L, 'accepted', 'ok')$$, :'obj_b'),
  'GATE_NOT_MET: S3 Paper analysis must be approved before S5 Research gap and objectives',
  'objectives cannot be approved before the analysis');
select tests.reset();

select tests.login_as((select id from u where name = 'p4studa'));
select public.app_save_objective(:'pa', jsonb_build_object('original_limitations', 'L', 'research_gap', 'G',
  'problem_statement', 'P', 'main_objective', 'M', 'specific_objectives', array['Only one'], 'contribution', 'C',
  'scope', 'S', 'exclusions', 'E', 'evaluation_criteria', array['Accuracy'])) as obj1 \gset
select tests.assert_raises(format($$select public.app_submit_record('objective', %L)$$, :'obj1'),
  'VALIDATION: Complete these before submitting: Specific objectives (at least 2)', 'at least two specific objectives');
select public.app_save_objective(:'pa', jsonb_build_object('original_limitations', 'L', 'research_gap', 'G',
  'problem_statement', 'P', 'main_objective', 'M', 'specific_objectives', array['O1', 'O2'], 'contribution', 'C',
  'scope', 'S', 'exclusions', 'E', 'evaluation_criteria', array['Accuracy']));
select public.app_submit_record('objective', :'obj1');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select public.app_record_review('objective', :'obj1', 'changes_requested', 'Sharpen the objectives', null,
  array['Make objective 2 measurable']) as rev_obj \gset
select tests.reset();
select id as corr_obj from public.corrections where review_id = :'rev_obj' \gset
select tests.login_as((select id from u where name = 'p4studa'));
select public.app_address_correction(:'corr_obj', 'Objective 2 now has a measurable target.');
select public.app_save_objective(:'pa', jsonb_build_object('original_limitations', 'L', 'research_gap', 'G',
  'problem_statement', 'P', 'main_objective', 'M', 'specific_objectives', array['O1', 'O2 measured by accuracy'],
  'contribution', 'C', 'scope', 'S', 'exclusions', 'E', 'evaluation_criteria', array['Accuracy']));
select public.app_submit_record('objective', :'obj1');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select public.app_resolve_correction(:'corr_obj', 'verify');
select public.app_record_review('objective', :'obj1', 'accepted', 'Objectives approved');
select tests.reset();
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'objectives'),
  'approved', 'S5 approved');
select tests.login_as((select id from u where name = 'p4studa'));
select tests.assert_raises(format($$select public.app_set_project_title(%L, 'New title')$$, :'pa'),
  'INVALID_STATE: The title is fixed once objectives are approved; ask the HOD to change it', 'the title locks after S5');
select public.app_new_objective_version(:'pa') as obj2 \gset
select public.app_submit_record('objective', :'obj2');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select public.app_record_review('objective', :'obj2', 'accepted', 'Version 2 approved');
select tests.reset();
select tests.assert_eq((select string_agg(version || ':' || status, ',' order by version) from public.objective_versions
  where project_id = :'pa'), '1:superseded,2:approved', 'one approved version; the earlier one superseded');
select tests.pass('S5 objectives / gates');

-- =============================================================================
-- Evidence verification
-- =============================================================================
select tests.login_as((select id from u where name = 'p4studa'));
select public.app_add_evidence(:'pa', 'paper_selection', 'research_paper_pdf', 'https://drive.example.test/a.pdf',
  'PDF of the selected paper') as ev \gset
select tests.assert_raises(format($$select public.app_add_evidence(%L, 'paper_selection', 'other', 'javascript:alert(1)', 'A bad link here')$$, :'pa'),
  'VALIDATION: The evidence link must be a link starting with https://', 'SEC-12 evidence links');
select tests.assert_raises(format($$select public.app_verify_evidence(%L, 'verified')$$, :'ev'),
  'FORBIDDEN: Only a reviewer of this project can verify evidence', 'students cannot verify evidence');
select tests.reset();
select tests.login_as((select id from u where name = 'p4guide'));
select tests.assert_raises(format($$select public.app_verify_evidence(%L, 'inaccessible')$$, :'ev'),
  'VALIDATION: A note needs at least 5 characters', 'rejecting evidence needs a note');
select public.app_verify_evidence(:'ev', 'verified');
select tests.reset();
select tests.assert_eq((select verification::text from public.evidence where id = :'ev'), 'verified', 'evidence verified');
select tests.pass('evidence verification');

-- =============================================================================
-- SEC-08 / SEC-09: isolation and protected data
-- =============================================================================
select tests.login_as((select id from u where name = 'p4studb'));
select tests.assert_eq((select count(*)::int from public.papers where project_id = :'pa'), 0, 'SEC-08 B sees none of A''s papers');
select tests.assert_eq((select count(*)::int from public.research_explorations where project_id = :'pa'), 0, 'SEC-08 explorations');
select tests.assert_eq((select count(*)::int from public.paper_analyses where project_id = :'pa'), 0, 'SEC-08 analyses');
select tests.assert_eq((select count(*)::int from public.code_repositories where project_id = :'pa'), 0, 'SEC-08 repositories');
select tests.assert_eq((select count(*)::int from public.execution_attempts where project_id = :'pa'), 0, 'SEC-08 attempts');
select tests.assert_eq((select count(*)::int from public.objective_versions where project_id = :'pa'), 0, 'SEC-08 objectives');
select tests.assert_eq((select count(*)::int from public.evidence where project_id = :'pa'), 0, 'SEC-08 evidence');
select tests.assert_eq((select count(*)::int from public.reviews where project_id = :'pa'), 0, 'SEC-08 reviews');
select tests.assert_eq((select count(*)::int from public.corrections where project_id = :'pa'), 0, 'SEC-08 corrections');
select tests.assert_eq((select count(*)::int from public.papers where project_id = :'pb'), 1, 'B sees their own paper');
select tests.assert_raises(format($$select public.app_save_exploration(%L, '{}')$$, :'pa'),
  'NOT_FOUND: Project not found', 'SEC-08 B cannot write to A''s project (and learns nothing)');
select tests.assert_raises(format($$select public.app_save_analysis(%L, '{}')$$, :'paper_a'),
  'NOT_FOUND: Paper not found', 'SEC-08 B cannot reach A''s paper');
select tests.assert_raises(format($$select public.app_address_correction(%L, 'Not my correction at all')$$, :'corr_obj'),
  'NOT_FOUND: Correction not found', 'SEC-08 B cannot reach A''s corrections');
-- SEC-09: no direct writes at all, so protected columns cannot be touched.
select tests.assert_raises(format($$update public.papers set status = 'approved' where id = %L$$, :'paper_b'),
  'permission denied%', 'SEC-09 paper status cannot be written directly');
select tests.assert_raises(format($$update public.code_repositories set status = 'verified' where project_id = %L$$, :'pb'),
  'permission denied%', 'SEC-09 execution status cannot be written directly');
select tests.assert_raises(format($$update public.evidence set verification = 'verified' where project_id = %L$$, :'pb'),
  'permission denied%', 'SEC-09 evidence verification cannot be written directly');
select tests.assert_raises(format($$update public.project_stages set status = 'approved' where project_id = %L$$, :'pb'),
  'permission denied%', 'SEC-09 stage status cannot be written directly');
select tests.assert_raises(format($$insert into public.reviews (project_id, target_type, target_id, reviewer_id, outcome)
  values (%L, 'paper', %L, %L, 'accepted')$$, :'pb', :'paper_b', (select id from u where name = 'p4studb')),
  'permission denied%', 'SEC-09 reviews cannot be inserted directly');
select tests.reset();

-- Reviews and attempts are immutable even for the service role.
set local role service_role;
select tests.assert_raises(format($$update public.reviews set outcome = 'rejected' where id = %L$$, :'rev1'),
  '%', 'reviews cannot be changed');
reset role;
set local role service_role;
select tests.assert_raises(format($$update public.execution_attempts set outcome = 'failed' where id = %L$$, :'att'),
  '%', 'execution attempts cannot be changed');
reset role;
select tests.pass('SEC-08 / SEC-09 isolation and protected data');

-- =============================================================================
-- Withdrawal of an approved paper by the HOD after the cutoff reopens later stages
-- =============================================================================
update public.semesters set start_date = current_date - 70 where id = :'sem';
select tests.login_as((select id from u where name = 'p4hod'));
select public.app_withdraw_paper(:'paper_a', 'The HOD agreed to a change of paper');
select tests.reset();
select tests.assert_eq((select string_agg(stage_key || '=' || status, ',' order by stage_key) from public.project_stages
  where project_id = :'pa' and stage_key in ('paper_selection', 'paper_analysis', 'code_execution', 'objectives')),
  'paper_selection=in_progress,paper_analysis=in_progress,code_execution=in_progress,objectives=in_progress',
  'WF-08 the HOD may change the paper after the cutoff; later stages reopen');
select tests.assert_eq((select count(*)::int from public.paper_analyses where paper_id = :'paper_a' and status <> 'superseded'), 0,
  'analyses of the withdrawn paper are superseded');
select tests.assert_eq((select is_current from public.code_repositories where id = :'repo'), false, 'its repository is kept as history');
select tests.assert_eq((select count(*)::int from public.objective_versions where project_id = :'pa' and status = 'approved'), 0,
  'objectives built on it are superseded');
select tests.pass('paper withdrawal after the cutoff');

-- =============================================================================
-- Audit
-- =============================================================================
select tests.assert(
  (select count(*) from public.audit_log where action = 'review.recorded' and project_id = :'pa') >= 8,
  'every review is logged by name');
select tests.assert(
  (select count(*) from public.audit_log where table_name = 'papers' and action = 'UPDATE' and project_id = :'pa') > 0,
  'paper changes are in the row-level audit');
select tests.assert_eq(
  (select count(*)::int from public.audit_log where action = 'stage.exception_approved' and project_id = :'pb'), 1,
  'exceptions are logged');
select tests.pass('audit for Phase 4');

rollback;
