-- Phase 3 — Students, domains and assignments (part D2: roster entries, student accounts, projects)

-- -----------------------------------------------------------------------------
-- Edit one roster entry (HOD, or admin with manage_roster).
-- p_patch keys: institution_id, full_name, email, drive_folder_url ("" = no value).
-- -----------------------------------------------------------------------------
create or replace function public.app_update_student(p_student_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students;
  v_unknown text;
  v_inst text;
  v_name text;
  v_email text;
  v_drive text;
  v_error text;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_roster') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can edit the roster');
  end if;
  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    perform app.raise_error('NOT_FOUND', 'Roster entry not found');
  end if;
  perform app.require_open_semester(v_student.semester_id);
  if v_student.status = 'withdrawn' then
    perform app.raise_error('INVALID_STATE', 'A withdrawn student cannot be edited');
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    perform app.raise_error('VALIDATION', 'Changes must be an object');
  end if;
  select string_agg(k, ', ') into v_unknown from jsonb_object_keys(p_patch) k
  where k not in ('institution_id', 'full_name', 'email', 'drive_folder_url');
  if v_unknown is not null then
    perform app.raise_error('VALIDATION', format('Unknown field(s): %s', v_unknown));
  end if;

  v_inst := case when p_patch ? 'institution_id' then nullif(btrim(p_patch ->> 'institution_id'), '') else v_student.institution_id end;
  v_name := case when p_patch ? 'full_name' then nullif(btrim(p_patch ->> 'full_name'), '') else v_student.full_name end;
  v_email := case when p_patch ? 'email' then nullif(btrim(p_patch ->> 'email'), '') else v_student.email::text end;
  v_drive := case when p_patch ? 'drive_folder_url' then nullif(btrim(p_patch ->> 'drive_folder_url'), '') else v_student.drive_folder_url end;

  if v_name is null and v_student.status <> 'empty' then
    perform app.raise_error('INVALID_STATE', 'This slot has a student and a project; withdraw the student instead of emptying the slot');
  end if;
  v_error := app.roster_field_error(v_inst, v_name, v_email, v_drive);
  if v_error is not null then
    perform app.raise_error('VALIDATION', v_error);
  end if;
  if v_student.user_id is not null and lower(coalesce(v_student.email::text, '')) <> lower(coalesce(v_email, '')) then
    perform app.raise_error('INVALID_STATE', 'The email of a student who already has an account cannot change');
  end if;

  begin
    update public.students
    set institution_id = v_inst, full_name = v_name, email = v_email, drive_folder_url = v_drive
    where id = p_student_id;
  exception when unique_violation then
    perform app.raise_error('VALIDATION', 'Student ID or email is already used by another slot');
  end;
  perform app.ensure_project(p_student_id);
  perform app.log_action('student.updated', 'students', p_student_id, null, v_student.semester_id, p_patch);
end;
$$;

-- Adds empty slots up to the given slot number (e.g. to prepare 30 slots).
create or replace function public.app_add_empty_slots(p_semester_id uuid, p_up_to_slot int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_added int;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_roster') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can edit the roster');
  end if;
  perform app.require_open_semester(p_semester_id);
  if p_up_to_slot is null or p_up_to_slot < 1 or p_up_to_slot > 999 then
    perform app.raise_error('VALIDATION', 'Slot number must be from 1 to 999');
  end if;
  insert into public.students (semester_id, slot_no)
  select p_semester_id, n from generate_series(1, p_up_to_slot) n
  on conflict (semester_id, slot_no) do nothing;
  get diagnostics v_added = row_count;
  perform app.log_action('roster.empty_slots_added', 'students', null, null, p_semester_id,
    jsonb_build_object('up_to_slot', p_up_to_slot, 'added', v_added));
  return v_added;
end;
$$;

-- Withdraws a student: the roster entry and project stay, the student loses access.
create or replace function public.app_withdraw_student(p_student_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students;
begin
  perform app.require_active_user();
  if not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can withdraw a student');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform app.raise_error('VALIDATION', 'Give a reason (at least 5 characters)', 'reason');
  end if;
  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    perform app.raise_error('NOT_FOUND', 'Roster entry not found');
  end if;
  perform app.require_open_semester(v_student.semester_id);
  if v_student.status in ('empty', 'withdrawn') then
    perform app.raise_error('INVALID_STATE', 'Only a slot with a student can be withdrawn');
  end if;
  update public.students set status = 'withdrawn' where id = p_student_id;
  if v_student.user_id is not null then
    update public.memberships set is_active = false
    where semester_id = v_student.semester_id and user_id = v_student.user_id and role = 'student';
  end if;
  perform app.log_action('student.withdrawn', 'students', p_student_id, null, v_student.semester_id,
    jsonb_build_object('reason', p_reason));
end;
$$;

-- Links an invited account to a roster entry and gives it the student role.
-- Called by the admin-users Edge Function as the signed-in HOD/admin.
create or replace function public.app_link_student(p_student_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students;
  v_profile public.profiles;
begin
  perform app.require_active_user();
  if not (app.has_admin_permission('manage_roster') or app.has_admin_permission('manage_users')) then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can invite students');
  end if;
  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    perform app.raise_error('NOT_FOUND', 'Roster entry not found');
  end if;
  perform app.require_open_semester(v_student.semester_id);
  if v_student.status not in ('pending_invite', 'active') then
    perform app.raise_error('INVALID_STATE', 'Only a filled roster entry can be linked to an account');
  end if;
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    perform app.raise_error('NOT_FOUND', 'Account not found');
  end if;
  if v_student.email is null or lower(v_student.email::text) <> lower(v_profile.email::text) then
    perform app.raise_error('VALIDATION', 'The account email does not match the roster email');
  end if;
  if app.holds_system_role(p_user_id, 'hod') or app.holds_system_role(p_user_id, 'admin') then
    perform app.raise_error('VALIDATION', 'An HOD or administrator account cannot be a student');
  end if;
  if exists (select 1 from public.memberships where semester_id = v_student.semester_id and user_id = p_user_id
             and role <> 'student' and is_active) then
    perform app.raise_error('VALIDATION', 'This person is faculty in this semester');
  end if;
  if v_student.user_id is not null and v_student.user_id <> p_user_id then
    perform app.raise_error('INVALID_STATE', 'This roster entry is linked to a different account');
  end if;

  update public.students set user_id = p_user_id where id = p_student_id;
  insert into public.memberships (semester_id, user_id, role)
  values (v_student.semester_id, p_user_id, 'student')
  on conflict (semester_id, user_id) do update set role = 'student', is_active = true, reports_to = null;
  perform app.ensure_project(p_student_id);
  perform app.log_action('student.account_linked', 'students', p_student_id, null, v_student.semester_id,
    jsonb_build_object('user_id', p_user_id));
end;
$$;

-- A student keeps their own Drive folder link up to date.
create or replace function public.app_set_my_drive_folder(p_student_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students;
  v_url text := nullif(btrim(p_url), '');
begin
  perform app.require_active_user();
  select * into v_student from public.students where id = p_student_id for update;
  if not found or v_student.user_id is distinct from auth.uid() or v_student.status <> 'active' then
    perform app.raise_error('NOT_FOUND', 'Roster entry not found');
  end if;
  perform app.require_open_semester(v_student.semester_id);
  if v_url is not null and v_url !~* '^https://[^\s]+$' then
    perform app.raise_error('VALIDATION', 'Drive link must start with https://', 'drive_folder_url');
  end if;
  update public.students set drive_folder_url = v_url where id = p_student_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Projects
-- -----------------------------------------------------------------------------
create or replace function public.app_set_project_domain(p_project_id uuid, p_domain_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_config') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can set a project''s domain');
  end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    perform app.raise_error('NOT_FOUND', 'Project not found');
  end if;
  perform app.require_open_semester(v_project.semester_id);
  if p_domain_id is not null and not exists (
    select 1 from public.domains where id = p_domain_id and semester_id = v_project.semester_id and is_active) then
    perform app.raise_error('VALIDATION', 'Choose an active domain of this semester', 'domain_id');
  end if;
  update public.projects set domain_id = p_domain_id where id = p_project_id;
  perform app.log_action('project.domain_set', 'projects', p_project_id, p_project_id, v_project.semester_id,
    jsonb_build_object('domain_id', p_domain_id, 'previous_domain_id', v_project.domain_id));
end;
$$;

-- The working title: the student (until objectives are approved) or the HOD.
create or replace function public.app_set_project_title(p_project_id uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_title text := nullif(btrim(p_title), '');
begin
  perform app.require_active_user();
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or not app.can_view_project(p_project_id) then
    perform app.raise_error('NOT_FOUND', 'Project not found');
  end if;
  if not (app.is_project_student(p_project_id) or app.is_hod()) then
    perform app.raise_error('FORBIDDEN', 'Only the student or the HOD can change the project title');
  end if;
  perform app.require_open_semester(v_project.semester_id);
  if not app.is_hod() and exists (select 1 from public.project_stages where project_id = p_project_id
                                  and stage_key = 'objectives' and status in ('approved', 'exception_approved')) then
    perform app.raise_error('INVALID_STATE', 'The title is fixed once objectives are approved; ask the HOD to change it');
  end if;
  if v_title is not null and char_length(v_title) > 300 then
    perform app.raise_error('VALIDATION', 'Title is longer than 300 characters', 'title');
  end if;
  update public.projects set title = v_title where id = p_project_id;
end;
$$;
