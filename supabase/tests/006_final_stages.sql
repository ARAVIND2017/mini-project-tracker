-- Phase 6: S6 implementation items, S7 evaluation (DATA-08), S8 draft sections, the S9
-- checklist, panels and sign-off (WF-05, WF-06), timeliness and uniqueness read models.
-- Test IDs refer to docs/TEST_PLAN.md. Fictional users only.
begin;

create temporary table u (name text primary key, id uuid);
grant all on u to anon, authenticated;

insert into auth.users (email, raw_user_meta_data) values
  ('p6hod@example.test',   '{"full_name": "P6 HOD"}'),
  ('p6lead@example.test',  '{"full_name": "P6 Lead"}'),
  ('p6guide@example.test', '{"full_name": "P6 Guide"}'),
  ('p6fac@example.test',   '{"full_name": "P6 Panel Faculty"}'),
  ('p6out@example.test',   '{"full_name": "P6 Other Faculty"}'),
  ('p6studa@example.test', '{"full_name": "P6 Student A"}'),
  ('p6studb@example.test', '{"full_name": "P6 Student B"}');
insert into u select split_part(email, '@', 1), id from auth.users where email like 'p6%@example.test';
select app.bootstrap_hod('p6hod@example.test');

select tests.login_as((select id from u where name = 'p6hod'));
select public.app_create_semester('P6 Semester', '2026-27', '{"start_date": "2027-01-05"}') as sem \gset
select public.app_set_lead(:'sem', (select id from u where name = 'p6lead'));
select public.app_set_membership(:'sem', (select id from u where name = 'p6guide'), 'faculty');
select public.app_set_membership(:'sem', (select id from u where name = 'p6fac'), 'faculty');
select public.app_set_membership(:'sem', (select id from u where name = 'p6out'), 'faculty');
select public.app_upsert_domain(:'sem', 'Machine Learning');
select public.app_activate_semester(:'sem');
select public.app_import_roster(:'sem', $$[
  {"slot_no": 1, "full_name": "P6 Student A", "email": "p6studa@example.test", "domain_name": "Machine Learning"},
  {"slot_no": 2, "full_name": "P6 Student B", "email": "p6studb@example.test", "domain_name": "Machine Learning"}
]$$::jsonb, false);
select public.app_link_student((select id from public.students where semester_id = :'sem' and slot_no = 1), (select id from u where name = 'p6studa'));
select public.app_link_student((select id from public.students where semester_id = :'sem' and slot_no = 2), (select id from u where name = 'p6studb'));
select tests.reset();
select p.id as pa from public.projects p join public.students s on s.id = p.student_id where s.semester_id = :'sem' and s.slot_no = 1 \gset
select p.id as pb from public.projects p join public.students s on s.id = p.student_id where s.semester_id = :'sem' and s.slot_no = 2 \gset
select tests.login_as((select id from u where name = 'p6hod'));
select public.app_assign_guide(:'pa', (select id from u where name = 'p6guide'));
select public.app_assign_guide(:'pb', (select id from u where name = 'p6guide'));
select tests.reset();

select tests.assert_eq((select count(*)::int from public.final_deliverables where project_id = :'pa'), 8,
  'every project gets its 8 checklist items (the ZIP is required by default)');

-- =============================================================================
-- Gate, S6 implementation items
-- =============================================================================
select tests.login_as((select id from u where name = 'p6studa'));
select tests.assert_raises(format($$select public.app_save_implementation_item(%L, '{"title": "Feature", "type": "feature"}')$$, :'pa'),
  'GATE_NOT_MET: Objectives (S5) must be approved before this work is recorded', 'WF-02 S6 records need approved objectives');
select tests.reset();
-- Fast-forward: S1–S5 approved (each was tested in Phase 4).
update public.project_stages set status = 'approved'
where project_id in (:'pa', :'pb') and stage_key in ('exploration', 'paper_selection', 'paper_analysis', 'code_execution', 'objectives');

select tests.login_as((select id from u where name = 'p6studa'));
select public.app_save_implementation_item(:'pa', '{"title": "Quantize the model", "type": "model_change",
  "status": "done", "commit_links": ["https://code.example.test/commit/1"]}') as item1 \gset
select tests.assert_raises(format($$select public.app_save_implementation_item(%L, '{"title": "X", "type": "feature", "commit_links": ["http://code.example.test/c"]}')$$, :'pa'),
  'VALIDATION: Commit links must start with https://', 'SEC-12 commit links');
select tests.assert_raises(format($$select public.app_save_implementation_item(%L, '{"title": "X", "type": "feature", "status": "dropped"}')$$, :'pa'),
  'VALIDATION: The reason for dropping it (in the notes) needs at least 5 characters', 'a dropped item needs a reason');
select public.app_save_implementation_item(:'pa', '{"title": "Phone app", "type": "frontend", "is_planned": true,
  "status": "dropped", "notes": "Out of scope after review"}');
select tests.reset();
select tests.assert_eq((select count(*)::int from public.implementation_items where project_id = :'pa'), 2, 'items are recorded');
select tests.pass('FUN-12 S6 implementation items and the objectives gate');

-- =============================================================================
-- S7 evaluation (DATA-08)
-- =============================================================================
select tests.login_as((select id from u where name = 'p6studa'));
select tests.assert_raises(format($$select public.app_save_evaluation_result(%L, '{"kind": "proposed", "test_case": "T1",
  "expected": "90%%", "actual": "91%%", "passed": true}')$$, :'pa'),
  'VALIDATION: Every result needs an evidence link (DATA-08)', 'DATA-08 a result without evidence is rejected');
select tests.assert_raises(format($$select public.app_save_evaluation_result(%L, '{"kind": "proposed", "test_case": "T2",
  "expected": "90%%", "actual": "80%%", "passed": false, "evidence_url": "https://drive.example.test/t2", "evidence_description": "Test run output"}')$$, :'pa'),
  'VALIDATION: A failed test needs the corrective action', 'a failed test needs a corrective action');
select tests.assert_raises(format($$select public.app_save_evaluation_result(%L, '{"kind": "other", "test_case": "T", "expected": "a", "actual": "b", "passed": true}')$$, :'pa'),
  'VALIDATION: Say whether this is a baseline (original work) or proposed (your work) result', 'baseline and proposed are the only kinds');
select public.app_save_evaluation_result(:'pa', '{"kind": "proposed", "test_case": "Accuracy on the demo test set",
  "expected": "At least 90%", "actual": "91.2%", "metric_name": "accuracy", "metric_value": 91.2, "passed": true,
  "evidence_url": "https://drive.example.test/proposed", "evidence_description": "Proposed model test output"}') as res_p \gset
select tests.assert_raises(format($$select public.app_submit_record('evaluation', %L)$$, :'pa'),
  'VALIDATION: Complete these before submitting: At least one baseline result (the original work)', 'DATA-08 baseline and proposed are both needed');
select public.app_save_evaluation_result(:'pa', '{"kind": "baseline", "test_case": "Accuracy on the demo test set",
  "expected": "As reported (89%)", "actual": "88.7%", "metric_name": "accuracy", "metric_value": 88.7, "passed": true,
  "evidence_url": "https://drive.example.test/baseline", "evidence_description": "Original code test output"}') as res_b \gset
select tests.reset();
select tests.assert_eq((select string_agg(kind::text, ',' order by kind) from public.evaluation_results where project_id = :'pa'),
  'baseline,proposed', 'DATA-08 baseline and proposed results stay separate');

select tests.login_as((select id from u where name = 'p6guide'));
select tests.assert_raises(format($$select public.app_record_review('evaluation', %L, 'accepted')$$, :'pa'),
  'INVALID_STATE: Only work that is waiting for review can be decided', 'nothing to decide before submission');
select tests.reset();
select tests.login_as((select id from u where name = 'p6studa'));
select public.app_submit_record('evaluation', :'pa');
select tests.assert_raises(format($$select public.app_save_evaluation_result(%L, '{"kind": "baseline", "test_case": "x", "expected": "x", "actual": "x", "passed": true, "evidence_url": "https://drive.example.test/x", "evidence_description": "More output"}')$$, :'pa'),
  'INVALID_STATE: The results are locked while they are waiting for review', 'WF-07 submitted results are locked');
select tests.reset();
select tests.login_as((select id from u where name = 'p6guide'));
select tests.assert_raises(format($$select public.app_record_review('evaluation', %L, 'accepted', 'ok')$$, :'pa'),
  'GATE_NOT_MET: S6 Proposed implementation must be approved before S7 Testing and evaluation', 'S7 needs S6');
select public.app_record_review('evaluation', :'pa', 'changes_requested', 'Add the latency test', null, array['Add a latency test case']) as rev_e \gset
select tests.reset();
update public.project_stages set status = 'approved' where project_id in (:'pa', :'pb') and stage_key = 'implementation';
select id as corr_e from public.corrections where review_id = :'rev_e' \gset
select tests.login_as((select id from u where name = 'p6studa'));
select public.app_save_evaluation_result(:'pa', '{"kind": "proposed", "test_case": "Latency on the demo phone",
  "expected": "Under 100 ms", "actual": "120 ms", "passed": false, "corrective_action": "Fuse layers and retest",
  "evidence_url": "https://drive.example.test/latency", "evidence_description": "Latency measurement log"}');
select public.app_address_correction(:'corr_e', 'Latency test added, including the failed run.');
select public.app_submit_record('evaluation', :'pa');
select tests.reset();
select tests.login_as((select id from u where name = 'p6guide'));
select public.app_resolve_correction(:'corr_e', 'verify');
select public.app_record_review('evaluation', :'pa', 'accepted', 'Results reviewed');
select tests.reset();
select tests.assert_eq((select string_agg(distinct status::text, ',') from public.evaluation_results where project_id = :'pa'),
  'approved', 'all results approved together');
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'evaluation'),
  'approved', 'S7 approved');
select tests.pass('S7 evaluation / DATA-08');

-- =============================================================================
-- S8 draft sections
-- =============================================================================
select tests.login_as((select id from u where name = 'p6studa'));
select public.app_save_draft(:'pa', 'introduction', '{"notes": "first draft"}') as d_intro \gset
select tests.assert_raises(format($$select public.app_submit_record('draft_section', %L)$$, :'d_intro'),
  'VALIDATION: Complete these before submitting: Document link', 'a section needs its document link');
select tests.assert_raises(format($$select public.app_save_draft(%L, 'introduction', '{"doc_url": "javascript:alert(1)"}')$$, :'pa'),
  'VALIDATION: The document link must be a link starting with https://', 'SEC-12 document links');
select public.app_save_draft(:'pa', s, jsonb_build_object('doc_url', 'https://docs.example.test/' || s))
from unnest(enum_range(null::public.draft_section)) s;
select public.app_submit_record('draft_section', d.id) from public.paper_drafts d where d.project_id = :'pa';
select tests.reset();
select tests.login_as((select id from u where name = 'p6guide'));
select public.app_record_review('draft_section', d.id, 'accepted', 'Section approved')
from public.paper_drafts d where d.project_id = :'pa' and d.section <> 'references';
select tests.reset();
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'paper_writing'),
  'awaiting_approval', 'S8 waits for every section');
select tests.login_as((select id from u where name = 'p6guide'));
select public.app_record_review('draft_section', d.id, 'accepted', 'Section approved')
from public.paper_drafts d where d.project_id = :'pa' and d.section = 'references';
select tests.reset();
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'paper_writing'),
  'approved', 'S8 approved when all ten sections are approved');
select tests.login_as((select id from u where name = 'p6studa'));
select public.app_new_draft_version(:'pa', 'introduction') as d_intro2 \gset
select tests.reset();
select tests.assert_eq((select version from public.paper_drafts where id = :'d_intro2'), 2, 'a new section version can be started');
select tests.pass('FUN-13 S8 draft sections');

-- =============================================================================
-- S9 checklist, panels and sign-off (WF-05, WF-06)
-- =============================================================================
select tests.login_as((select id from u where name = 'p6studa'));
select tests.assert_raises(format($$select public.app_submit_record('final', %L)$$, :'pa'),
  'VALIDATION: Add these checklist items first: %', 'the checklist must be complete');
select public.app_set_deliverable(:'pa', i, 'https://drive.example.test/' || i, 'Final ' || replace(i::text, '_', ' ') || ' link')
from unnest(enum_range(null::public.deliverable_item)) i;
select tests.assert_raises(format($$select public.app_submit_record('final', %L)$$, :'pa'),
  'GATE_NOT_MET: The HOD has not assigned this project to a panel yet', 'a panel is needed');
select tests.reset();

select tests.login_as((select id from u where name = 'p6lead'));
select tests.assert_raises(format($$select public.app_set_panel(%L, 'Panel A', array[%L]::uuid[], array[%L]::uuid[])$$,
  :'sem', (select id from u where name = 'p6guide'), :'pa'), 'FORBIDDEN: Only the HOD can set up panels', 'only the HOD forms panels');
select tests.reset();
select tests.login_as((select id from u where name = 'p6hod'));
select public.app_set_panel(:'sem', 'Panel A', array[(select id from u where name = 'p6guide'), (select id from u where name = 'p6fac')],
  array[:'pa']::uuid[]) as panel \gset
select tests.reset();

select tests.login_as((select id from u where name = 'p6studa'));
select public.app_submit_record('final', :'pa');
select tests.assert_raises(format($$select public.app_set_deliverable(%L, 'readme', 'https://drive.example.test/readme2', 'Updated readme link')$$, :'pa'),
  'INVALID_STATE: The checklist is locked while the panel is reviewing it', 'the checklist locks on submission');
select tests.assert_raises(format($$select public.app_record_signoff(%L, 'approve', 'Original work, checked.')$$, :'pa'),
  'FORBIDDEN: Only a member of this project''s panel can sign off', 'students cannot sign off');
select tests.reset();

select tests.login_as((select id from u where name = 'p6out'));
select tests.assert_raises(format($$select public.app_record_signoff(%L, 'approve', 'Original work, checked.')$$, :'pa'),
  'FORBIDDEN: Only a member of this project''s panel can sign off', 'faculty outside the panel cannot sign off');
select tests.reset();
select tests.login_as((select id from u where name = 'p6guide'));
select tests.assert_raises(format($$select public.app_record_review('final', %L, 'accepted')$$, :'pa'),
  'VALIDATION: Final decisions are recorded by the panel in the sign-off', 'S9 is decided only by the panel');
select tests.assert_raises(format($$select public.app_record_signoff(%L, 'approve', 'Original work, checked.')$$, :'pa'),
  'GATE_NOT_MET: 8 checklist item(s) are not verified yet', 'WF-05 sign-off needs the verified checklist');
select public.app_verify_deliverable(d.id, 'verified') from public.final_deliverables d where d.project_id = :'pa';
select tests.assert_raises(format($$select public.app_record_signoff(%L, 'approve', 'short')$$, :'pa'),
  'VALIDATION: The originality remark needs at least 10 characters', 'an originality remark is required');
select public.app_record_signoff(:'pa', 'approve', 'Clear contribution beyond the original paper.');
select tests.reset();
select tests.assert_eq((select is_completed from public.projects where id = :'pa'), false, 'WF-06 one of two approvals is not the quorum');

select tests.login_as((select id from u where name = 'p6fac'));
select tests.assert_raises(format($$select public.app_record_signoff(%L, 'changes_required', 'Mostly original work.')$$, :'pa'),
  'VALIDATION: List at least one correction when changes are required', 'changes required needs a correction');
select public.app_record_signoff(:'pa', 'changes_required', 'Mostly original work.', null, array['Add the demo video link']);
select tests.reset();
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'final'),
  'changes_requested', 'WF-06 changes required reopens S9');

select tests.login_as((select id from u where name = 'p6studa'));
select public.app_set_deliverable(:'pa', 'demo_evidence', 'https://drive.example.test/demo-video', 'Demo video of the final system');
select public.app_address_correction(c.id, 'The demo video link is in the checklist now.')
from public.corrections c where c.project_id = :'pa' and c.target_type = 'final';
select public.app_submit_record('final', :'pa');
select tests.reset();

select tests.login_as((select id from u where name = 'p6fac'));
select tests.assert_raises(format($$select public.app_record_signoff(%L, 'approve', 'Original work, checked again.')$$, :'pa'),
  'GATE_NOT_MET: 1 checklist item(s) are not verified yet', 'WF-05 the changed item must be verified again');
select public.app_verify_deliverable(d.id, 'verified') from public.final_deliverables d where d.project_id = :'pa' and d.item = 'demo_evidence';
select tests.assert_raises(format($$select public.app_record_signoff(%L, 'approve', 'Original work, checked again.')$$, :'pa'),
  'GATE_NOT_MET: 1 correction(s) in this project are still open or addressed', 'WF-05 no sign-off with addressed corrections');
select public.app_resolve_correction(c.id, 'verify') from public.corrections c where c.project_id = :'pa' and c.target_type = 'final';
select public.app_record_signoff(:'pa', 'approve', 'Original work, checked again.');
select tests.reset();
select tests.assert_eq((select is_completed from public.projects where id = :'pa'), true, 'WF-06 completed when the quorum approves');
select tests.assert_eq((select status::text from public.project_stages where project_id = :'pa' and stage_key = 'final'), 'approved', 'S9 approved');
select tests.assert_eq((select count(*)::int from public.final_signoffs where project_id = :'pa'), 2, 'one sign-off per member');
select tests.assert(
  (select count(*) from public.audit_log where action = 'signoff.recorded' and project_id = :'pa') = 3, 'every decision is in the audit log');
select tests.pass('S9 FUN-14 checklist, FUN-15 panels, FUN-16 sign-off / WF-05 / WF-06');

-- =============================================================================
-- Read models, isolation
-- =============================================================================
select tests.login_as((select id from u where name = 'p6studb'));
select tests.assert_eq((select count(*)::int from public.evaluation_results where project_id = :'pa'), 0, 'SEC-08 results');
select tests.assert_eq((select count(*)::int from public.paper_drafts where project_id = :'pa'), 0, 'SEC-08 drafts');
select tests.assert_eq((select count(*)::int from public.final_deliverables where project_id = :'pa'), 0, 'SEC-08 checklist');
select tests.assert_eq((select count(*)::int from public.final_signoffs where project_id = :'pa'), 0, 'SEC-08 sign-offs');
select tests.assert_eq((select count(*)::int from public.implementation_items where project_id = :'pa'), 0, 'SEC-08 items');
select tests.assert_eq((select count(*)::int from public.panel_projects where project_id = :'pa'), 0, 'SEC-08 panel assignment');
select tests.assert_raises(format($$update public.final_deliverables set verification = 'verified' where project_id = %L$$, :'pb'),
  'permission denied%', 'SEC-09 checklist verification cannot be written directly');
select tests.reset();
-- (titles are fixed after S5; set them directly for the uniqueness check)
update public.projects set title = 'compressed image classifiers' where id = :'pa';
update public.projects set title = 'Compressed Image Classifiers!' where id = :'pb';
select tests.login_as((select id from u where name = 'p6guide'));
select tests.assert_eq((select kind from public.v_duplicate_warnings where semester_id = :'sem'), 'project_title',
  'similar project titles are flagged');
select tests.assert_eq((select submitted_on_time + submitted_late from public.v_timeliness where project_id = :'pa'), 0,
  'timeliness is available per project');
select tests.reset();
select tests.pass('read models and isolation for Phase 6');

rollback;
