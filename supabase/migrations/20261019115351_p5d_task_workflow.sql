-- Phase 5 — Weekly tasks (part D: the weekly review workflow)
-- Specs: WORKFLOW_SPEC.md §3.4 and §4, API_SPEC.md §4.3–§4.4.
--   not_started → in_progress → submitted → under_review → verified
--                                         ↘ changes_requested → resubmitted → under_review …
-- Every submission is a new immutable version; lateness is recorded once (FUN-10).

-- Corrections across all versions of a task (they belong to the submission they were made on).
create or replace function app.count_task_corrections(p_submission_id uuid, p_statuses public.correction_status[])
returns int language sql stable set search_path = '' as $$
  select count(*)::int
  from public.corrections c
  join public.submissions s on s.id = c.target_id
  where c.target_type = 'task_submission' and c.status = any (p_statuses)
    and s.task_id = (select task_id from public.submissions where id = p_submission_id);
$$;

create or replace function app.target_project(p_target_type public.review_target, p_target_id uuid)
returns uuid language sql stable set search_path = '' as $$
  select case p_target_type
    when 'exploration' then (select project_id from public.research_explorations where id = p_target_id)
    when 'paper' then (select project_id from public.papers where id = p_target_id)
    when 'paper_analysis' then (select project_id from public.paper_analyses where id = p_target_id)
    when 'repository' then (select project_id from public.code_repositories where id = p_target_id)
    when 'objective' then (select project_id from public.objective_versions where id = p_target_id)
    when 'task_submission' then (select project_id from public.submissions where id = p_target_id)
  end;
$$;

-- A task submission can be decided while it is the latest version and the task waits for review.
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
    else false
  end;
$$;

-- -----------------------------------------------------------------------------
-- Student: start and submit a task
-- -----------------------------------------------------------------------------
create or replace function app.task_for_student(p_task_id uuid)
returns public.tasks language plpgsql set search_path = '' as $$
declare
  v_task public.tasks;
begin
  perform app.require_active_user();
  select * into v_task from public.tasks where id = p_task_id;
  if not found or not app.can_view_project(v_task.project_id) then
    perform app.raise_error('NOT_FOUND', 'Task not found');
  end if;
  perform app.require_student_project(v_task.project_id);
  select * into v_task from public.tasks where id = p_task_id for update;
  if not v_task.is_active then
    perform app.raise_error('INVALID_STATE', 'This task no longer applies to the project');
  end if;
  return v_task;
end;
$$;

create or replace function public.app_start_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks := app.task_for_student(p_task_id);
begin
  if v_task.status = 'not_started' then
    update public.tasks set status = 'in_progress' where id = p_task_id;
    perform app.touch_stage(v_task.project_id, v_task.stage_key);
    perform app.log_action('task.started', 'tasks', p_task_id, v_task.project_id, app.project_semester(v_task.project_id));
  end if;
end;
$$;

-- p_evidence: new links [{category, url, description}]; p_evidence_ids: links already recorded for the project.
create or replace function public.app_submit_task(
  p_task_id uuid,
  p_progress_report text,
  p_evidence jsonb default '[]',
  p_evidence_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_task public.tasks := app.task_for_student(p_task_id);
  v_project public.projects;
  v_report text;
  v_version int;
  v_late boolean;
  v_open int;
  v_item jsonb;
  v_category text;
  v_evidence_id uuid;
  v_id uuid;
begin
  select * into v_project from public.projects where id = v_task.project_id;
  if v_task.status in ('submitted', 'resubmitted', 'under_review') then
    perform app.raise_error('INVALID_STATE', 'This task is already waiting for review');
  elsif v_task.status = 'verified' then
    perform app.raise_error('INVALID_STATE', 'This task is already verified');
  end if;
  -- WF-02: work for S6 and later needs approved objectives (or an HOD override).
  if v_task.stage_key in ('implementation', 'evaluation', 'final')
     and not app.stage_done(v_project.id, 'objectives') and v_project.objective_gate_override_at is null then
    perform app.raise_error('GATE_NOT_MET', 'Objectives (S5) must be approved before this work can be submitted');
  end if;
  select coalesce(max(version), 0) into v_version from public.submissions where task_id = p_task_id;
  if v_version > 0 then
    v_open := app.count_task_corrections(
      (select id from public.submissions where task_id = p_task_id and version = v_version),
      array['open']::public.correction_status[]);
    if v_open > 0 then
      perform app.raise_error('GATE_NOT_MET', format('Address the %s open correction(s) before resubmitting', v_open));
    end if;
  end if;

  v_report := app.min_text(p_progress_report, 100, 'The progress report', 'progress_report');
  if char_length(v_report) > 10000 then
    perform app.raise_error('VALIDATION', 'The progress report is longer than 10000 characters', 'progress_report');
  end if;
  if p_evidence is null or jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) > 10 then
    perform app.raise_error('VALIDATION', 'Evidence must be a list of at most 10 links', 'evidence');
  end if;
  if exists (select 1 from unnest(coalesce(p_evidence_ids, '{}')) e(id)
             where not exists (select 1 from public.evidence where id = e.id and project_id = v_project.id)) then
    perform app.raise_error('VALIDATION', 'Evidence must belong to this project', 'evidence_ids');
  end if;
  if cardinality(v_task.required_evidence) > 0
     and jsonb_array_length(p_evidence) = 0 and cardinality(coalesce(p_evidence_ids, '{}')) = 0 then
    perform app.raise_error('VALIDATION', 'Attach at least one evidence link for this task', 'evidence');
  end if;

  v_late := now() > v_task.due_at;
  insert into public.submissions (task_id, project_id, version, progress_report, submitted_by, is_late, due_at_snapshot)
  values (p_task_id, v_project.id, v_version + 1, v_report, v_uid, v_late, v_task.due_at)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_evidence) loop
    v_category := coalesce(nullif(v_item ->> 'category', ''), 'other');
    if v_category <> all (enum_range(null::public.evidence_category)::text[]) then
      perform app.raise_error('VALIDATION', 'Unknown kind of evidence', 'evidence');
    end if;
    insert into public.evidence (project_id, category, url, description, stage_key, task_id, created_by)
    values (v_project.id, v_category::public.evidence_category,
      app.valid_url(nullif(btrim(v_item ->> 'url'), ''), 'Each evidence link', 'evidence'),
      app.min_text(v_item ->> 'description', 10, 'Each evidence description', 'evidence'),
      v_task.stage_key, p_task_id, v_uid)
    returning id into v_evidence_id;
    insert into public.submission_evidence (submission_id, evidence_id) values (v_id, v_evidence_id);
  end loop;
  insert into public.submission_evidence (submission_id, evidence_id)
  select distinct v_id, e from unnest(coalesce(p_evidence_ids, '{}')) e
  on conflict do nothing;

  update public.tasks
  set status = case when v_task.status = 'changes_requested' then 'resubmitted' else 'submitted' end::public.task_status
  where id = p_task_id;
  perform app.touch_stage(v_project.id, v_task.stage_key);
  perform app.log_action('task.submitted', 'submissions', v_id, v_project.id, v_project.semester_id,
    jsonb_build_object('task_id', p_task_id, 'version', v_version + 1, 'is_late', v_late));
  return v_id;
exception
  when not_null_violation or check_violation then
    perform app.raise_error('VALIDATION', 'Each evidence link needs an https link and a description of at least 10 characters', 'evidence');
end;
$$;

-- -----------------------------------------------------------------------------
-- Reviewer opens a submission (submitted/resubmitted → under_review)
-- -----------------------------------------------------------------------------
create or replace function public.app_start_review(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.submissions;
  v_task public.tasks;
  v_project public.projects;
begin
  perform app.require_active_user();
  select * into v_submission from public.submissions where id = p_submission_id;
  if not found or not app.can_view_project(v_submission.project_id) then
    perform app.raise_error('NOT_FOUND', 'Submission not found');
  end if;
  v_project := app.require_reviewer(v_submission.project_id, 'Only a reviewer of this project can review it');
  select * into v_task from public.tasks where id = v_submission.task_id for update;
  if v_submission.version <> (select max(version) from public.submissions where task_id = v_task.id) then
    perform app.raise_error('INVALID_STATE', 'A newer version of this task has been submitted');
  end if;
  if v_task.status = 'under_review' then
    return;
  elsif v_task.status not in ('submitted', 'resubmitted') then
    perform app.raise_error('INVALID_STATE', 'This task is not waiting for review');
  end if;
  update public.tasks set status = 'under_review' where id = v_task.id;
  perform app.log_action('review.started', 'submissions', p_submission_id, v_project.id, v_project.semester_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Blocked flag on a task or a project (a flag, not a status: FUN-11)
-- -----------------------------------------------------------------------------
create or replace function public.app_set_blocked(p_target text, p_id uuid, p_blocked boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_project_id uuid;
  v_semester_id uuid;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if p_target = 'task' then
    select project_id into v_project_id from public.tasks where id = p_id;
  elsif p_target = 'project' then
    v_project_id := (select id from public.projects where id = p_id);
  else
    perform app.raise_error('VALIDATION', 'The target must be task or project', 'target');
  end if;
  if v_project_id is null or not app.can_view_project(v_project_id) then
    perform app.raise_error('NOT_FOUND', 'Not found');
  end if;
  if not (app.is_project_student(v_project_id) or app.is_project_reviewer(v_project_id)) then
    perform app.raise_error('FORBIDDEN', 'Only the student or a reviewer of this project can change the blocked flag');
  end if;
  v_semester_id := app.project_semester(v_project_id);
  perform app.require_open_semester(v_semester_id);
  if p_blocked is null then
    perform app.raise_error('VALIDATION', 'Say whether it is blocked', 'blocked');
  end if;
  if p_blocked then
    v_reason := app.min_text(v_reason, 5, 'The reason', 'reason');
    if char_length(v_reason) > 1000 then
      perform app.raise_error('VALIDATION', 'The reason is longer than 1000 characters', 'reason');
    end if;
  end if;

  if p_target = 'task' then
    update public.tasks
    set blocked = p_blocked, blocked_reason = case when p_blocked then v_reason end,
        blocked_at = case when p_blocked then now() end, blocked_by = case when p_blocked then v_uid end
    where id = p_id;
  else
    update public.projects
    set blocked = p_blocked, blocked_reason = case when p_blocked then v_reason end,
        blocked_at = case when p_blocked then now() end, blocked_by = case when p_blocked then v_uid end
    where id = p_id;
  end if;
  perform app.log_action(p_target || case when p_blocked then '.blocked' else '.unblocked' end,
    case when p_target = 'task' then 'tasks' else 'projects' end, p_id, v_project_id, v_semester_id,
    jsonb_build_object('reason', v_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- Reviews now also cover task submissions (replaces the Phase 4 version).
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
begin
  if p_target_type not in ('exploration', 'paper', 'paper_analysis', 'repository', 'objective', 'task_submission') then
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
      v_pending := case when p_target_type = 'task_submission'
        then app.count_task_corrections(p_target_id, array['open', 'addressed']::public.correction_status[])
        else app.count_corrections(p_target_id, array['open', 'addressed']::public.correction_status[]) end;
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

