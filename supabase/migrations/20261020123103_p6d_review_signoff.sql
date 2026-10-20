-- Phase 6 — S6–S9 (part D: submitting and reviewing S7–S9, and the panel sign-off)
-- Specs: WORKFLOW_SPEC.md §2 (gates), §7 (final sign-off), API_SPEC.md §4.5.
-- Targets: 'evaluation' and 'final' are reviewed per project (target_id = project id);
-- 'draft_section' per section version.

create or replace function app.target_project(p_target_type public.review_target, p_target_id uuid)
returns uuid language sql stable set search_path = '' as $$
  select case p_target_type
    when 'exploration' then (select project_id from public.research_explorations where id = p_target_id)
    when 'paper' then (select project_id from public.papers where id = p_target_id)
    when 'paper_analysis' then (select project_id from public.paper_analyses where id = p_target_id)
    when 'repository' then (select project_id from public.code_repositories where id = p_target_id)
    when 'objective' then (select project_id from public.objective_versions where id = p_target_id)
    when 'task_submission' then (select project_id from public.submissions where id = p_target_id)
    when 'draft_section' then (select project_id from public.paper_drafts where id = p_target_id)
    when 'evaluation' then (select id from public.projects where id = p_target_id)
    when 'final' then (select id from public.projects where id = p_target_id)
  end;
$$;

create or replace function app.awaiting_review(p_target_type public.review_target, p_target_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select case p_target_type
    when 'exploration' then exists (select 1 from public.research_explorations where id = p_target_id and status = 'submitted')
    when 'paper' then exists (select 1 from public.papers where id = p_target_id and status = 'submitted')
    when 'paper_analysis' then exists (select 1 from public.paper_analyses where id = p_target_id and status = 'submitted')
    when 'repository' then exists (select 1 from public.code_repositories
                                   where id = p_target_id and is_current and status = 'verification_pending')
    when 'objective' then exists (select 1 from public.objective_versions where id = p_target_id and status = 'submitted')
    when 'task_submission' then exists (
      select 1 from public.submissions s join public.tasks k on k.id = s.task_id
      where s.id = p_target_id and k.is_active and k.status in ('submitted', 'resubmitted', 'under_review')
        and s.version = (select max(version) from public.submissions where task_id = s.task_id))
    when 'draft_section' then exists (select 1 from public.paper_drafts where id = p_target_id and status = 'submitted')
    when 'evaluation' then exists (select 1 from public.evaluation_results where project_id = p_target_id and status = 'submitted')
    when 'final' then exists (select 1 from public.project_stages
                              where project_id = p_target_id and stage_key = 'final' and status = 'awaiting_approval')
    else false
  end;
$$;

-- Corrections on one record. Evaluation and final share the project id as target, so the
-- target type is part of the match.
create or replace function app.count_target_corrections(
  p_target_type public.review_target,
  p_target_id uuid,
  p_statuses public.correction_status[]
)
returns int language sql stable set search_path = '' as $$
  select count(*)::int from public.corrections
  where target_type = p_target_type and target_id = p_target_id and status = any (p_statuses);
$$;

-- -----------------------------------------------------------------------------
-- Panel sign-off (WF-05, WF-06)
-- * Only an active member of the project's panel; only after the student submitted S9.
-- * approve: S7 and S8 approved, every checklist item verified, no open or addressed
--   correction anywhere in the project. When the approvals reach the quorum (default:
--   every member), S9 is approved and the project is completed.
-- * changes_required: needs at least one correction; S9 returns to the student.
-- A member's later decision replaces the earlier one (the audit log keeps both).
-- -----------------------------------------------------------------------------
create or replace function public.app_record_signoff(
  p_project_id uuid,
  p_decision public.signoff_decision,
  p_originality_remark text,
  p_comments text default null,
  p_corrections text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_project public.projects;
  v_semester public.semesters;
  v_remark text;
  v_comments text := nullif(btrim(p_comments), '');
  v_corrections text[];
  v_count int;
  v_members int;
  v_quorum int;
  v_approvals int;
  v_signoff uuid;
  v_review uuid;
begin
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or not app.can_view_project(p_project_id) then
    perform app.raise_error('NOT_FOUND', 'Project not found');
  end if;
  if not app.is_panel_member_for(p_project_id) then
    perform app.raise_error('FORBIDDEN', 'Only a member of this project''s panel can sign off');
  end if;
  v_semester := app.require_open_semester(v_project.semester_id);
  if p_decision is null then
    perform app.raise_error('VALIDATION', 'Choose approve or changes required', 'decision');
  end if;
  if not app.awaiting_review('final', p_project_id) then
    perform app.raise_error('INVALID_STATE', 'The student has not submitted the final checklist for sign-off');
  end if;
  v_remark := app.min_text(p_originality_remark, 10, 'The originality remark', 'originality_remark');
  if char_length(v_remark) > 2000 or char_length(v_comments) > 5000 then
    perform app.raise_error('VALIDATION', 'The remark or comments are too long');
  end if;
  select coalesce(array_agg(btrim(c) order by n), '{}') into v_corrections
  from unnest(coalesce(p_corrections, '{}')) with ordinality as t(c, n) where btrim(c) <> '';
  if exists (select 1 from unnest(v_corrections) c where char_length(c) not between 3 and 2000) then
    perform app.raise_error('VALIDATION', 'Each correction must be 3–2000 characters', 'corrections');
  end if;

  if p_decision = 'approve' then
    if not (app.stage_done(p_project_id, 'evaluation') and app.stage_done(p_project_id, 'paper_writing')) then
      perform app.raise_error('GATE_NOT_MET', 'S7 evaluation and S8 paper writing must be approved');
    end if;
    select count(*) into v_count from app.required_deliverables(p_project_id) d where d.verification <> 'verified';
    if v_count > 0 then
      perform app.raise_error('GATE_NOT_MET', format('%s checklist item(s) are not verified yet', v_count));
    end if;
    select count(*) into v_count from public.corrections
    where project_id = p_project_id and status in ('open', 'addressed');
    if v_count > 0 then
      perform app.raise_error('GATE_NOT_MET', format('%s correction(s) in this project are still open or addressed', v_count));
    end if;
    if cardinality(v_corrections) > 0 then
      perform app.raise_error('VALIDATION', 'An approval cannot add corrections', 'corrections');
    end if;
  elsif cardinality(v_corrections) = 0 then
    perform app.raise_error('VALIDATION', 'List at least one correction when changes are required', 'corrections');
  end if;

  insert into public.final_signoffs as f (project_id, panel_member_id, decision, originality_remark, comments)
  values (p_project_id, v_uid, p_decision, v_remark, v_comments)
  on conflict (project_id, panel_member_id) do update
    set decision = excluded.decision, originality_remark = excluded.originality_remark, comments = excluded.comments
  returning f.id into v_signoff;

  insert into public.reviews (project_id, target_type, target_id, reviewer_id, outcome, observations, comments)
  values (p_project_id, 'final', p_project_id, v_uid,
          case when p_decision = 'approve' then 'accepted' else 'changes_requested' end::public.review_outcome,
          'Originality: ' || v_remark, v_comments)
  returning id into v_review;
  insert into public.corrections (review_id, project_id, target_type, target_id, description)
  select v_review, p_project_id, 'final', p_project_id, c from unnest(v_corrections) c;

  if p_decision = 'changes_required' then
    perform app.set_stage_status(p_project_id, 'final', 'changes_requested');
  else
    select count(*) into v_members
    from public.panel_projects pp
    join public.panels p on p.id = pp.panel_id and p.is_active
    join public.panel_members m on m.panel_id = p.id and m.is_active
    where pp.project_id = p_project_id and pp.is_active;
    v_quorum := least(coalesce(v_semester.panel_quorum, v_members), v_members);
    select count(*) into v_approvals
    from public.final_signoffs f
    join public.panel_members m on m.user_id = f.panel_member_id and m.is_active
    join public.panel_projects pp on pp.panel_id = m.panel_id and pp.project_id = f.project_id and pp.is_active
    where f.project_id = p_project_id and f.decision = 'approve';
    if v_approvals >= v_quorum then
      perform app.set_stage_status(p_project_id, 'final', 'approved');
      update public.projects set is_completed = true, completed_at = now() where id = p_project_id;
      perform app.log_action('project.completed', 'projects', p_project_id, p_project_id, v_project.semester_id,
        jsonb_build_object('approvals', v_approvals, 'quorum', v_quorum));
    end if;
  end if;
  perform app.log_action('signoff.recorded', 'final_signoffs', v_signoff, p_project_id, v_project.semester_id,
    jsonb_build_object('decision', p_decision, 'corrections', cardinality(v_corrections)));
  return v_signoff;
end;
$$;

-- -----------------------------------------------------------------------------
-- Submitting a record now also covers S7 results, S8 sections and the S9 checklist
-- (replaces the Phase 4 version).
-- -----------------------------------------------------------------------------
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
  v_draft public.paper_drafts;
  v_missing text;
begin
  perform app.require_active_user();
  if p_target_type not in ('exploration', 'paper', 'paper_analysis', 'repository', 'objective',
                           'evaluation', 'draft_section', 'final') then
    perform app.raise_error('VALIDATION', 'This kind of record cannot be submitted yet');
  end if;
  v_project_id := app.target_project(p_target_type, p_target_id);
  if v_project_id is null or not app.can_view_project(v_project_id) then
    perform app.raise_error('NOT_FOUND', 'Record not found');
  end if;
  v_project := app.require_student_project(v_project_id);
  select * into v_semester from public.semesters where id = v_project.semester_id;

  v_open := app.count_target_corrections(p_target_type, p_target_id, array['open']::public.correction_status[]);
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

  elsif p_target_type = 'evaluation' then
    -- The whole set of results is reviewed together (target = the project).
    v_stage := 'evaluation';
    if app.stage_done(v_project_id, 'evaluation') then
      perform app.raise_error('INVALID_STATE', 'Stage S7 is already complete');
    end if;
    if exists (select 1 from public.evaluation_results where project_id = v_project_id and status = 'submitted') then
      perform app.raise_error('INVALID_STATE', 'The results have already been submitted');
    end if;
    if not exists (select 1 from public.evaluation_results where project_id = v_project_id and status in ('draft', 'changes_requested')) then
      perform app.raise_error('VALIDATION', 'Add your test results before submitting');
    end if;
    perform app.require_complete(array[
      case when not exists (select 1 from public.evaluation_results where project_id = v_project_id and kind = 'baseline')
        then 'At least one baseline result (the original work)' end,
      case when not exists (select 1 from public.evaluation_results where project_id = v_project_id and kind = 'proposed')
        then 'At least one proposed result (your work)' end]);
    update public.evaluation_results set status = 'submitted', submitted_at = now()
    where project_id = v_project_id and status in ('draft', 'changes_requested');

  elsif p_target_type = 'draft_section' then
    v_stage := 'paper_writing';
    select * into v_draft from public.paper_drafts where id = p_target_id;
    if v_draft.status not in ('draft', 'changes_requested') then
      perform app.raise_error('INVALID_STATE', 'This section version has already been submitted');
    end if;
    perform app.require_complete(array[app.missing_text(v_draft.doc_url, 1, 'Document link')]);
    update public.paper_drafts set status = 'submitted', submitted_at = now() where id = p_target_id;

  elsif p_target_type = 'final' then
    v_stage := 'final';
    if exists (select 1 from public.project_stages where project_id = v_project_id and stage_key = 'final'
               and status in ('awaiting_approval', 'approved')) then
      perform app.raise_error('INVALID_STATE', 'The final checklist has already been submitted');
    end if;
    if not (app.stage_done(v_project_id, 'evaluation') and app.stage_done(v_project_id, 'paper_writing')) then
      perform app.raise_error('GATE_NOT_MET', 'S7 evaluation and S8 paper writing must be approved first');
    end if;
    perform app.ensure_deliverables(v_project_id);
    select string_agg(replace(d.item::text, '_', ' '), ', ' order by d.item) into v_missing
    from app.required_deliverables(v_project_id) d where d.evidence_id is null;
    if v_missing is not null then
      perform app.raise_error('VALIDATION', 'Add these checklist items first: ' || v_missing, 'deliverables');
    end if;
    if not exists (select 1 from public.panel_projects pp join public.panels p on p.id = pp.panel_id and p.is_active
                   where pp.project_id = v_project_id and pp.is_active) then
      perform app.raise_error('GATE_NOT_MET', 'The HOD has not assigned this project to a panel yet');
    end if;

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
      when 'evaluation' then 'evaluation_results' when 'draft_section' then 'paper_drafts'
      when 'final' then 'final_deliverables' else 'objective_versions' end, p_target_id, v_project_id, v_project.semester_id,
    jsonb_build_object('target_type', p_target_type));
end;
$$;

-- -----------------------------------------------------------------------------
-- Reviews now also cover S7 results and S8 sections; S9 decisions go through the sign-off
-- (replaces the Phase 5 version).
-- -----------------------------------------------------------------------------
create or replace function public.app_record_review(
  p_target_type public.review_target,
  p_target_id uuid,
  p_outcome public.review_outcome,
  p_observations text default null,
  p_comments text default null,
  p_corrections text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_project_id uuid;
  v_project public.projects;
  v_observations text := nullif(btrim(p_observations), '');
  v_comments text := nullif(btrim(p_comments), '');
  v_corrections text[];
  v_pending int;
  v_paper public.papers;
  v_review_id uuid;
  v_accepted boolean := p_outcome = 'accepted';
  v_task public.tasks;
  v_draft public.paper_drafts;
begin
  if p_target_type is null then
    perform app.raise_error('VALIDATION', 'Choose what is reviewed', 'target_type');
  end if;
  if p_target_type = 'final' and p_outcome is distinct from 'comment_only' then
    perform app.raise_error('VALIDATION', 'Final decisions are recorded by the panel in the sign-off');
  end if;
  if p_outcome is null then
    perform app.raise_error('VALIDATION', 'Choose the outcome', 'outcome');
  end if;
  v_project_id := app.target_project(p_target_type, p_target_id);
  if v_project_id is null or not app.can_view_project(v_project_id) then
    perform app.raise_error('NOT_FOUND', 'Record not found');
  end if;
  select * into v_project from public.projects where id = v_project_id for update;
  perform app.require_open_semester(v_project.semester_id);

  select coalesce(array_agg(btrim(c) order by n), '{}') into v_corrections
  from unnest(coalesce(p_corrections, '{}')) with ordinality as t(c, n) where btrim(c) <> '';
  if exists (select 1 from unnest(v_corrections) c where char_length(c) not between 3 and 2000) then
    perform app.raise_error('VALIDATION', 'Each correction must be 3–2000 characters', 'corrections');
  end if;
  if char_length(v_observations) > 10000 or char_length(v_comments) > 10000 then
    perform app.raise_error('VALIDATION', 'Observations and comments are limited to 10000 characters');
  end if;

  if p_outcome = 'comment_only' then
    if not app.is_faculty_level(v_project.semester_id) then
      perform app.raise_error('FORBIDDEN', 'Only faculty can comment on a project');
    end if;
    if cardinality(v_corrections) > 0 then
      perform app.raise_error('VALIDATION', 'A comment cannot create corrections; record "changes requested" instead', 'corrections');
    end if;
    if v_observations is null and v_comments is null then
      perform app.raise_error('VALIDATION', 'Write the comment', 'comments');
    end if;
  else
    if not app.is_project_reviewer(v_project_id) then
      perform app.raise_error('FORBIDDEN', 'Only a reviewer of this project can accept, request changes or reject');
    end if;
    if not app.awaiting_review(p_target_type, p_target_id) then
      perform app.raise_error('INVALID_STATE', 'Only work that is waiting for review can be decided');
    end if;
    if p_outcome = 'changes_requested' and cardinality(v_corrections) = 0 then
      perform app.raise_error('VALIDATION', 'List at least one correction when requesting changes', 'corrections');
    end if;
    if p_outcome = 'rejected' and v_observations is null then
      perform app.raise_error('VALIDATION', 'Give the reason for rejecting in the observations', 'observations');
    end if;
    if v_accepted then
      v_pending := case when p_target_type = 'task_submission'
        then app.count_task_corrections(p_target_id, array['open', 'addressed']::public.correction_status[])
        else app.count_target_corrections(p_target_type, p_target_id, array['open', 'addressed']::public.correction_status[]) end;
      if v_pending > 0 then
        perform app.raise_error('GATE_NOT_MET', format('Verify or waive the %s outstanding correction(s) before accepting', v_pending));
      end if;
    end if;
  end if;

  insert into public.reviews (project_id, target_type, target_id, reviewer_id, outcome, observations, comments)
  values (v_project_id, p_target_type, p_target_id, v_uid, p_outcome, v_observations, v_comments)
  returning id into v_review_id;

  if p_outcome <> 'comment_only' then
    if p_target_type = 'exploration' then
      update public.research_explorations
      set status = case when v_accepted then 'approved' else 'changes_requested' end::public.record_status,
          decided_by = v_uid, decided_at = now()
      where id = p_target_id;
      perform app.set_stage_status(v_project_id, 'exploration',
        case when v_accepted then 'approved' else 'changes_requested' end::public.stage_status);

    elsif p_target_type = 'paper' then
      select * into v_paper from public.papers where id = p_target_id;
      if v_accepted and app.duplicate_paper_exists(v_paper) and v_paper.duplicate_override_reason is null then
        perform app.raise_error('DUPLICATE_PAPER',
          'Another project in this semester already has this paper approved (same DOI or title). The HOD can override this with a reason');
      end if;
      update public.papers
      set status = case p_outcome when 'accepted' then 'approved' when 'rejected' then 'rejected' else 'candidate' end::public.paper_status,
          is_selected = p_outcome <> 'rejected',
          decided_by = v_uid, decided_at = now()
      where id = p_target_id;
      perform app.set_stage_status(v_project_id, 'paper_selection',
        case when v_accepted then 'approved' else 'changes_requested' end::public.stage_status);

    elsif p_target_type = 'paper_analysis' then
      perform app.decide_version('paper_analyses', p_target_id, v_project_id, 'paper_analysis', v_accepted);

    elsif p_target_type = 'repository' then
      update public.code_repositories
      set status = case when v_accepted then 'verified' else 'environment_setup' end::public.execution_status,
          decided_by = v_uid, decided_at = now()
      where id = p_target_id;
      perform app.set_stage_status(v_project_id, 'code_execution',
        case when v_accepted then 'approved' else 'changes_requested' end::public.stage_status);

    elsif p_target_type = 'objective' then
      perform app.decide_version('objective_versions', p_target_id, v_project_id, 'objectives', v_accepted);

    elsif p_target_type = 'evaluation' then
      update public.evaluation_results
      set status = case when v_accepted then 'approved' else 'changes_requested' end::public.record_status,
          decided_by = v_uid, decided_at = now()
      where project_id = v_project_id and status = 'submitted';
      perform app.set_stage_status(v_project_id, 'evaluation',
        case when v_accepted then 'approved' else 'changes_requested' end::public.stage_status);

    elsif p_target_type = 'draft_section' then
      select * into v_draft from public.paper_drafts where id = p_target_id;
      if v_accepted then
        update public.paper_drafts set status = 'superseded'
        where project_id = v_project_id and section = v_draft.section and status = 'approved';
        update public.paper_drafts set status = 'approved', decided_by = v_uid, decided_at = now() where id = p_target_id;
        -- S8 is complete when all ten sections are approved (and S5 is).
        if app.stage_done(v_project_id, 'objectives') and not app.stage_done(v_project_id, 'paper_writing')
           and (select count(distinct section) from public.paper_drafts
                where project_id = v_project_id and status = 'approved') = cardinality(enum_range(null::public.draft_section)) then
          perform app.set_stage_status(v_project_id, 'paper_writing', 'approved');
        end if;
      else
        update public.paper_drafts set status = 'changes_requested', decided_by = v_uid, decided_at = now() where id = p_target_id;
        if not app.stage_done(v_project_id, 'paper_writing') then
          perform app.set_stage_status(v_project_id, 'paper_writing', 'changes_requested');
        end if;
      end if;

    else
      -- A task submission: accepted → task verified; otherwise the student revises and resubmits.
      select k.* into v_task from public.tasks k join public.submissions s on s.task_id = k.id where s.id = p_target_id;
      update public.tasks
      set status = case when v_accepted then 'verified' else 'changes_requested' end::public.task_status
      where id = v_task.id;
      -- S6 is complete when every one of its tasks is verified (WORKFLOW_SPEC.md §2).
      if v_accepted and v_task.stage_key = 'implementation' and app.stage_done(v_project_id, 'objectives')
         and not app.stage_done(v_project_id, 'implementation')
         and not exists (select 1 from public.tasks where project_id = v_project_id and stage_key = 'implementation'
                         and is_active and status <> 'verified') then
        perform app.set_stage_status(v_project_id, 'implementation', 'approved');
      end if;
    end if;
  end if;

  insert into public.corrections (review_id, project_id, target_type, target_id, description)
  select v_review_id, v_project_id, p_target_type, p_target_id, c from unnest(v_corrections) c;

  perform app.log_action('review.recorded', 'reviews', v_review_id, v_project_id, v_project.semester_id,
    jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id, 'outcome', p_outcome,
                       'corrections', cardinality(v_corrections)));
  return v_review_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Corrections: panel members may resolve sign-off corrections (replaces the Phase 4 version).
-- -----------------------------------------------------------------------------
create or replace function public.app_resolve_correction(p_correction_id uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_correction public.corrections;
  v_project public.projects;
  v_note text := nullif(btrim(p_note), '');
  v_new public.correction_status;
begin
  perform app.require_active_user();
  select * into v_correction from public.corrections where id = p_correction_id;
  if not found or not app.can_view_project(v_correction.project_id) then
    perform app.raise_error('NOT_FOUND', 'Correction not found');
  end if;
  -- Panel members also resolve the corrections they raised at sign-off.
  if v_correction.target_type = 'final' and app.is_panel_member_for(v_correction.project_id) then
    select * into v_project from public.projects where id = v_correction.project_id for update;
    perform app.require_open_semester(v_project.semester_id);
  else
    v_project := app.require_reviewer(v_correction.project_id, 'Only a reviewer of this project can resolve corrections');
  end if;
  if p_action not in ('verify', 'reopen', 'waive') or p_action is null then
    perform app.raise_error('VALIDATION', 'The action must be verify, reopen or waive', 'action');
  end if;
  if p_action in ('reopen', 'waive') then
    v_note := app.min_text(v_note, 5, 'A note', 'note');
  end if;
  if char_length(v_note) > 2000 then
    perform app.raise_error('VALIDATION', 'The note is longer than 2000 characters', 'note');
  end if;

  if p_action = 'verify' and v_correction.status = 'addressed' then
    v_new := 'verified';
  elsif p_action = 'reopen' and v_correction.status = 'addressed' then
    v_new := 'open';
  elsif p_action = 'waive' and v_correction.status in ('open', 'addressed') then
    v_new := 'waived';
  else
    perform app.raise_error('INVALID_STATE',
      format('A correction that is %s cannot be %s', v_correction.status,
             case p_action when 'verify' then 'verified' when 'reopen' then 'reopened' else 'waived' end));
  end if;

  update public.corrections
  set status = v_new, resolution_note = v_note,
      resolved_by = case when v_new = 'open' then null else auth.uid() end,
      resolved_at = case when v_new = 'open' then null else now() end
  where id = p_correction_id;
  perform app.log_action('correction.' || p_action, 'corrections', p_correction_id, v_correction.project_id,
    v_project.semester_id, jsonb_build_object('from', v_correction.status, 'to', v_new, 'note', v_note));
end;
$$;
