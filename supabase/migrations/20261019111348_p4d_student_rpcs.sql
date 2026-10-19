-- Phase 4 — Research stages S1–S5 (part D: the student's workflow functions)
-- Specs: WORKFLOW_SPEC.md §2.1 (required fields), §3.1–§3.3 (transitions),
-- USER_ROLES_AND_PERMISSIONS.md §3 (a record is editable only while draft or
-- changes requested; submitted and approved records are locked).

-- -----------------------------------------------------------------------------
-- S1 Exploration
-- -----------------------------------------------------------------------------
create or replace function public.app_save_exploration(p_project_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_row public.research_explorations;
  v_sources jsonb;
  v_source jsonb;
  v_id uuid;
begin
  perform app.check_keys(p_data, array['candidate_topics', 'keywords', 'sources', 'proposed_problem']);
  select * into v_row from public.research_explorations where project_id = p_project_id;
  if found and v_row.status not in ('draft', 'changes_requested') then
    perform app.raise_error('INVALID_STATE', 'The exploration is locked while it is submitted or approved');
  end if;

  v_sources := coalesce(p_data -> 'sources', '[]');
  if jsonb_typeof(v_sources) <> 'array' or jsonb_array_length(v_sources) > 30 then
    perform app.raise_error('VALIDATION', 'Sources must be a list of at most 30 entries', 'sources');
  end if;
  -- Keep only rows with something in them; each kept row needs a name and an https link.
  select coalesce(jsonb_agg(jsonb_build_object('name', btrim(s ->> 'name'), 'url', btrim(s ->> 'url')) order by n), '[]')
  into v_sources
  from jsonb_array_elements(v_sources) with ordinality as t(s, n)
  where jsonb_typeof(s) = 'object' and (coalesce(btrim(s ->> 'name'), '') <> '' or coalesce(btrim(s ->> 'url'), '') <> '');
  for v_source in select * from jsonb_array_elements(v_sources) loop
    if coalesce(v_source ->> 'name', '') = '' or char_length(v_source ->> 'name') > 200 then
      perform app.raise_error('VALIDATION', 'Each source needs a name (up to 200 characters)', 'sources');
    end if;
    perform app.valid_url(v_source ->> 'url', 'Each source link', 'sources');
  end loop;

  insert into public.research_explorations as e (project_id, candidate_topics, keywords, sources, proposed_problem)
  values (
    p_project_id,
    app.jtext_array(p_data, 'candidate_topics', 'Candidate topics'),
    app.jtext_array(p_data, 'keywords', 'Keywords', 50, 100),
    v_sources,
    app.jtext(p_data, 'proposed_problem', 'Proposed research problem', 5000))
  on conflict (project_id) do update
    set candidate_topics = excluded.candidate_topics, keywords = excluded.keywords,
        sources = excluded.sources, proposed_problem = excluded.proposed_problem
  returning e.id into v_id;
  perform app.touch_stage(p_project_id, 'exploration');
  perform app.log_action('exploration.saved', 'research_explorations', v_id, p_project_id, v_project.semester_id);
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- S2 Papers
-- -----------------------------------------------------------------------------
create or replace function public.app_save_paper(p_project_id uuid, p_data jsonb, p_paper_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_paper public.papers;
  v_title text;
  v_doi text;
  v_availability text;
  v_id uuid;
begin
  perform app.check_keys(p_data, array['title', 'authors', 'pub_year', 'venue', 'doi', 'url', 'pdf_drive_url',
    'abstract', 'research_problem', 'relevance_note', 'code_availability', 'foundational_justification']);
  if p_paper_id is not null then
    select * into v_paper from public.papers where id = p_paper_id and project_id = p_project_id;
    if not found then
      perform app.raise_error('NOT_FOUND', 'Paper not found');
    end if;
    if v_paper.status <> 'candidate' then
      perform app.raise_error('INVALID_STATE', 'Only a candidate paper can be edited; this one is locked');
    end if;
  elsif (select count(*) from public.papers where project_id = p_project_id and status <> 'withdrawn') >= 10 then
    perform app.raise_error('VALIDATION', 'A project can have at most 10 candidate papers; withdraw one first');
  end if;

  v_title := app.jtext(p_data, 'title', 'Title', 500);
  if v_title is null then
    perform app.raise_error('VALIDATION', 'Title is required', 'title');
  end if;
  -- Accept "https://doi.org/10.…" as well as the bare DOI.
  v_doi := regexp_replace(app.jtext(p_data, 'doi', 'DOI', 300), '^https?://(dx\.)?doi\.org/', '', 'i');
  if v_doi is not null and v_doi !~ '^10\.[0-9]{4,9}/\S+$' then
    perform app.raise_error('VALIDATION', 'DOI must look like 10.1234/abcd', 'doi');
  end if;
  v_availability := coalesce(app.jtext(p_data, 'code_availability', 'Code availability', 20), 'unknown');
  if v_availability not in ('unknown', 'available', 'not_available') then
    perform app.raise_error('VALIDATION', 'Code availability must be unknown, available or not available', 'code_availability');
  end if;

  if p_paper_id is null then
    insert into public.papers (project_id, title) values (p_project_id, v_title) returning id into v_id;
  else
    v_id := p_paper_id;
  end if;
  update public.papers set
    title = v_title,
    authors = app.jtext_array(p_data, 'authors', 'Authors', 50, 200),
    pub_year = app.jint(p_data, 'pub_year', 'Publication year', 1900, 2100),
    venue = app.jtext(p_data, 'venue', 'Venue', 300),
    doi = v_doi,
    url = app.jurl(p_data, 'url', 'Publisher link'),
    pdf_drive_url = app.jurl(p_data, 'pdf_drive_url', 'PDF Drive link'),
    abstract = app.jtext(p_data, 'abstract', 'Abstract', 10000),
    research_problem = app.jtext(p_data, 'research_problem', 'Research problem', 5000),
    relevance_note = app.jtext(p_data, 'relevance_note', 'Relevance to the domain', 5000),
    code_availability = v_availability::public.code_availability,
    foundational_justification = app.jtext(p_data, 'foundational_justification', 'Foundational justification', 5000)
  where id = v_id;
  perform app.touch_stage(p_project_id, 'paper_selection');
  perform app.log_action('paper.saved', 'papers', v_id, p_project_id, v_project.semester_id);
  return v_id;
end;
$$;

-- Choose the paper to submit. Only one paper is selected; an approved or submitted
-- paper must be dealt with first (withdrawn by a reviewer, or reviewed).
create or replace function public.app_select_paper(p_paper_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper public.papers;
  v_project public.projects;
  v_current public.papers;
begin
  select * into v_paper from public.papers where id = p_paper_id;
  if not found or not app.can_view_project(v_paper.project_id) then
    perform app.raise_error('NOT_FOUND', 'Paper not found');
  end if;
  v_project := app.require_student_project(v_paper.project_id);
  if v_paper.status <> 'candidate' then
    perform app.raise_error('INVALID_STATE', 'Only a candidate paper can be selected');
  end if;
  v_current := app.selected_paper(v_paper.project_id);
  if v_current.status = 'approved' then
    perform app.raise_error('INVALID_STATE', 'A paper is already approved. Ask your guide to withdraw it before choosing another');
  elsif v_current.status = 'submitted' then
    perform app.raise_error('INVALID_STATE', 'The selected paper is waiting for review');
  end if;
  update public.papers set is_selected = false where project_id = v_paper.project_id and is_selected and id <> p_paper_id;
  update public.papers set is_selected = true, selected_at = now() where id = p_paper_id;
  perform app.log_action('paper.selected', 'papers', p_paper_id, v_paper.project_id, v_project.semester_id);
end;
$$;

-- Withdraw a paper.
-- * Candidate: the student (or a reviewer).
-- * Approved: a reviewer until the end of the paper-change cutoff week; after that only
--   the HOD (WF-08). Work that depended on the paper is reopened, never deleted.
create or replace function public.app_withdraw_paper(p_paper_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper public.papers;
  v_project public.projects;
  v_semester public.semesters;
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform app.require_active_user();
  select * into v_paper from public.papers where id = p_paper_id;
  if not found or not app.can_view_project(v_paper.project_id) then
    perform app.raise_error('NOT_FOUND', 'Paper not found');
  end if;

  if v_paper.status = 'candidate' then
    if app.is_project_student(v_paper.project_id) then
      v_project := app.require_student_project(v_paper.project_id);
    else
      v_project := app.require_reviewer(v_paper.project_id, 'Only the student or a reviewer can withdraw this paper');
    end if;
  elsif v_paper.status = 'approved' then
    v_project := app.require_reviewer(v_paper.project_id, 'Only a reviewer of this project can withdraw an approved paper');
    select * into v_semester from public.semesters where id = v_project.semester_id;
    if not app.is_hod() and app.semester_week(v_project.semester_id) > v_semester.paper_change_cutoff_week then
      perform app.raise_error('FORBIDDEN',
        format('After week %s only the HOD can change an approved paper', v_semester.paper_change_cutoff_week));
    end if;
    v_reason := app.min_text(v_reason, 10, 'The reason', 'reason');
  elsif v_paper.status = 'submitted' then
    perform app.raise_error('INVALID_STATE', 'The paper is waiting for review and cannot be withdrawn now');
  else
    perform app.raise_error('INVALID_STATE', 'This paper is already closed');
  end if;

  update public.papers set status = 'withdrawn', is_selected = false, withdrawn_reason = v_reason where id = p_paper_id;

  if v_paper.status = 'approved' then
    -- Reopen the paper stage and everything that was built on this paper.
    perform app.set_stage_status(v_project.id, 'paper_selection', 'in_progress');
    update public.paper_analyses set status = 'superseded'
    where paper_id = p_paper_id and status <> 'superseded';
    update public.code_repositories set is_current = false where paper_id = p_paper_id and is_current;
    update public.objective_versions set status = 'superseded'
    where project_id = v_project.id and status in ('submitted', 'approved');
    update public.project_stages
    set status = 'in_progress', approved_by = null, approved_at = null, exception_reason = null
    where project_id = v_project.id and stage_key in ('paper_analysis', 'code_execution', 'objectives')
      and status <> 'not_started';
  end if;
  perform app.log_action('paper.withdrawn', 'papers', p_paper_id, v_project.id, v_project.semester_id,
    jsonb_build_object('previous_status', v_paper.status, 'reason', v_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- S3 Paper analysis (versioned, for the selected paper)
-- -----------------------------------------------------------------------------
create or replace function app.analysis_fields(p_data jsonb)
returns public.paper_analyses language plpgsql set search_path = '' as $$
declare
  v public.paper_analyses;
begin
  perform app.check_keys(p_data, array['problem_addressed', 'research_objectives', 'methodology', 'datasets', 'tools',
    'algorithms', 'reported_results', 'limitations', 'research_gaps', 'own_understanding']);
  v.problem_addressed := app.jtext(p_data, 'problem_addressed', 'Problem addressed');
  v.research_objectives := app.jtext(p_data, 'research_objectives', 'Research objectives');
  v.methodology := app.jtext(p_data, 'methodology', 'Methodology');
  v.datasets := app.jtext(p_data, 'datasets', 'Datasets');
  v.tools := app.jtext(p_data, 'tools', 'Tools');
  v.algorithms := app.jtext(p_data, 'algorithms', 'Algorithms and models');
  v.reported_results := app.jtext(p_data, 'reported_results', 'Reported results and metrics');
  v.limitations := app.jtext(p_data, 'limitations', 'Limitations');
  v.research_gaps := app.jtext(p_data, 'research_gaps', 'Research gaps');
  v.own_understanding := app.jtext(p_data, 'own_understanding', 'Own understanding');
  return v;
end;
$$;

create or replace function public.app_save_analysis(p_paper_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper public.papers;
  v_project public.projects;
  v_latest public.paper_analyses;
  v public.paper_analyses;
  v_id uuid;
begin
  select * into v_paper from public.papers where id = p_paper_id;
  if not found or not app.can_view_project(v_paper.project_id) then
    perform app.raise_error('NOT_FOUND', 'Paper not found');
  end if;
  v_project := app.require_student_project(v_paper.project_id);
  if not v_paper.is_selected then
    perform app.raise_error('INVALID_STATE', 'Analyse the selected paper; select this paper first');
  end if;
  v := app.analysis_fields(p_data);
  select * into v_latest from public.paper_analyses where paper_id = p_paper_id order by version desc limit 1;

  if not found then
    insert into public.paper_analyses (paper_id, project_id, version) values (p_paper_id, v_paper.project_id, 1)
    returning id into v_id;
  elsif v_latest.status in ('draft', 'changes_requested') then
    v_id := v_latest.id;
  elsif v_latest.status = 'approved' then
    perform app.raise_error('INVALID_STATE', 'This analysis is approved. Start a new version to change it');
  else
    perform app.raise_error('INVALID_STATE', 'The analysis is locked while it is waiting for review');
  end if;

  update public.paper_analyses set
    problem_addressed = v.problem_addressed, research_objectives = v.research_objectives, methodology = v.methodology,
    datasets = v.datasets, tools = v.tools, algorithms = v.algorithms, reported_results = v.reported_results,
    limitations = v.limitations, research_gaps = v.research_gaps, own_understanding = v.own_understanding
  where id = v_id;
  perform app.touch_stage(v_paper.project_id, 'paper_analysis');
  perform app.log_action('analysis.saved', 'paper_analyses', v_id, v_paper.project_id, v_project.semester_id);
  return v_id;
end;
$$;

create or replace function public.app_new_analysis_version(p_paper_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper public.papers;
  v_project public.projects;
  v_latest public.paper_analyses;
  v_id uuid;
begin
  select * into v_paper from public.papers where id = p_paper_id;
  if not found or not app.can_view_project(v_paper.project_id) then
    perform app.raise_error('NOT_FOUND', 'Paper not found');
  end if;
  v_project := app.require_student_project(v_paper.project_id);
  select * into v_latest from public.paper_analyses where paper_id = p_paper_id order by version desc limit 1;
  if not found or v_latest.status <> 'approved' then
    perform app.raise_error('INVALID_STATE', 'A new version can be started only from the approved analysis');
  end if;
  insert into public.paper_analyses (paper_id, project_id, version, problem_addressed, research_objectives, methodology,
    datasets, tools, algorithms, reported_results, limitations, research_gaps, own_understanding)
  values (p_paper_id, v_paper.project_id, v_latest.version + 1, v_latest.problem_addressed, v_latest.research_objectives,
    v_latest.methodology, v_latest.datasets, v_latest.tools, v_latest.algorithms, v_latest.reported_results,
    v_latest.limitations, v_latest.research_gaps, v_latest.own_understanding)
  returning id into v_id;
  perform app.log_action('analysis.new_version', 'paper_analyses', v_id, v_paper.project_id, v_project.semester_id,
    jsonb_build_object('version', v_latest.version + 1));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- S4 Repository and execution attempts
-- -----------------------------------------------------------------------------
create or replace function public.app_save_repository(p_project_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_paper public.papers := app.selected_paper(p_project_id);
  v_current public.code_repositories;
  v_url text;
  v_id uuid;
begin
  perform app.check_keys(p_data, array['repo_url', 'owner', 'name', 'commit_ref', 'language', 'framework',
    'dataset_requirements', 'environment', 'setup_instructions']);
  if v_paper.id is null then
    perform app.raise_error('GATE_NOT_MET', 'Select a paper before recording its repository');
  end if;
  if app.stage_done(p_project_id, 'code_execution') then
    perform app.raise_error('INVALID_STATE', 'Stage S4 is already complete');
  end if;
  v_url := app.jurl(p_data, 'repo_url', 'Repository link');
  if v_url is null then
    perform app.raise_error('VALIDATION', 'Repository link is required', 'repo_url');
  end if;

  select * into v_current from public.code_repositories where project_id = p_project_id and is_current;
  if found and v_current.paper_id = v_paper.id then
    if v_current.status in ('verification_pending', 'verified') then
      perform app.raise_error('INVALID_STATE', 'The repository is locked while it is waiting for verification or verified');
    end if;
    v_id := v_current.id;
  else
    -- A repository recorded for an earlier paper is kept as history.
    update public.code_repositories set is_current = false where project_id = p_project_id and is_current;
    insert into public.code_repositories (project_id, paper_id, repo_url) values (p_project_id, v_paper.id, v_url)
    returning id into v_id;
  end if;

  update public.code_repositories set
    repo_url = v_url,
    owner = app.jtext(p_data, 'owner', 'Owner', 200),
    name = app.jtext(p_data, 'name', 'Repository name', 200),
    commit_ref = app.jtext(p_data, 'commit_ref', 'Commit or release', 200),
    language = app.jtext(p_data, 'language', 'Language', 200),
    framework = app.jtext(p_data, 'framework', 'Framework', 500),
    dataset_requirements = app.jtext(p_data, 'dataset_requirements', 'Dataset requirements', 5000),
    environment = app.jtext(p_data, 'environment', 'Environment and dependencies', 5000),
    setup_instructions = app.jtext(p_data, 'setup_instructions', 'Setup instructions')
  where id = v_id;
  perform app.touch_stage(p_project_id, 'code_execution');
  perform app.log_action('repository.saved', 'code_repositories', v_id, p_project_id, v_project.semester_id);
  return v_id;
end;
$$;

-- Records one attempt to run the original code, with its evidence links
-- ([{category, url, description}]). The outcome moves the execution status among the
-- states the student controls (WORKFLOW_SPEC.md §3.3).
create or replace function public.app_record_execution_attempt(
  p_repository_id uuid,
  p_attempted_at timestamptz,
  p_outcome public.attempt_outcome,
  p_errors text default null,
  p_debugging_notes text default null,
  p_notes text default null,
  p_evidence jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_repo public.code_repositories;
  v_project public.projects;
  v_item jsonb;
  v_category text;
  v_id uuid;
begin
  select * into v_repo from public.code_repositories where id = p_repository_id;
  if not found or not app.can_view_project(v_repo.project_id) then
    perform app.raise_error('NOT_FOUND', 'Repository not found');
  end if;
  v_project := app.require_student_project(v_repo.project_id);
  if not v_repo.is_current then
    perform app.raise_error('INVALID_STATE', 'This repository has been replaced');
  end if;
  if v_repo.status in ('verification_pending', 'verified') then
    perform app.raise_error('INVALID_STATE', 'The repository is locked while it is waiting for verification or verified');
  end if;
  if p_attempted_at is null or p_attempted_at > now() + interval '10 minutes' then
    perform app.raise_error('VALIDATION', 'Give the date and time of the attempt (not in the future)', 'attempted_at');
  end if;
  if p_outcome is null then
    perform app.raise_error('VALIDATION', 'Choose the outcome', 'outcome');
  end if;
  if p_outcome in ('failed', 'blocked') then
    perform app.min_text(p_errors, 10, 'Errors encountered', 'errors');
  end if;
  if p_evidence is null or jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) > 10 then
    perform app.raise_error('VALIDATION', 'Evidence must be a list of at most 10 links', 'evidence');
  end if;

  insert into public.execution_attempts (repository_id, project_id, attempted_at, outcome, errors, debugging_notes, notes, recorded_by)
  values (p_repository_id, v_repo.project_id, p_attempted_at, p_outcome,
    app.jtext(jsonb_build_object('v', p_errors), 'v', 'Errors encountered'),
    app.jtext(jsonb_build_object('v', p_debugging_notes), 'v', 'Debugging notes'),
    app.jtext(jsonb_build_object('v', p_notes), 'v', 'Notes', 5000),
    v_uid)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_evidence) loop
    v_category := coalesce(v_item ->> 'category', 'other');
    if v_category not in ('execution_screenshot', 'execution_log', 'result_file', 'github_repository', 'other') then
      perform app.raise_error('VALIDATION', 'Evidence for an attempt must be a screenshot, log, result file, repository or other link', 'evidence');
    end if;
    insert into public.evidence (project_id, category, url, description, stage_key, linked_type, linked_id, created_by)
    values (v_repo.project_id, v_category::public.evidence_category,
      app.valid_url(nullif(btrim(v_item ->> 'url'), ''), 'Each evidence link', 'evidence'),
      app.min_text(v_item ->> 'description', 10, 'Each evidence description', 'evidence'),
      'code_execution', 'execution_attempt', v_id, v_uid);
  end loop;

  update public.code_repositories
  set status = case p_outcome
                 when 'success' then 'execution_successful'
                 when 'failed' then 'execution_failed'
                 else 'blocked_dependency_dataset' end::public.execution_status
  where id = p_repository_id;
  perform app.log_action('execution.attempt_recorded', 'execution_attempts', v_id, v_repo.project_id, v_project.semester_id,
    jsonb_build_object('outcome', p_outcome, 'evidence_count', jsonb_array_length(p_evidence)));
  return v_id;
exception
  when not_null_violation or check_violation then
    perform app.raise_error('VALIDATION', 'Each evidence link needs an https link and a description of at least 10 characters', 'evidence');
end;
$$;

-- -----------------------------------------------------------------------------
-- S5 Objective versions
-- -----------------------------------------------------------------------------
create or replace function public.app_save_objective(p_project_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_latest public.objective_versions;
  v_id uuid;
begin
  perform app.check_keys(p_data, array['original_limitations', 'research_gap', 'problem_statement', 'main_objective',
    'specific_objectives', 'contribution', 'scope', 'exclusions', 'evaluation_criteria']);
  select * into v_latest from public.objective_versions where project_id = p_project_id order by version desc limit 1;
  if not found then
    insert into public.objective_versions (project_id, version) values (p_project_id, 1) returning id into v_id;
  elsif v_latest.status in ('draft', 'changes_requested') then
    v_id := v_latest.id;
  elsif v_latest.status = 'approved' then
    perform app.raise_error('INVALID_STATE', 'These objectives are approved. Start a new version to change them');
  elsif v_latest.status = 'superseded' then
    insert into public.objective_versions (project_id, version) values (p_project_id, v_latest.version + 1) returning id into v_id;
  else
    perform app.raise_error('INVALID_STATE', 'The objectives are locked while they are waiting for review');
  end if;

  update public.objective_versions set
    original_limitations = app.jtext(p_data, 'original_limitations', 'Original limitations'),
    research_gap = app.jtext(p_data, 'research_gap', 'Research gap'),
    problem_statement = app.jtext(p_data, 'problem_statement', 'Problem statement'),
    main_objective = app.jtext(p_data, 'main_objective', 'Main objective', 5000),
    specific_objectives = app.jtext_array(p_data, 'specific_objectives', 'Specific objectives', 20, 1000),
    contribution = app.jtext(p_data, 'contribution', 'Proposed contribution'),
    scope = app.jtext(p_data, 'scope', 'Scope'),
    exclusions = app.jtext(p_data, 'exclusions', 'Exclusions'),
    evaluation_criteria = app.jtext_array(p_data, 'evaluation_criteria', 'Evaluation criteria', 30, 300)
  where id = v_id;
  perform app.touch_stage(p_project_id, 'objectives');
  perform app.log_action('objective.saved', 'objective_versions', v_id, p_project_id, v_project.semester_id);
  return v_id;
end;
$$;

create or replace function public.app_new_objective_version(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_latest public.objective_versions;
  v_id uuid;
begin
  select * into v_latest from public.objective_versions where project_id = p_project_id order by version desc limit 1;
  if not found or v_latest.status <> 'approved' then
    perform app.raise_error('INVALID_STATE', 'A new version can be started only from the approved objectives');
  end if;
  insert into public.objective_versions (project_id, version, original_limitations, research_gap, problem_statement,
    main_objective, specific_objectives, contribution, scope, exclusions, evaluation_criteria)
  values (p_project_id, v_latest.version + 1, v_latest.original_limitations, v_latest.research_gap,
    v_latest.problem_statement, v_latest.main_objective, v_latest.specific_objectives, v_latest.contribution,
    v_latest.scope, v_latest.exclusions, v_latest.evaluation_criteria)
  returning id into v_id;
  perform app.log_action('objective.new_version', 'objective_versions', v_id, p_project_id, v_project.semester_id,
    jsonb_build_object('version', v_latest.version + 1));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Evidence links for a stage
-- -----------------------------------------------------------------------------
create or replace function public.app_add_evidence(
  p_project_id uuid,
  p_stage_key public.stage_key,
  p_category public.evidence_category,
  p_url text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_id uuid;
begin
  if p_stage_key is null or p_category is null then
    perform app.raise_error('VALIDATION', 'Choose the stage and the kind of evidence');
  end if;
  if nullif(btrim(p_url), '') is null then
    perform app.raise_error('VALIDATION', 'The evidence link is required', 'url');
  end if;
  if char_length(btrim(p_description)) > 1000 then
    perform app.raise_error('VALIDATION', 'The description is longer than 1000 characters', 'description');
  end if;
  insert into public.evidence (project_id, category, url, description, stage_key, created_by)
  values (p_project_id, p_category,
    app.valid_url(btrim(p_url), 'The evidence link', 'url'),
    app.min_text(p_description, 10, 'The description', 'description'),
    p_stage_key, auth.uid())
  returning id into v_id;
  perform app.log_action('evidence.added', 'evidence', v_id, p_project_id, v_project.semester_id,
    jsonb_build_object('stage_key', p_stage_key, 'category', p_category));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Submit a stage record for review (WORKFLOW_SPEC.md §2.1 required fields).
-- -----------------------------------------------------------------------------
create or replace function app.target_project(p_target_type public.review_target, p_target_id uuid)
returns uuid language sql stable set search_path = '' as $$
  select case p_target_type
    when 'exploration' then (select project_id from public.research_explorations where id = p_target_id)
    when 'paper' then (select project_id from public.papers where id = p_target_id)
    when 'paper_analysis' then (select project_id from public.paper_analyses where id = p_target_id)
    when 'repository' then (select project_id from public.code_repositories where id = p_target_id)
    when 'objective' then (select project_id from public.objective_versions where id = p_target_id)
  end;
$$;

create or replace function public.app_submit_record(p_target_type public.review_target, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_project public.projects;
  v_semester public.semesters;
  v_open int;
  v_explore public.research_explorations;
  v_paper public.papers;
  v_analysis public.paper_analyses;
  v_repo public.code_repositories;
  v_objective public.objective_versions;
  v_stage public.stage_key;
begin
  perform app.require_active_user();
  if p_target_type not in ('exploration', 'paper', 'paper_analysis', 'repository', 'objective') then
    perform app.raise_error('VALIDATION', 'This kind of record cannot be submitted yet');
  end if;
  v_project_id := app.target_project(p_target_type, p_target_id);
  if v_project_id is null or not app.can_view_project(v_project_id) then
    perform app.raise_error('NOT_FOUND', 'Record not found');
  end if;
  v_project := app.require_student_project(v_project_id);
  select * into v_semester from public.semesters where id = v_project.semester_id;

  v_open := app.count_corrections(p_target_id, array['open']::public.correction_status[]);
  if v_open > 0 then
    perform app.raise_error('GATE_NOT_MET', format('Address the %s open correction(s) before submitting again', v_open));
  end if;

  if p_target_type = 'exploration' then
    v_stage := 'exploration';
    select * into v_explore from public.research_explorations where id = p_target_id;
    if v_explore.status not in ('draft', 'changes_requested') then
      perform app.raise_error('INVALID_STATE', 'The exploration has already been submitted');
    end if;
    perform app.require_complete(array[
      app.missing_items(v_explore.candidate_topics, 1, 'Candidate topics'),
      app.missing_items(v_explore.keywords, 3, 'Research keywords'),
      case when jsonb_array_length(v_explore.sources) < 1 then 'Sources searched' end,
      app.missing_text(v_explore.proposed_problem, 50, 'Proposed research problem')]);
    update public.research_explorations set status = 'submitted', submitted_at = now() where id = p_target_id;

  elsif p_target_type = 'paper' then
    v_stage := 'paper_selection';
    select * into v_paper from public.papers where id = p_target_id;
    if v_paper.status <> 'candidate' then
      perform app.raise_error('INVALID_STATE', 'Only a candidate paper can be submitted');
    end if;
    if not v_paper.is_selected then
      perform app.raise_error('INVALID_STATE', 'Select the paper before submitting it');
    end if;
    perform app.require_complete(array[
      app.missing_items(v_paper.authors, 1, 'Authors'),
      case when v_paper.pub_year is null then 'Publication year' end,
      app.missing_text(v_paper.venue, 1, 'Venue'),
      case when v_paper.doi is null and v_paper.url is null then 'DOI or publisher link' end,
      app.missing_text(v_paper.pdf_drive_url, 1, 'PDF Drive link'),
      app.missing_text(v_paper.abstract, 1, 'Abstract'),
      app.missing_text(v_paper.research_problem, 1, 'Research problem'),
      app.missing_text(v_paper.relevance_note, 50, 'Relevance to the domain'),
      case when v_paper.pub_year is distinct from v_semester.target_paper_year
        then app.missing_text(v_paper.foundational_justification, 30,
          format('Foundational justification (the paper is not from %s)', v_semester.target_paper_year)) end]);
    update public.papers set status = 'submitted', submitted_at = now() where id = p_target_id;

  elsif p_target_type = 'paper_analysis' then
    v_stage := 'paper_analysis';
    select * into v_analysis from public.paper_analyses where id = p_target_id;
    if v_analysis.status not in ('draft', 'changes_requested') then
      perform app.raise_error('INVALID_STATE', 'This analysis version has already been submitted');
    end if;
    if not exists (select 1 from public.papers where id = v_analysis.paper_id and is_selected) then
      perform app.raise_error('INVALID_STATE', 'This analysis is for a paper that is no longer selected');
    end if;
    perform app.require_complete(array[
      app.missing_text(v_analysis.problem_addressed, 1, 'Problem addressed'),
      app.missing_text(v_analysis.research_objectives, 1, 'Research objectives'),
      app.missing_text(v_analysis.methodology, 1, 'Methodology'),
      app.missing_text(v_analysis.datasets, 1, 'Datasets'),
      app.missing_text(v_analysis.tools, 1, 'Tools'),
      app.missing_text(v_analysis.algorithms, 1, 'Algorithms and models'),
      app.missing_text(v_analysis.reported_results, 1, 'Reported results and metrics'),
      app.missing_text(v_analysis.limitations, 1, 'Limitations'),
      app.missing_text(v_analysis.research_gaps, 1, 'Research gaps'),
      app.missing_text(v_analysis.own_understanding, 150, 'Own understanding')]);
    update public.paper_analyses set status = 'submitted', submitted_at = now() where id = p_target_id;

  elsif p_target_type = 'repository' then
    v_stage := 'code_execution';
    select * into v_repo from public.code_repositories where id = p_target_id;
    if not v_repo.is_current or v_repo.status in ('verification_pending', 'verified') then
      perform app.raise_error('INVALID_STATE', 'This repository cannot be submitted now');
    end if;
    perform app.require_complete(array[
      app.missing_text(v_repo.owner, 1, 'Owner'),
      app.missing_text(v_repo.name, 1, 'Repository name'),
      app.missing_text(v_repo.language, 1, 'Language'),
      app.missing_text(v_repo.framework, 1, 'Framework'),
      app.missing_text(v_repo.dataset_requirements, 1, 'Dataset requirements'),
      app.missing_text(v_repo.environment, 1, 'Environment and dependencies'),
      app.missing_text(v_repo.setup_instructions, 1, 'Setup instructions')]);
    -- WF-01: verification needs a successful attempt that has evidence.
    if not exists (select 1 from public.execution_attempts a
                   where a.repository_id = p_target_id and a.outcome = 'success'
                     and exists (select 1 from public.evidence e
                                 where e.linked_type = 'execution_attempt' and e.linked_id = a.id)) then
      perform app.raise_error('GATE_NOT_MET', 'Record a successful execution attempt with evidence before asking for verification');
    end if;
    update public.code_repositories set status = 'verification_pending', submitted_at = now() where id = p_target_id;

  else
    v_stage := 'objectives';
    select * into v_objective from public.objective_versions where id = p_target_id;
    if v_objective.status not in ('draft', 'changes_requested') then
      perform app.raise_error('INVALID_STATE', 'This objective version has already been submitted');
    end if;
    perform app.require_complete(array[
      app.missing_text(v_objective.original_limitations, 1, 'Original limitations'),
      app.missing_text(v_objective.research_gap, 1, 'Research gap'),
      app.missing_text(v_objective.problem_statement, 1, 'Problem statement'),
      app.missing_text(v_objective.main_objective, 1, 'Main objective'),
      app.missing_items(v_objective.specific_objectives, 2, 'Specific objectives'),
      app.missing_text(v_objective.contribution, 1, 'Proposed contribution'),
      app.missing_text(v_objective.scope, 1, 'Scope'),
      app.missing_text(v_objective.exclusions, 1, 'Exclusions'),
      app.missing_items(v_objective.evaluation_criteria, 1, 'Evaluation criteria')]);
    update public.objective_versions set status = 'submitted', submitted_at = now() where id = p_target_id;
  end if;

  -- An earlier approved version stays in force while a newer one is reviewed.
  if not app.stage_done(v_project_id, v_stage) then
    perform app.set_stage_status(v_project_id, v_stage, 'awaiting_approval');
  end if;
  perform app.log_action('record.submitted',
    case p_target_type when 'exploration' then 'research_explorations' when 'paper' then 'papers'
      when 'paper_analysis' then 'paper_analyses' when 'repository' then 'code_repositories'
      else 'objective_versions' end, p_target_id, v_project_id, v_project.semester_id,
    jsonb_build_object('target_type', p_target_type));
end;
$$;

-- -----------------------------------------------------------------------------
-- Corrections: the student responds (open → addressed)
-- -----------------------------------------------------------------------------
create or replace function public.app_address_correction(p_correction_id uuid, p_response text, p_evidence_ids uuid[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correction public.corrections;
  v_project public.projects;
  v_response text;
begin
  select * into v_correction from public.corrections where id = p_correction_id;
  if not found or not app.can_view_project(v_correction.project_id) then
    perform app.raise_error('NOT_FOUND', 'Correction not found');
  end if;
  v_project := app.require_student_project(v_correction.project_id);
  if v_correction.status <> 'open' then
    perform app.raise_error('INVALID_STATE', 'Only an open correction can be marked as addressed');
  end if;
  v_response := app.min_text(p_response, 10, 'Your response', 'response');
  if char_length(v_response) > 5000 then
    perform app.raise_error('VALIDATION', 'Your response is longer than 5000 characters', 'response');
  end if;
  if exists (select 1 from unnest(coalesce(p_evidence_ids, '{}')) e(id)
             where not exists (select 1 from public.evidence where id = e.id and project_id = v_correction.project_id)) then
    perform app.raise_error('VALIDATION', 'Evidence must belong to this project', 'evidence_ids');
  end if;
  update public.corrections
  set status = 'addressed', student_response = v_response, response_evidence = coalesce(p_evidence_ids, '{}'),
      addressed_at = now()
  where id = p_correction_id;
  perform app.log_action('correction.addressed', 'corrections', p_correction_id, v_correction.project_id, v_project.semester_id);
end;
$$;
