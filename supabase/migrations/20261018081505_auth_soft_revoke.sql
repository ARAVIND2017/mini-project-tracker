-- Phase 2 — Authentication and faculty hierarchy (part 4c: soft-revoke system roles)
-- System roles are never deleted: revoking sets revoked_at/revoked_by, so the
-- history of who held HOD/admin rights stays in the table (DATABASE_SPEC.md
-- conventions: business records are withdrawn, not hard-deleted).
-- Every check of "holds a system role" now ignores revoked rows.

alter table public.system_roles
  add column revoked_at timestamptz,
  add column revoked_by uuid references public.profiles (id);

create index system_roles_revoked_by_idx on public.system_roles (revoked_by);

-- The last active HOD cannot be revoked (the DELETE trigger from part 1 stays as a
-- second line of defence).
create or replace function app.protect_last_hod_revoke()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'hod' and old.revoked_at is null and new.revoked_at is not null
     and not exists (
       select 1 from public.system_roles r join public.profiles p on p.id = r.user_id
       where r.role = 'hod' and r.id <> old.id and r.revoked_at is null and p.is_active
     ) then
    perform app.raise_error('INVALID_STATE', 'The last active HOD cannot be removed');
  end if;
  return new;
end;
$$;

create trigger system_roles_protect_last_hod_revoke before update on public.system_roles
  for each row execute function app.protect_last_hod_revoke();

-- True when the user currently holds the role.
create or replace function app.holds_system_role(p_user_id uuid, p_role public.system_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.system_roles
                 where user_id = p_user_id and role = p_role and revoked_at is null);
$$;

-- Permission helpers ---------------------------------------------------------------
create or replace function app.is_hod()
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_active_user() and app.holds_system_role(auth.uid(), 'hod');
$$;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_active_user() and app.holds_system_role(auth.uid(), 'admin');
$$;

create or replace function app.has_admin_permission(p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_hod() or (app.is_active_user() and exists (
    select 1 from public.system_roles
    where user_id = auth.uid() and role = 'admin' and revoked_at is null
      and p_permission = any (admin_permissions)));
$$;

create or replace function app.can_view_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_active_user() and (
    p_profile_id = auth.uid()
    or app.is_hod() or app.is_admin()
    or app.holds_system_role(p_profile_id, 'hod')
    or exists (
      select 1
      from public.memberships me
      join public.memberships them on them.semester_id = me.semester_id
      where me.user_id = auth.uid() and me.is_active and them.user_id = p_profile_id
        and (me.role in ('lead_faculty', 'faculty') or them.role in ('lead_faculty', 'faculty'))
    )
  );
$$;

-- Context lists only roles currently held ----------------------------------------------
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
      from public.system_roles r where r.user_id = v_uid and r.revoked_at is null), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membership_id', m.id, 'semester_id', s.id, 'semester_name', s.name,
        'semester_status', s.status, 'role', m.role) order by s.created_at desc)
      from public.memberships m join public.semesters s on s.id = m.semester_id
      where m.user_id = v_uid and m.is_active), '[]'::jsonb)
  );
end;
$$;

-- Memberships: the HOD-needs-no-membership rule uses active roles only -------------------
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
  if app.holds_system_role(p_user_id, 'hod') then
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

-- Accounts ------------------------------------------------------------------------------
create or replace function public.app_set_user_active(p_user_id uuid, p_is_active boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
begin
  if not app.has_admin_permission('manage_users') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can activate or deactivate accounts');
  end if;
  if p_user_id = v_uid then
    perform app.raise_error('VALIDATION', 'You cannot deactivate your own account');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform app.raise_error('VALIDATION', 'Give a reason (at least 5 characters)', 'reason');
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    perform app.raise_error('NOT_FOUND', 'User not found');
  end if;
  if (app.holds_system_role(p_user_id, 'hod') or app.holds_system_role(p_user_id, 'admin'))
     and not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can change HOD or administrator accounts');
  end if;
  if not p_is_active and app.holds_system_role(p_user_id, 'hod')
     and not exists (select 1 from public.system_roles r join public.profiles p on p.id = r.user_id
                     where r.role = 'hod' and r.revoked_at is null and r.user_id <> p_user_id and p.is_active) then
    perform app.raise_error('INVALID_STATE', 'The last active HOD cannot be deactivated');
  end if;

  update public.profiles set is_active = p_is_active where id = p_user_id;
  perform app.log_action(case when p_is_active then 'user.reactivated' else 'user.deactivated' end,
                         'profiles', p_user_id, null, null, jsonb_build_object('reason', p_reason));
end;
$$;

-- System roles: grant re-activates a revoked row; revoke marks it ----------------------
create or replace function public.app_grant_system_role(
  p_user_id uuid,
  p_role public.system_role,
  p_admin_permissions text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
begin
  if not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can grant system roles');
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and is_active) then
    perform app.raise_error('NOT_FOUND', 'Active user not found');
  end if;
  if p_role = 'hod' and exists (select 1 from public.memberships where user_id = p_user_id and is_active) then
    perform app.raise_error('VALIDATION', 'Remove this user''s semester memberships before making them HOD');
  end if;
  begin
    insert into public.system_roles (user_id, role, admin_permissions, granted_by)
    values (p_user_id, p_role, case when p_role = 'admin' then coalesce(p_admin_permissions, '{}') else '{}' end, v_uid)
    on conflict (user_id, role) do update
      set admin_permissions = excluded.admin_permissions, granted_by = excluded.granted_by,
          granted_at = now(), revoked_at = null, revoked_by = null;
  exception when check_violation then
    perform app.raise_error('VALIDATION', 'Unknown administrator permission', 'admin_permissions');
  end;
  perform app.log_action('system_role.granted', 'system_roles', p_user_id, null, null,
    jsonb_build_object('role', p_role, 'admin_permissions', p_admin_permissions));
end;
$$;

create or replace function public.app_revoke_system_role(p_user_id uuid, p_role public.system_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
begin
  if not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can revoke system roles');
  end if;
  update public.system_roles
  set revoked_at = now(), revoked_by = v_uid
  where user_id = p_user_id and role = p_role and revoked_at is null;
  if not found then
    perform app.raise_error('NOT_FOUND', 'That user does not have this role');
  end if;
  perform app.log_action('system_role.revoked', 'system_roles', p_user_id, null, null,
    jsonb_build_object('role', p_role));
end;
$$;

create or replace function app.bootstrap_hod(p_email text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if exists (select 1 from public.system_roles where role = 'hod' and revoked_at is null) then
    raise exception 'An HOD already exists; use app_grant_system_role from the HOD account instead';
  end if;
  -- Compare as lower-case text: with an empty search_path the citext operators are not resolved.
  select id into v_user from public.profiles where lower(email::text) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No account with email %. Invite the user first (Authentication → Users).', p_email;
  end if;
  insert into public.system_roles (user_id, role) values (v_user, 'hod')
  on conflict (user_id, role) do update set revoked_at = null, revoked_by = null, granted_at = now();
  perform app.log_action('system_role.bootstrap_hod', 'system_roles', v_user);
  return v_user;
end;
$$;
