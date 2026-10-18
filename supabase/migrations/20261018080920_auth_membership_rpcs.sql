-- Phase 2 — Authentication and faculty hierarchy (part 4a: membership RPCs)
-- Specs: USER_ROLES_AND_PERMISSIONS.md, DATABASE_SPEC.md §2, API_SPEC.md §4.1.

-- -----------------------------------------------------------------------------
-- RPC: memberships and hierarchy
-- -----------------------------------------------------------------------------
-- Creates or changes a semester membership.
--  * New faculty memberships: HOD, or admin with manage_users (used by invites).
--  * Anything touching the lead, changing an existing role, deactivating, or
--    adding a student directly: HOD only (students normally arrive via the roster).
create or replace function public.app_set_membership(
  p_semester_id uuid,
  p_user_id uuid,
  p_role public.semester_role,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester public.semesters;
  v_existing public.memberships;
  v_id uuid;
  v_is_new_faculty boolean;
begin
  perform app.require_active_user();
  v_semester := app.semester_for_update(p_semester_id);
  if v_semester.status = 'closed' then
    perform app.raise_error('INVALID_STATE', 'A closed semester cannot be changed');
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    perform app.raise_error('NOT_FOUND', 'User not found');
  end if;
  if exists (select 1 from public.system_roles where user_id = p_user_id and role = 'hod') then
    perform app.raise_error('VALIDATION', 'The HOD already has faculty-level access and needs no membership');
  end if;

  select * into v_existing from public.memberships
  where semester_id = p_semester_id and user_id = p_user_id for update;

  v_is_new_faculty := v_existing.id is null and p_role = 'faculty' and p_is_active;
  if not (app.is_hod() or (v_is_new_faculty and app.has_admin_permission('manage_users'))) then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can change roles or the hierarchy');
  end if;

  if p_role = 'lead_faculty' and p_is_active then
    -- One lead per semester: the previous lead becomes a faculty member.
    update public.memberships set role = 'faculty'
    where semester_id = p_semester_id and role = 'lead_faculty' and is_active and user_id <> p_user_id;
  end if;

  if v_existing.id is null then
    insert into public.memberships (semester_id, user_id, role, is_active)
    values (p_semester_id, p_user_id, p_role, p_is_active)
    returning id into v_id;
  else
    update public.memberships
    set role = p_role, is_active = p_is_active,
        reports_to = case when p_role = 'faculty' then reports_to end
    where id = v_existing.id
    returning id into v_id;
  end if;

  perform app.repoint_faculty(p_semester_id);
  perform app.log_action('membership.set', 'memberships', v_id, null, p_semester_id,
    jsonb_build_object('user_id', p_user_id, 'role', p_role, 'is_active', p_is_active,
                       'previous_role', v_existing.role, 'previous_active', v_existing.is_active));
  return v_id;
end;
$$;

create or replace function public.app_set_lead(p_semester_id uuid, p_user_id uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.app_set_membership(p_semester_id, p_user_id, 'lead_faculty', true);
$$;

