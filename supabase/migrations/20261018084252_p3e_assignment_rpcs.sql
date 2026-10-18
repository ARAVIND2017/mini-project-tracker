-- Phase 3 — Students, domains and assignments (part E: guides, co-reviewers, review authorizations)
-- Decisions D5 (faculty choose by domain expertise), D7 (HOD may guide),
-- D8 (HOD approves guide/co-reviewer assignments), D9 (lead authorizes cross-reviews).

create or replace function app.project_for_update(p_project_id uuid)
returns public.projects language plpgsql set search_path = '' as $$
declare
  v_project public.projects;
begin
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or not (app.can_view_project(p_project_id) or app.is_admin()) then
    perform app.raise_error('NOT_FOUND', 'Project not found');
  end if;
  perform app.require_open_semester(v_project.semester_id);
  return v_project;
end;
$$;

-- -----------------------------------------------------------------------------
-- Requests
-- * A faculty member requests for themselves, only in a domain of their expertise
--   (the HOD may request/assign regardless).
-- * The lead may propose any faculty member of the semester.
-- * Every request waits for the HOD.
-- -----------------------------------------------------------------------------
create or replace function public.app_request_assignment(
  p_project_id uuid,
  p_type public.assignment_type,
  p_faculty_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_project public.projects;
  v_id uuid;
begin
  v_project := app.project_for_update(p_project_id);
  if not app.is_faculty_level(v_project.semester_id) then
    perform app.raise_error('FORBIDDEN', 'Only faculty can request assignments');
  end if;
  if p_faculty_id <> v_uid and not (app.is_lead(v_project.semester_id) or app.is_hod()) then
    perform app.raise_error('FORBIDDEN', 'Only the lead faculty can propose another faculty member');
  end if;
  if not app.is_faculty_member(p_faculty_id, v_project.semester_id) then
    perform app.raise_error('VALIDATION', 'That person is not faculty in this semester', 'faculty_id');
  end if;
  if v_project.domain_id is null then
    perform app.raise_error('GATE_NOT_MET', 'The project has no domain yet; the HOD sets it first');
  end if;
  if p_faculty_id = v_uid and not app.is_hod() and not exists (
    select 1 from public.faculty_expertise
    where user_id = v_uid and domain_id = v_project.domain_id and is_active) then
    perform app.raise_error('FORBIDDEN', 'You can only request projects in your domains of expertise');
  end if;
  if p_type = 'guide' and v_project.guide_id = p_faculty_id then
    perform app.raise_error('INVALID_STATE', 'This person is already the guide');
  end if;
  if p_type = 'co_reviewer' and (v_project.guide_id = p_faculty_id or exists (
    select 1 from public.project_reviewers where project_id = p_project_id and user_id = p_faculty_id and is_active)) then
    perform app.raise_error('INVALID_STATE', 'This person already reviews this project');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform app.raise_error('VALIDATION', 'Give a reason (at least 5 characters)', 'reason');
  end if;

  begin
    insert into public.assignment_requests (project_id, type, faculty_id, requested_by, reason)
    values (p_project_id, p_type, p_faculty_id, v_uid, btrim(p_reason))
    returning id into v_id;
  exception when unique_violation then
    perform app.raise_error('INVALID_STATE', 'The same request is already waiting for the HOD');
  end;
  perform app.log_action('assignment.requested', 'assignment_requests', v_id, p_project_id, v_project.semester_id,
    jsonb_build_object('type', p_type, 'faculty_id', p_faculty_id));
  return v_id;
end;
$$;

create or replace function public.app_cancel_assignment_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_request public.assignment_requests;
begin
  select * into v_request from public.assignment_requests where id = p_request_id for update;
  if not found or not app.is_faculty_level(app.project_semester(v_request.project_id)) then
    perform app.raise_error('NOT_FOUND', 'Request not found');
  end if;
  if v_request.requested_by <> v_uid and not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the person who made the request can cancel it');
  end if;
  if v_request.status <> 'pending' then
    perform app.raise_error('INVALID_STATE', 'Only a pending request can be cancelled');
  end if;
  update public.assignment_requests set status = 'cancelled', decided_by = v_uid, decided_at = now()
  where id = p_request_id;
  perform app.log_action('assignment.cancelled', 'assignment_requests', p_request_id, v_request.project_id,
    app.project_semester(v_request.project_id));
end;
$$;

-- Internal: makes someone the guide (keeps co-reviewer rows consistent).
create or replace function app.apply_guide(p_project_id uuid, p_faculty_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  update public.projects set guide_id = p_faculty_id where id = p_project_id;
  -- The guide is not also a co-reviewer.
  if p_faculty_id is not null then
    update public.project_reviewers set is_active = false
    where project_id = p_project_id and user_id = p_faculty_id and is_active;
  end if;
end;
$$;

create or replace function public.app_decide_assignment_request(p_request_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_request public.assignment_requests;
  v_project public.projects;
begin
  if not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can approve or reject assignment requests');
  end if;
  select * into v_request from public.assignment_requests where id = p_request_id for update;
  if not found then
    perform app.raise_error('NOT_FOUND', 'Request not found');
  end if;
  if v_request.status <> 'pending' then
    perform app.raise_error('INVALID_STATE', 'This request has already been decided');
  end if;
  v_project := app.project_for_update(v_request.project_id);

  if p_approve then
    if not app.is_faculty_member(v_request.faculty_id, v_project.semester_id) then
      perform app.raise_error('INVALID_STATE', 'That person is no longer faculty in this semester');
    end if;
    if v_request.type = 'guide' then
      perform app.apply_guide(v_project.id, v_request.faculty_id);
      -- Other pending guide requests for this project are no longer possible.
      update public.assignment_requests
      set status = 'rejected', decided_by = v_uid, decided_at = now(), decision_note = 'Another guide was approved'
      where project_id = v_project.id and type = 'guide' and status = 'pending' and id <> p_request_id;
    else
      if v_project.guide_id = v_request.faculty_id then
        perform app.raise_error('INVALID_STATE', 'This person is already the guide');
      end if;
      insert into public.project_reviewers (project_id, user_id, added_via_request, added_by)
      values (v_project.id, v_request.faculty_id, p_request_id, v_uid)
      on conflict (project_id, user_id) do update
        set is_active = true, added_via_request = excluded.added_via_request, added_by = excluded.added_by;
    end if;
  end if;

  update public.assignment_requests
  set status = case when p_approve then 'approved' else 'rejected' end::public.request_status,
      decided_by = v_uid, decided_at = now(), decision_note = nullif(btrim(p_note), '')
  where id = p_request_id;
  perform app.log_action(case when p_approve then 'assignment.approved' else 'assignment.rejected' end,
    'assignment_requests', p_request_id, v_project.id, v_project.semester_id,
    jsonb_build_object('type', v_request.type, 'faculty_id', v_request.faculty_id, 'note', p_note));
end;
$$;

-- -----------------------------------------------------------------------------
-- Direct changes by the HOD
-- -----------------------------------------------------------------------------
create or replace function public.app_assign_guide(p_project_id uuid, p_faculty_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  perform app.require_active_user();
  if not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can assign a guide directly');
  end if;
  v_project := app.project_for_update(p_project_id);
  if p_faculty_id is not null and not app.is_faculty_member(p_faculty_id, v_project.semester_id) then
    perform app.raise_error('VALIDATION', 'That person is not faculty in this semester', 'faculty_id');
  end if;
  perform app.apply_guide(p_project_id, p_faculty_id);
  if p_faculty_id is not null then
    update public.assignment_requests
    set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = 'The HOD assigned a guide directly'
    where project_id = p_project_id and type = 'guide' and status = 'pending';
  end if;
  perform app.log_action('project.guide_assigned', 'projects', p_project_id, p_project_id, v_project.semester_id,
    jsonb_build_object('guide_id', p_faculty_id, 'previous_guide_id', v_project.guide_id, 'note', p_note));
end;
$$;

create or replace function public.app_remove_co_reviewer(p_project_id uuid, p_faculty_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  perform app.require_active_user();
  if not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can remove a co-reviewer');
  end if;
  v_project := app.project_for_update(p_project_id);
  update public.project_reviewers set is_active = false
  where project_id = p_project_id and user_id = p_faculty_id and is_active;
  if not found then
    perform app.raise_error('NOT_FOUND', 'This person is not a co-reviewer of the project');
  end if;
  perform app.log_action('project.co_reviewer_removed', 'project_reviewers', p_project_id, p_project_id,
    v_project.semester_id, jsonb_build_object('faculty_id', p_faculty_id, 'note', p_note));
end;
$$;

-- -----------------------------------------------------------------------------
-- Review authorizations (lead or HOD): lets a faculty member review one project.
-- -----------------------------------------------------------------------------
create or replace function public.app_grant_review_authorization(
  p_project_id uuid,
  p_faculty_id uuid,
  p_valid_until timestamptz default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_project public.projects;
  v_id uuid;
begin
  v_project := app.project_for_update(p_project_id);
  if not (app.is_lead(v_project.semester_id) or app.is_hod()) then
    perform app.raise_error('FORBIDDEN', 'Only the lead faculty or the HOD can authorize reviews');
  end if;
  if not app.is_faculty_member(p_faculty_id, v_project.semester_id) then
    perform app.raise_error('VALIDATION', 'That person is not faculty in this semester', 'faculty_id');
  end if;
  if v_project.guide_id = p_faculty_id then
    perform app.raise_error('INVALID_STATE', 'The guide already reviews this project');
  end if;
  if p_valid_until is not null and p_valid_until <= now() then
    perform app.raise_error('VALIDATION', 'The end date must be in the future', 'valid_until');
  end if;
  if exists (select 1 from public.review_authorizations
             where project_id = p_project_id and faculty_id = p_faculty_id and revoked_at is null
               and (valid_until is null or valid_until > now())) then
    perform app.raise_error('INVALID_STATE', 'This person already has an active authorization for the project');
  end if;
  insert into public.review_authorizations (project_id, faculty_id, granted_by, valid_until, note)
  values (p_project_id, p_faculty_id, v_uid, p_valid_until, nullif(btrim(p_note), ''))
  returning id into v_id;
  perform app.log_action('review_authorization.granted', 'review_authorizations', v_id, p_project_id,
    v_project.semester_id, jsonb_build_object('faculty_id', p_faculty_id, 'valid_until', p_valid_until));
  return v_id;
end;
$$;

create or replace function public.app_revoke_review_authorization(p_authorization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_auth public.review_authorizations;
  v_semester uuid;
begin
  select * into v_auth from public.review_authorizations where id = p_authorization_id for update;
  if not found then
    perform app.raise_error('NOT_FOUND', 'Authorization not found');
  end if;
  v_semester := app.project_semester(v_auth.project_id);
  if not (app.is_lead(v_semester) or app.is_hod()) then
    perform app.raise_error('FORBIDDEN', 'Only the lead faculty or the HOD can revoke review authorizations');
  end if;
  perform app.require_open_semester(v_semester);
  if v_auth.revoked_at is not null then
    perform app.raise_error('INVALID_STATE', 'This authorization is already revoked');
  end if;
  update public.review_authorizations set revoked_at = now(), revoked_by = v_uid where id = p_authorization_id;
  perform app.log_action('review_authorization.revoked', 'review_authorizations', p_authorization_id,
    v_auth.project_id, v_semester);
end;
$$;
