-- Phase 5 — Weekly tasks (part B: the semester plan, deadlines and task generation)
-- Specs: WEEKLY_MILESTONE_PLAN.md (the default 16-week template), API_SPEC.md §4.1
-- (app_generate_tasks), PRD AC1.3 (week dates) and AC6.1 (domain overrides).

-- -----------------------------------------------------------------------------
-- Deadlines. Week N starts on start_date + 7·(N−1), or on the milestone's override.
-- Work for week N is due at the semester's submission weekday/time before the next
-- lab (week start + 7 days), in the semester's time zone.
-- -----------------------------------------------------------------------------
create or replace function app.week_due_at(p_semester_id uuid, p_week_no int)
returns timestamptz language sql stable set search_path = '' as $$
  with base as (
    select s.timezone, s.submission_weekday, s.submission_time,
           coalesce(m.start_date_override, s.start_date + 7 * (p_week_no - 1)) + 7 as next_lab
    from public.semesters s
    left join public.milestones m on m.semester_id = s.id and m.week_no = p_week_no
    where s.id = p_semester_id and s.start_date is not null
  )
  select ((next_lab - (((extract(isodow from next_lab)::int - submission_weekday + 6) % 7) + 1))::timestamp
          + submission_time) at time zone timezone
  from base;
$$;

-- -----------------------------------------------------------------------------
-- The default plan (WEEKLY_MILESTONE_PLAN.md). Weeks beyond the semester length are skipped.
-- -----------------------------------------------------------------------------
create or replace function app.seed_default_plan(p_semester_id uuid)
returns void language plpgsql set search_path = '' as $$
declare
  v_weeks int;
begin
  select week_count into v_weeks from public.semesters where id = p_semester_id;
  if exists (select 1 from public.milestones where semester_id = p_semester_id)
     or exists (select 1 from public.task_templates where semester_id = p_semester_id) then
    return;
  end if;

  insert into public.milestones (semester_id, week_no, title, stage_key, is_gate, checkpoint)
  select p_semester_id, w, t, s::public.stage_key, g, c
  from (values
    (1, 'Domain and research exploration', 'exploration', false, 'Guide feedback at lab'),
    (2, 'Research paper selection', 'paper_selection', true, 'G1 paper approved'),
    (3, 'Paper analysis and repository', 'paper_analysis', false, 'Analysis review'),
    (4, 'Run the original code', 'code_execution', true, 'G2 execution verified or exception; last week to change the paper'),
    (5, 'Research gap and literature review', 'objectives', false, 'Review'),
    (6, 'Finalize objectives', 'objectives', true, 'G3 objectives approved'),
    (7, 'Implementation plan and dataset', 'implementation', false, 'Weekly review'),
    (8, 'Core modification, part 1', 'implementation', true, 'G4 mid-semester review'),
    (9, 'Core modification, part 2', 'implementation', false, 'Weekly review'),
    (10, 'Integration and debugging', 'implementation', false, 'Weekly review'),
    (11, 'Testing', 'evaluation', false, 'Weekly review'),
    (12, 'Evaluation and comparison', 'evaluation', true, 'G5 results review'),
    (13, 'Paper writing, part 1', 'paper_writing', false, 'Section reviews'),
    (14, 'Paper writing, part 2 and revisions', 'paper_writing', true, 'G6 drafts approved'),
    (15, 'Final integration and presentation', 'final', false, 'Pre-final review'),
    (16, 'Final demonstration and sign-off', 'final', true, 'G7 panel sign-off')
  ) as m(w, t, s, g, c)
  where w <= v_weeks;

  insert into public.task_templates (semester_id, week_no, stage_key, title, acceptance_criteria, required_evidence, sort_order)
  select p_semester_id, w, s::public.stage_key, t, a, e::public.evidence_category[], o
  from (values
    (1, 'exploration', 'Explore the assigned domain',
      array['At least 3 candidate topics', 'At least 5 keywords', 'At least 3 sources searched, with links', 'Proposed problem drafted'],
      array['other'], 1),
    (2, 'paper_selection', 'Select a research paper',
      array['Exploration submitted', 'Paper record complete', 'Code availability checked', 'Relevance note written', 'PDF stored in Drive', 'Foundational justification if the paper is not from the target year'],
      array['research_paper_pdf'], 1),
    (3, 'paper_analysis', 'Analyse the paper',
      array['Analysis template complete (all fields)', 'Own understanding of at least 150 characters', 'Limitations listed'],
      array['paper_analysis'], 1),
    (3, 'code_execution', 'Identify the repository and set up the environment',
      array['Repository record complete (link, commit, language, dependencies, dataset needs)', 'First execution attempt logged'],
      array['github_repository'], 2),
    (4, 'code_execution', 'Run the original code',
      array['At least one successful attempt with logs or screenshots and result files, or a documented failure or blocker with errors and debugging notes'],
      array['execution_log', 'execution_screenshot', 'result_file'], 1),
    (5, 'objectives', 'Identify the research gap',
      array['Limitations mapped to a research gap', 'Draft problem statement'],
      array['objective_document'], 1),
    (5, 'paper_writing', 'Draft the literature review',
      array['Literature review section, version 1', 'At least 8 real, verifiable references'],
      array['paper_draft'], 2),
    (6, 'objectives', 'Finalize the objectives',
      array['Main objective and at least 2 specific objectives', 'Contribution, scope and exclusions', 'Evaluation criteria'],
      array['objective_document'], 1),
    (7, 'implementation', 'Implementation plan and dataset preparation',
      array['List of planned features', 'Dataset prepared and referenced', 'Repository or branch for own work'],
      array['implementation_evidence'], 1),
    (8, 'implementation', 'Core modification, part 1',
      array['Planned items in progress with commit links', 'Working build'],
      array['implementation_evidence'], 1),
    (9, 'implementation', 'Core modification, part 2',
      array['Main contribution implemented end to end (first working version)'],
      array['implementation_evidence'], 1),
    (10, 'implementation', 'Integration and debugging',
      array['All planned items done, or dropped with a reason', 'Known bugs listed'],
      array['implementation_evidence'], 1),
    (10, 'paper_writing', 'Draft the methodology and proposed approach',
      array['Methodology section, version 1', 'Proposed approach section, version 1'],
      array['paper_draft'], 2),
    (11, 'evaluation', 'Testing',
      array['Test cases with expected and actual results', 'Baseline results from S4 recorded as baseline'],
      array['test_results'], 1),
    (12, 'evaluation', 'Evaluation and comparison',
      array['Proposed results recorded with evidence', 'Comparison table or chart', 'Failed tests with corrective actions'],
      array['test_results'], 1),
    (13, 'paper_writing', 'Write the paper, part 1',
      array['Title and abstract, introduction, problem and objectives, and implementation sections submitted'],
      array['paper_draft'], 1),
    (14, 'paper_writing', 'Write the paper, part 2 and revisions',
      array['Results and discussion, conclusion and future work, and references submitted', 'All earlier corrections addressed'],
      array['paper_draft'], 1),
    (15, 'final', 'Final integration and presentation',
      array['Report, README with setup steps, presentation', 'Dataset references and permissions', 'All open corrections closed'],
      array['final_report', 'presentation'], 1),
    (16, 'final', 'Final demonstration and sign-off',
      array['Demo evidence, final paper, source repository', 'Source ZIP if the semester requires it', 'Final checklist verified'],
      array['demo_evidence', 'final_zip'], 1)
  ) as x(w, s, t, a, e, o)
  where w <= v_weeks;
end;
$$;

-- The templates that apply to a project: generic ones and those of its domain, minus the
-- generic ones its domain replaces.
create or replace function app.effective_template_ids(p_project_id uuid)
returns setof uuid language sql stable set search_path = '' as $$
  select t.id
  from public.projects p
  join public.semesters s on s.id = p.semester_id
  join public.task_templates t on t.semester_id = s.id
  where p.id = p_project_id and t.is_active and t.week_no <= s.week_count
    and (t.domain_id is null or t.domain_id = p.domain_id)
    and not exists (select 1 from public.task_templates r
                    where r.replaces_template_id = t.id and r.is_active
                      and r.domain_id = p.domain_id and r.week_no <= s.week_count);
$$;

-- -----------------------------------------------------------------------------
-- Task generation for one project.
-- * Templates apply to every domain, or only to the project's domain.
-- * A domain template that replaces a generic one hides the generic one for that domain.
-- * New tasks are created; with p_regenerate, tasks without submissions are refreshed from
--   their template (text and deadline) and switched off when the template no longer applies.
--   Tasks with submissions are never changed.
-- Returns the number of tasks created or changed.
-- -----------------------------------------------------------------------------
create or replace function app.generate_project_tasks(p_project_id uuid, p_regenerate boolean default false)
returns int language plpgsql set search_path = '' as $$
declare
  v_project public.projects;
  v_semester public.semesters;
  v_created int := 0;
  v_changed int := 0;
begin
  select * into v_project from public.projects where id = p_project_id;
  select * into v_semester from public.semesters where id = v_project.semester_id;
  if v_semester.start_date is null
     or exists (select 1 from public.students where id = v_project.student_id and status = 'withdrawn') then
    return 0;
  end if;

  with created as (
    insert into public.tasks (project_id, template_id, week_no, stage_key, title, description,
                              acceptance_criteria, required_evidence, due_at)
    select p_project_id, t.id, t.week_no, t.stage_key, t.title, t.description, t.acceptance_criteria,
           t.required_evidence, app.week_due_at(v_semester.id, t.week_no)
    from public.task_templates t where t.id in (select app.effective_template_ids(p_project_id))
    on conflict (project_id, template_id) where template_id is not null do nothing
    returning 1)
  select count(*) into v_created from created;

  if p_regenerate then
    with changed as (
      update public.tasks k
      set week_no = t.week_no, stage_key = t.stage_key, title = t.title, description = t.description,
          acceptance_criteria = t.acceptance_criteria, required_evidence = t.required_evidence,
          due_at = app.week_due_at(v_semester.id, t.week_no),
          is_active = t.id in (select app.effective_template_ids(p_project_id))
      from public.task_templates t
      where k.project_id = p_project_id and k.template_id = t.id
        and not exists (select 1 from public.submissions s where s.task_id = k.id)
        and (k.week_no, k.stage_key, k.title, k.description, k.acceptance_criteria, k.required_evidence, k.due_at, k.is_active)
            is distinct from
            (t.week_no, t.stage_key, t.title, t.description, t.acceptance_criteria, t.required_evidence,
             app.week_due_at(v_semester.id, t.week_no), t.id in (select app.effective_template_ids(p_project_id)))
      returning 1)
    select count(*) into v_changed from changed;
  end if;
  return v_created + v_changed;
end;
$$;

-- New semesters start with the default plan (the HOD edits it afterwards).
create or replace function app.semester_seed_plan()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform app.seed_default_plan(new.id);
  return null;
end;
$$;
create trigger semesters_seed_plan after insert on public.semesters
  for each row execute function app.semester_seed_plan();

-- Activating a semester generates every project's tasks.
create or replace function app.semester_generate_on_activate()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    perform app.generate_project_tasks(p.id, true) from public.projects p where p.semester_id = new.id;
  end if;
  return null;
end;
$$;
create trigger semesters_generate_tasks after update of status on public.semesters
  for each row execute function app.semester_generate_on_activate();

-- A project added to (or moved to another domain in) an active semester gets its tasks.
create or replace function app.project_generate_tasks()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.semesters where id = new.semester_id and status = 'active')
     and (tg_op = 'INSERT' or new.domain_id is distinct from old.domain_id) then
    perform app.generate_project_tasks(new.id, true);
  end if;
  return null;
end;
$$;
create trigger projects_generate_tasks after insert or update of domain_id on public.projects
  for each row execute function app.project_generate_tasks();

-- Existing semesters (created before Phase 5) get the default plan once.
select app.seed_default_plan(id) from public.semesters;

-- -----------------------------------------------------------------------------
-- Plan editing (HOD, or admin with manage_config)
-- -----------------------------------------------------------------------------
create or replace function app.require_plan_editor(p_semester_id uuid)
returns public.semesters language plpgsql set search_path = '' as $$
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_config') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can change the semester plan');
  end if;
  return app.require_open_semester(p_semester_id);
end;
$$;

create or replace function public.app_upsert_milestone(p_semester_id uuid, p_week_no int, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester public.semesters := app.require_plan_editor(p_semester_id);
  v_title text;
  v_stage text;
  v_override text;
  v_id uuid;
begin
  perform app.check_keys(p_data, array['title', 'stage_key', 'description', 'is_gate', 'checkpoint', 'start_date_override']);
  if p_week_no is null or p_week_no not between 1 and v_semester.week_count then
    perform app.raise_error('VALIDATION', format('Week must be from 1 to %s', v_semester.week_count), 'week_no');
  end if;
  v_title := app.jtext(p_data, 'title', 'Title', 200);
  if v_title is null then
    perform app.raise_error('VALIDATION', 'Title is required', 'title');
  end if;
  v_stage := app.jtext(p_data, 'stage_key', 'Stage', 40);
  if v_stage is null or v_stage <> all (enum_range(null::public.stage_key)::text[]) then
    perform app.raise_error('VALIDATION', 'Choose the stage of this week', 'stage_key');
  end if;
  v_override := app.jtext(p_data, 'start_date_override', 'Start date', 10);
  if v_override is not null and (v_override !~ '^\d{4}-\d{2}-\d{2}$'
      or to_char(to_date(v_override, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> v_override) then
    perform app.raise_error('VALIDATION', 'Start date must be a real date (YYYY-MM-DD)', 'start_date_override');
  end if;
  insert into public.milestones as m (semester_id, week_no, title, stage_key, description, is_gate, checkpoint, start_date_override)
  values (p_semester_id, p_week_no, v_title, v_stage::public.stage_key,
          app.jtext(p_data, 'description', 'Description', 2000),
          coalesce((p_data ->> 'is_gate')::boolean, false),
          app.jtext(p_data, 'checkpoint', 'Checkpoint', 300),
          v_override::date)
  on conflict (semester_id, week_no) do update
    set title = excluded.title, stage_key = excluded.stage_key, description = excluded.description,
        is_gate = excluded.is_gate, checkpoint = excluded.checkpoint, start_date_override = excluded.start_date_override
  returning m.id into v_id;
  perform app.log_action('milestone.saved', 'milestones', v_id, null, p_semester_id, p_data);
  return v_id;
exception when invalid_text_representation then
  perform app.raise_error('VALIDATION', '"Gate" must be true or false', 'is_gate');
end;
$$;

create or replace function public.app_upsert_task_template(p_semester_id uuid, p_data jsonb, p_template_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester public.semesters := app.require_plan_editor(p_semester_id);
  v_week int;
  v_stage text;
  v_title text;
  v_domain uuid;
  v_replaces uuid;
  v_criteria text[];
  v_evidence text[];
  v_id uuid;
begin
  perform app.check_keys(p_data, array['week_no', 'stage_key', 'domain_id', 'replaces_template_id', 'title',
    'description', 'acceptance_criteria', 'required_evidence', 'sort_order', 'is_active']);
  v_week := app.jint(p_data, 'week_no', 'Week', 1, 30);
  if v_week is null or v_week > v_semester.week_count then
    perform app.raise_error('VALIDATION', format('Week must be from 1 to %s', v_semester.week_count), 'week_no');
  end if;
  v_stage := app.jtext(p_data, 'stage_key', 'Stage', 40);
  if v_stage is null or v_stage <> all (enum_range(null::public.stage_key)::text[]) then
    perform app.raise_error('VALIDATION', 'Choose the stage of this task', 'stage_key');
  end if;
  v_title := app.jtext(p_data, 'title', 'Title', 200);
  if v_title is null then
    perform app.raise_error('VALIDATION', 'Title is required', 'title');
  end if;
  v_criteria := app.jtext_array(p_data, 'acceptance_criteria', 'Acceptance criteria', 20, 500);
  if cardinality(v_criteria) = 0 then
    perform app.raise_error('VALIDATION', 'Give at least one acceptance criterion', 'acceptance_criteria');
  end if;
  v_evidence := app.jtext_array(p_data, 'required_evidence', 'Required evidence', 15, 40);
  if exists (select 1 from unnest(v_evidence) e where e <> all (enum_range(null::public.evidence_category)::text[])) then
    perform app.raise_error('VALIDATION', 'Unknown kind of evidence', 'required_evidence');
  end if;
  v_domain := app.try_uuid(app.jtext(p_data, 'domain_id', 'Domain', 40));
  if app.jtext(p_data, 'domain_id', 'Domain', 40) is not null and not exists (
    select 1 from public.domains where id = v_domain and semester_id = p_semester_id) then
    perform app.raise_error('VALIDATION', 'Choose a domain of this semester', 'domain_id');
  end if;
  v_replaces := app.try_uuid(app.jtext(p_data, 'replaces_template_id', 'Replaced task', 40));
  if app.jtext(p_data, 'replaces_template_id', 'Replaced task', 40) is not null then
    if v_domain is null then
      perform app.raise_error('VALIDATION', 'Only a domain task can replace a generic task', 'replaces_template_id');
    end if;
    if not exists (select 1 from public.task_templates where id = v_replaces and semester_id = p_semester_id
                   and domain_id is null and id is distinct from p_template_id) then
      perform app.raise_error('VALIDATION', 'Choose a generic task of this semester to replace', 'replaces_template_id');
    end if;
  end if;

  if p_template_id is null then
    insert into public.task_templates (semester_id, week_no, stage_key, title, acceptance_criteria)
    values (p_semester_id, v_week, v_stage::public.stage_key, v_title, v_criteria)
    returning id into v_id;
  else
    select id into v_id from public.task_templates where id = p_template_id and semester_id = p_semester_id;
    if v_id is null then
      perform app.raise_error('NOT_FOUND', 'Task template not found');
    end if;
  end if;
  update public.task_templates set
    week_no = v_week, stage_key = v_stage::public.stage_key, title = v_title,
    description = app.jtext(p_data, 'description', 'Description', 5000),
    domain_id = v_domain, replaces_template_id = v_replaces,
    acceptance_criteria = v_criteria, required_evidence = v_evidence::public.evidence_category[],
    sort_order = coalesce(app.jint(p_data, 'sort_order', 'Order', -1000, 1000), 0),
    is_active = coalesce((p_data ->> 'is_active')::boolean, true)
  where id = v_id;
  perform app.log_action('task_template.saved', 'task_templates', v_id, null, p_semester_id,
    jsonb_build_object('week_no', v_week, 'title', v_title));
  return v_id;
exception when invalid_text_representation then
  perform app.raise_error('VALIDATION', '"Active" must be true or false', 'is_active');
end;
$$;

-- Creates (and, with p_regenerate, refreshes) tasks for every project, or one project.
create or replace function public.app_generate_tasks(p_semester_id uuid, p_project_id uuid default null, p_regenerate boolean default false)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester public.semesters := app.require_plan_editor(p_semester_id);
  v_count int;
begin
  if v_semester.start_date is null then
    perform app.raise_error('GATE_NOT_MET', 'Set the semester start date first; deadlines are computed from it', 'start_date');
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects where id = p_project_id and semester_id = p_semester_id) then
    perform app.raise_error('NOT_FOUND', 'Project not found');
  end if;
  select coalesce(sum(app.generate_project_tasks(p.id, coalesce(p_regenerate, false))), 0)::int into v_count
  from public.projects p
  where p.semester_id = p_semester_id and (p_project_id is null or p.id = p_project_id);
  perform app.log_action('tasks.generated', 'semesters', p_semester_id, p_project_id, p_semester_id,
    jsonb_build_object('regenerate', p_regenerate, 'count', v_count));
  return v_count;
end;
$$;
