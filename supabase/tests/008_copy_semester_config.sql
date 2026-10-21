-- Phase 8: copying a semester's setup into a new draft semester (API_SPEC.md §4.1,
-- app_copy_semester_config). Fictional users only.
begin;

create temporary table u (name text primary key, id uuid);
grant all on u to anon, authenticated;
insert into auth.users (email, raw_user_meta_data) values
  ('p8hod@example.test', '{"full_name": "P8 HOD"}'),
  ('p8lead@example.test', '{"full_name": "P8 Lead"}');
insert into u select split_part(email, '@', 1), id from auth.users where email like 'p8%@example.test';
select app.bootstrap_hod('p8hod@example.test');

-- Source semester: two domains, a criterion, a changed milestone and a Web-specific
-- template that replaces a generic one.
select tests.login_as((select id from u where name = 'p8hod'));
select public.app_create_semester('P8 Old', '2026-27', '{"start_date": "2026-07-01"}') as old \gset
select public.app_upsert_domain(:'old', 'Machine Learning') as old_ml \gset
select public.app_upsert_domain(:'old', 'Web Systems') as old_web \gset
select public.app_upsert_criterion(:'old_ml', 'Accuracy against the baseline');
select public.app_upsert_milestone(:'old', 3, '{"stage_key": "paper_analysis", "title": "Analysis deep-dive"}');
select public.app_upsert_task_template(:'old', jsonb_build_object('week_no', 11, 'stage_key', 'evaluation',
  'title', 'Web load testing', 'acceptance_criteria', array['A load test report'], 'domain_id', :'old_web',
  'replaces_template_id', (select id from public.task_templates where semester_id = :'old' and week_no = 11 and domain_id is null limit 1)));
select public.app_create_semester('P8 New', '2027-28', '{"start_date": "2027-07-01"}') as new \gset
select public.app_upsert_domain(:'new', 'machine learning ');  -- already there, by name
select tests.reset();

-- Permission and state checks.
select tests.login_as((select id from u where name = 'p8lead'));
select tests.assert_raises(format($$select public.app_copy_semester_config(%L, %L)$$, :'old', :'new'),
  'FORBIDDEN: Only the HOD can copy a semester''s setup', 'only the HOD (or an admin with the config permission) can copy');
select tests.reset();
select tests.login_as((select id from u where name = 'p8hod'));
select tests.assert_raises(format($$select public.app_copy_semester_config(%L, %L)$$, :'new', :'new'),
  'VALIDATION: Choose a different semester to copy from', 'not into itself');

select public.app_copy_semester_config(:'old', :'new') as result \gset
select tests.reset();
select tests.assert_eq((:'result'::jsonb ->> 'domains_added')::int, 1, 'only the missing domain is added (names match case-insensitively)');
select tests.assert_eq((:'result'::jsonb ->> 'criteria_added')::int, 1, 'criteria are copied');
select tests.assert_eq((select string_agg(name, ',' order by lower(name)) from public.domains where semester_id = :'new'),
  'machine learning,Web Systems', 'the existing domain is kept as it was');
select tests.assert_eq((select c.name from public.evaluation_criteria c join public.domains d on d.id = c.domain_id
                        where d.semester_id = :'new'), 'Accuracy against the baseline', 'the criterion lands on the matching domain');
select tests.assert_eq((select title from public.milestones where semester_id = :'new' and week_no = 3), 'Analysis deep-dive',
  'milestones are copied week by week');
select tests.assert_eq((select count(*)::int from public.task_templates where semester_id = :'new' and is_active),
  (select count(*)::int from public.task_templates where semester_id = :'old' and is_active), 'every active template is copied');
select tests.assert_eq((:'result'::jsonb ->> 'templates_switched_off')::int > 0, true, 'the default plan is switched off, not deleted');
select tests.assert_eq(
  (select g.semester_id = :'new'::uuid and d.semester_id = :'new'::uuid
   from public.task_templates r
   join public.task_templates g on g.id = r.replaces_template_id
   join public.domains d on d.id = r.domain_id
   where r.semester_id = :'new' and r.is_active and r.title = 'Web load testing'),
  true, 'a domain template replaces the copied generic template, in the new semester''s domain');
select tests.assert_eq((select count(*)::int from public.audit_log where action = 'semester.config_copied' and row_id = :'new'),
  1, 'the copy is audited');

-- Activating the new semester generates tasks from the copied plan.
select tests.login_as((select id from u where name = 'p8hod'));
select public.app_set_lead(:'new', (select id from u where name = 'p8lead'));
select public.app_activate_semester(:'new');
select public.app_import_roster(:'new', $$[{"slot_no": 1, "full_name": "P8 Student Web", "domain_name": "Web Systems"}]$$::jsonb, false);
select tests.reset();
select tests.assert_eq((select string_agg(k.title, ',') from public.tasks k join public.projects p on p.id = k.project_id
                        where p.semester_id = :'new' and k.week_no = 11 and k.is_active), 'Web load testing',
  'a Web project in the new semester gets the copied domain task');

-- Only into a draft.
select tests.login_as((select id from u where name = 'p8hod'));
select tests.assert_raises(format($$select public.app_copy_semester_config(%L, %L)$$, :'old', :'new'),
  'INVALID_STATE: The setup can be copied only into a semester that is still a draft', 'an active semester cannot be overwritten');
select tests.reset();
select tests.pass('copy a semester''s setup into a new draft semester');

rollback;
