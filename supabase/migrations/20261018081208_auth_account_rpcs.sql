-- Phase 2 — Authentication and faculty hierarchy (part 4b: account and system-role RPCs)
-- Specs: USER_ROLES_AND_PERMISSIONS.md, DATABASE_SPEC.md §2, API_SPEC.md §4.1.

-- -----------------------------------------------------------------------------
-- RPC: accounts and system roles
-- -----------------------------------------------------------------------------
-- Activates/deactivates an account in the database. The admin-users Edge Function
-- also bans/unbans the auth user so a deactivated user cannot sign in.
create or replace function public.app_set_user_active(p_user_id uuid, p_is_active boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_target_is_privileged boolean;
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
  select exists (select 1 from public.system_roles where user_id = p_user_id)
    into v_target_is_privileged;
  if v_target_is_privileged and not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can change HOD or administrator accounts');
  end if;
  if not p_is_active and exists (select 1 from public.system_roles where user_id = p_user_id and role = 'hod')
     and not exists (select 1 from public.system_roles r join public.profiles p on p.id = r.user_id
                     where r.role = 'hod' and r.user_id <> p_user_id and p.is_active) then
    perform app.raise_error('INVALID_STATE', 'The last active HOD cannot be deactivated');
  end if;

  update public.profiles set is_active = p_is_active where id = p_user_id;
  perform app.log_action(case when p_is_active then 'user.reactivated' else 'user.deactivated' end,
                         'profiles', p_user_id, null, null, jsonb_build_object('reason', p_reason));
end;
$$;

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
      set admin_permissions = excluded.admin_permissions, granted_by = excluded.granted_by, granted_at = now();
  exception when check_violation then
    perform app.raise_error('VALIDATION', 'Unknown administrator permission', 'admin_permissions');
  end;
  perform app.log_action('system_role.granted', 'system_roles', p_user_id, null, null,
    jsonb_build_object('role', p_role, 'admin_permissions', p_admin_permissions));
end;
$$;

-- -----------------------------------------------------------------------------
-- One-time bootstrap of the first HOD. Not granted to any API role: run it from the
-- Supabase SQL editor after inviting the HOD from Authentication → Users.
--   select app.bootstrap_hod('hod@example.edu');
-- -----------------------------------------------------------------------------
create or replace function app.bootstrap_hod(p_email text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if exists (select 1 from public.system_roles where role = 'hod') then
    raise exception 'An HOD already exists; use app_grant_system_role from the HOD account instead';
  end if;
  -- Compare as lower-case text: with an empty search_path the citext operators are not resolved.
  select id into v_user from public.profiles where lower(email::text) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No account with email %. Invite the user first (Authentication → Users).', p_email;
  end if;
  insert into public.system_roles (user_id, role) values (v_user, 'hod');
  perform app.log_action('system_role.bootstrap_hod', 'system_roles', v_user);
  return v_user;
end;
$$;

