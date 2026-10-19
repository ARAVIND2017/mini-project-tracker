-- Phase 4 — Research stages S1–S5 (part E: reviews, corrections, evidence, exceptions)
-- Specs: WORKFLOW_SPEC.md §3, API_SPEC.md §4.4, USER_ROLES_AND_PERMISSIONS.md §2.3.
-- Faculty decide; the system only records and enforces the rules. Nothing here grades.

-- Whether the record is waiting for a reviewer's decision.
create or replace function app.awaiting_review(p_target_type public.review_target, p_target_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select case p_target_type
    when 'exploration' then exists (select 1 from public.research_explorations where id = p_target_id and status = 'submitted')
    when 'paper' then exists (select 1 from public.papers where id = p_target_id and status = 'submitted')
    when 'paper_analysis' then exists (select 1 from public.paper_analyses where id = p_target_id and status = 'submitted')
    when 'repository' then exists (select 1 from public.code_repositories
                                   where id = p_target_id and is_current and status = 'verification_pending')
    when 'objective' then exists (select 1 from public.objective_versions where id = p_target_id and status = 'submitted')
    else false
  end;
$$;

-- Another project in the same semester already has this paper approved (same DOI or
-- same normalized title) — DATA-06.
create or replace function app.duplicate_paper_exists(p_paper public.papers)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.papers other
    join public.projects op on op.id = other.project_id
    where op.semester_id = (select semester_id from public.projects where id = p_paper.project_id)
      and other.project_id <> p_paper.project_id
      and other.status = 'approved'
      and ((p_paper.doi is not null and other.doi = p_paper.doi)
           or other.title_normalized = p_paper.title_normalized));
$$;

-- Applies a decision to a versioned record (analysis or objectives): the newly approved
-- version replaces the earlier approved one; while an approved version exists, a
-- rejected newer version does not reopen the stage.
create or replace function app.decide_version(
  p_table text,
  p_target_id uuid,
  p_project_id uuid,
  p_stage public.stage_key,
  p_accepted boolean
)
returns void language plpgsql set search_path = '' as $$
begin
  if p_accepted then
    execute format('update public.%I set status = ''superseded'' where project_id = $1 and status = ''approved''', p_table)
      using p_project_id;
    execute format('update public.%I set status = ''approved'', decided_by = auth.uid(), decided_at = now() where id = $1', p_table)
      using p_target_id;
    perform app.set_stage_status(p_project_id, p_stage, 'approved');
  else
    execute format('update public.%I set status = ''changes_requested'', decided_by = auth.uid(), decided_at = now() where id = $1', p_table)
      using p_target_id;
    if not app.stage_done(p_project_id, p_stage) then
      perform app.set_stage_status(p_project_id, p_stage, 'changes_requested');
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Record a review (API_SPEC.md §4.4)
-- * comment_only: any faculty-level user of the semester; changes nothing.
-- * accepted / changes_requested / rejected: a reviewer of the project (SEC-07),
--   only for a record that is waiting for review.
-- * changes_requested needs at least one correction (WF-03); rejected needs a reason.
-- * accepted needs every correction on the record verified or waived, and the stages
--   it depends on approved (GATE_NOT_MET); papers also pass the duplicate check.
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
begin
  if p_target_type not in ('exploration', 'paper', 'paper_analysis', 'repository', 'objective') then
    perform app.raise_error('VALIDATION', 'Reviews of this kind of record are not available yet');
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
      v_pending := app.count_corrections(p_target_id, array['open', 'addressed']::public.correction_status[]);
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

    else
      perform app.decide_version('objective_versions', p_target_id, v_project_id, 'objectives', v_accepted);
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
-- Corrections: reviewer verifies, reopens or waives (WORKFLOW_SPEC.md §3.5, WF-04)
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
  v_project := app.require_reviewer(v_correction.project_id, 'Only a reviewer of this project can resolve corrections');
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

-- -----------------------------------------------------------------------------
-- Evidence verification by a reviewer
-- -----------------------------------------------------------------------------
create or replace function public.app_verify_evidence(
  p_evidence_id uuid,
  p_verification public.evidence_verification,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence public.evidence;
  v_project public.projects;
  v_note text := nullif(btrim(p_note), '');
begin
  perform app.require_active_user();
  select * into v_evidence from public.evidence where id = p_evidence_id;
  if not found or not app.can_view_project(v_evidence.project_id) then
    perform app.raise_error('NOT_FOUND', 'Evidence not found');
  end if;
  v_project := app.require_reviewer(v_evidence.project_id, 'Only a reviewer of this project can verify evidence');
  if p_verification is null or p_verification = 'unverified' then
    perform app.raise_error('VALIDATION', 'Choose verified, rejected or not accessible', 'verification');
  end if;
  if p_verification in ('rejected', 'inaccessible') then
    v_note := app.min_text(v_note, 5, 'A note', 'note');
  end if;
  if char_length(v_note) > 1000 then
    perform app.raise_error('VALIDATION', 'The note is longer than 1000 characters', 'note');
  end if;
  update public.evidence
  set verification = p_verification, verified_by = auth.uid(), verified_at = now(), verification_note = v_note
  where id = p_evidence_id;
  perform app.log_action('evidence.' || p_verification, 'evidence', p_evidence_id, v_evidence.project_id,
    v_project.semester_id, jsonb_build_object('note', v_note));
end;
$$;

-- -----------------------------------------------------------------------------
-- Stage exception: S4 when the paper has no usable public code (WORKFLOW_SPEC.md §3.3).
-- The guide, the lead or the HOD; the reimplementation is then tracked in S6.
-- -----------------------------------------------------------------------------
create or replace function public.app_approve_stage_exception(p_project_id uuid, p_stage_key public.stage_key, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_project public.projects;
  v_reason text;
begin
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or not app.can_view_project(p_project_id) then
    perform app.raise_error('NOT_FOUND', 'Project not found');
  end if;
  if not (app.is_hod() or app.is_lead(v_project.semester_id)
          or (v_project.guide_id = v_uid and app.is_faculty_member(v_uid, v_project.semester_id))) then
    perform app.raise_error('FORBIDDEN', 'Only the guide, the lead faculty or the HOD can approve an exception');
  end if;
  perform app.require_open_semester(v_project.semester_id);
  if p_stage_key is distinct from 'code_execution' then
    perform app.raise_error('VALIDATION', 'Only stage S4 (original code execution) can have an exception', 'stage_key');
  end if;
  if app.stage_done(p_project_id, p_stage_key) then
    perform app.raise_error('INVALID_STATE', 'This stage is already complete');
  end if;
  v_reason := app.min_text(p_reason, 20, 'The reason', 'reason');
  if char_length(v_reason) > 2000 then
    perform app.raise_error('VALIDATION', 'The reason is longer than 2000 characters', 'reason');
  end if;
  perform app.set_stage_status(p_project_id, p_stage_key, 'exception_approved', v_reason);
  perform app.log_action('stage.exception_approved', 'project_stages', p_project_id, p_project_id, v_project.semester_id,
    jsonb_build_object('stage_key', p_stage_key, 'reason', v_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- HOD overrides (API_SPEC.md §4.4): the duplicate-paper check, and the
-- "objectives approved" gate for S6 tasks (used from Phase 5). Always with a reason.
-- -----------------------------------------------------------------------------
create or replace function public.app_override(p_project_id uuid, p_kind text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_project public.projects;
  v_paper public.papers;
  v_reason text;
begin
  if not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can override a rule');
  end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    perform app.raise_error('NOT_FOUND', 'Project not found');
  end if;
  perform app.require_open_semester(v_project.semester_id);
  v_reason := app.min_text(p_reason, 10, 'The reason', 'reason');
  if char_length(v_reason) > 2000 then
    perform app.raise_error('VALIDATION', 'The reason is longer than 2000 characters', 'reason');
  end if;

  if p_kind = 'duplicate_paper' then
    v_paper := app.selected_paper(p_project_id);
    if v_paper.id is null or v_paper.status not in ('candidate', 'submitted') then
      perform app.raise_error('INVALID_STATE', 'There is no selected paper waiting for approval');
    end if;
    update public.papers
    set duplicate_override_reason = v_reason, duplicate_override_by = v_uid, duplicate_override_at = now()
    where id = v_paper.id;
  elsif p_kind = 'objective_gate' then
    update public.projects
    set objective_gate_override_reason = v_reason, objective_gate_override_by = v_uid, objective_gate_override_at = now()
    where id = p_project_id;
  else
    perform app.raise_error('VALIDATION', 'The override must be duplicate_paper or objective_gate', 'kind');
  end if;
  perform app.log_action('override.' || p_kind, 'projects', p_project_id, p_project_id, v_project.semester_id,
    jsonb_build_object('reason', v_reason, 'paper_id', v_paper.id));
end;
$$;
