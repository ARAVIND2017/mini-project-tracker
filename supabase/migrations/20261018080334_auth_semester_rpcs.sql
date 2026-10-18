-- Phase 2 — Authentication and faculty hierarchy (part 3 of 4: context and semester RPCs)
-- Specs: USER_ROLES_AND_PERMISSIONS.md, DATABASE_SPEC.md §2, API_SPEC.md §4.1.

-- -----------------------------------------------------------------------------
-- Internal helpers for the RPCs
-- -----------------------------------------------------------------------------
create or replace function app.active_lead_membership(p_semester_id uuid)
returns uuid language sql stable set search_path = '' as $$
  select id from public.memberships
  where semester_id = p_semester_id and role = 'lead_faculty' and is_active;
$$;

-- Every faculty member of the semester reports to the current lead (or nobody).
create or replace function app.repoint_faculty(p_semester_id uuid)
returns void language sql set search_path = '' as $$
  update public.memberships
  set reports_to = app.active_lead_membership(p_semester_id)
  where semester_id = p_semester_id and role = 'faculty'
    and reports_to is distinct from app.active_lead_membership(p_semester_id);
$$;

create or replace function app.semester_for_update(p_semester_id uuid)
returns public.semesters language plpgsql set search_path = '' as $$
declare
  v_semester public.semesters;
begin
  select * into v_semester from public.semesters where id = p_semester_id for update;
  if not found then
    perform app.raise_error('NOT_FOUND', 'Semester not found');
  end if;
  return v_semester;
end;
$$;

-- Applies a settings object to a semester. Unknown keys and bad values → VALIDATION.
create or replace function app.apply_semester_settings(p_semester_id uuid, p_settings jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_allowed text[] := array['name', 'academic_year', 'start_date', 'week_count', 'timezone',
    'lab_weekday', 'lab_start', 'lab_end', 'submission_weekday', 'submission_time',
    'review_weekday', 'review_time', 'target_paper_year', 'max_students', 'stage_weights',
    'panel_quorum', 'paper_change_cutoff_week', 'require_source_zip'];
  v_unknown text;
  s jsonb := coalesce(p_settings, '{}'::jsonb);
begin
  if jsonb_typeof(s) <> 'object' then
    perform app.raise_error('VALIDATION', 'Settings must be an object');
  end if;
  select string_agg(k, ', ') into v_unknown from jsonb_object_keys(s) k where k <> all (v_allowed);
  if v_unknown is not null then
    perform app.raise_error('VALIDATION', format('Unknown setting(s): %s', v_unknown));
  end if;

  begin
    update public.semesters t set
      name                     = case when s ? 'name' then s ->> 'name' else t.name end,
      academic_year            = case when s ? 'academic_year' then nullif(s ->> 'academic_year', '') else t.academic_year end,
      start_date               = case when s ? 'start_date' then (nullif(s ->> 'start_date', ''))::date else t.start_date end,
      week_count               = case when s ? 'week_count' then (s ->> 'week_count')::int else t.week_count end,
      timezone                 = case when s ? 'timezone' then s ->> 'timezone' else t.timezone end,
      lab_weekday              = case when s ? 'lab_weekday' then (s ->> 'lab_weekday')::smallint else t.lab_weekday end,
      lab_start                = case when s ? 'lab_start' then (s ->> 'lab_start')::time else t.lab_start end,
      lab_end                  = case when s ? 'lab_end' then (s ->> 'lab_end')::time else t.lab_end end,
      submission_weekday       = case when s ? 'submission_weekday' then (s ->> 'submission_weekday')::smallint else t.submission_weekday end,
      submission_time          = case when s ? 'submission_time' then (s ->> 'submission_time')::time else t.submission_time end,
      review_weekday           = case when s ? 'review_weekday' then (s ->> 'review_weekday')::smallint else t.review_weekday end,
      review_time              = case when s ? 'review_time' then (s ->> 'review_time')::time else t.review_time end,
      target_paper_year        = case when s ? 'target_paper_year' then (s ->> 'target_paper_year')::int else t.target_paper_year end,
      max_students             = case when s ? 'max_students' then (s ->> 'max_students')::int else t.max_students end,
      stage_weights            = case when s ? 'stage_weights' then s -> 'stage_weights' else t.stage_weights end,
      panel_quorum             = case when s ? 'panel_quorum' then (nullif(s ->> 'panel_quorum', ''))::int else t.panel_quorum end,
      paper_change_cutoff_week = case when s ? 'paper_change_cutoff_week' then (s ->> 'paper_change_cutoff_week')::int else t.paper_change_cutoff_week end,
      require_source_zip       = case when s ? 'require_source_zip' then (s ->> 'require_source_zip')::boolean else t.require_source_zip end
    where t.id = p_semester_id;
  exception
    when check_violation or not_null_violation then
      perform app.raise_error('VALIDATION', 'A semester setting is out of range', sqlerrm);
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
         or numeric_value_out_of_range or invalid_parameter_value then
      perform app.raise_error('VALIDATION', 'A semester setting has an invalid value', sqlerrm);
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: current user context
-- -----------------------------------------------------------------------------
create or replace function public.app_my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = v_uid;
  if v_uid is null or not found then
    return jsonb_build_object('active', false);
  end if;
  if not v_profile.is_active then
    return jsonb_build_object('active', false, 'user_id', v_uid);
  end if;
  return jsonb_build_object(
    'active', true,
    'user_id', v_uid,
    'profile', jsonb_build_object('full_name', v_profile.full_name, 'email', v_profile.email,
                                  'designation', v_profile.designation),
    'system_roles', coalesce((
      select jsonb_agg(jsonb_build_object('role', r.role, 'admin_permissions', r.admin_permissions) order by r.role)
      from public.system_roles r where r.user_id = v_uid), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membership_id', m.id, 'semester_id', s.id, 'semester_name', s.name,
        'semester_status', s.status, 'role', m.role) order by s.created_at desc)
      from public.memberships m join public.semesters s on s.id = m.semester_id
      where m.user_id = v_uid and m.is_active), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: semesters (HOD, or admin with manage_config)
-- -----------------------------------------------------------------------------
create or replace function public.app_create_semester(
  p_name text,
  p_academic_year text default null,
  p_settings jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_id uuid;
begin
  if not app.has_admin_permission('manage_config') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can create a semester');
  end if;
  begin
    insert into public.semesters (name, academic_year, created_by)
    values (p_name, nullif(btrim(p_academic_year), ''), v_uid)
    returning id into v_id;
  exception when check_violation or not_null_violation then
    perform app.raise_error('VALIDATION', 'Semester name must be 1–120 characters', 'name');
  end;
  perform app.apply_semester_settings(v_id, p_settings);
  perform app.log_action('semester.created', 'semesters', v_id, null, v_id,
                         jsonb_build_object('name', p_name));
  return v_id;
end;
$$;

create or replace function public.app_update_semester(p_semester_id uuid, p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester public.semesters;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_config') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can change semester settings');
  end if;
  v_semester := app.semester_for_update(p_semester_id);
  if v_semester.status = 'closed' then
    perform app.raise_error('INVALID_STATE', 'A closed semester cannot be changed');
  end if;
  perform app.apply_semester_settings(p_semester_id, p_settings);
  perform app.log_action('semester.settings_updated', 'semesters', p_semester_id, null,
                         p_semester_id, p_settings);
end;
$$;

create or replace function public.app_activate_semester(p_semester_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester public.semesters;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_config') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can activate a semester');
  end if;
  v_semester := app.semester_for_update(p_semester_id);
  if v_semester.status <> 'draft' then
    perform app.raise_error('INVALID_STATE', 'Only a draft semester can be activated');
  end if;
  if v_semester.start_date is null then
    perform app.raise_error('GATE_NOT_MET', 'Set the semester start date (first lab day) first', 'start_date');
  end if;
  if app.active_lead_membership(p_semester_id) is null then
    perform app.raise_error('GATE_NOT_MET', 'Appoint a lead faculty first', 'lead_faculty');
  end if;
  update public.semesters set status = 'active' where id = p_semester_id;
  perform app.log_action('semester.activated', 'semesters', p_semester_id, null, p_semester_id);
end;
$$;

create or replace function public.app_close_semester(p_semester_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester public.semesters;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_config') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can close a semester');
  end if;
  v_semester := app.semester_for_update(p_semester_id);
  if v_semester.status <> 'active' then
    perform app.raise_error('INVALID_STATE', 'Only an active semester can be closed');
  end if;
  update public.semesters set status = 'closed' where id = p_semester_id;
  perform app.log_action('semester.closed', 'semesters', p_semester_id, null, p_semester_id);
end;
$$;

