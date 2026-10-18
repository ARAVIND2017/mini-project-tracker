-- Phase 2 — Authentication and faculty hierarchy (part 2 of 4: permission helpers and RLS)
-- Specs: USER_ROLES_AND_PERMISSIONS.md, DATABASE_SPEC.md §2, API_SPEC.md §4.1.

-- -----------------------------------------------------------------------------
-- Permission helpers (USER_ROLES_AND_PERMISSIONS.md §4). SECURITY DEFINER so that
-- policies can consult role tables without recursive RLS evaluation.
-- -----------------------------------------------------------------------------
create or replace function app.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;

create or replace function app.is_hod()
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_active_user() and exists (
    select 1 from public.system_roles where user_id = auth.uid() and role = 'hod');
$$;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_active_user() and exists (
    select 1 from public.system_roles where user_id = auth.uid() and role = 'admin');
$$;

-- HOD, or an admin holding the delegated permission.
create or replace function app.has_admin_permission(p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_hod() or (app.is_active_user() and exists (
    select 1 from public.system_roles
    where user_id = auth.uid() and role = 'admin' and p_permission = any (admin_permissions)));
$$;

create or replace function app.semester_role(p_semester_id uuid)
returns public.semester_role language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m
  where m.semester_id = p_semester_id and m.user_id = auth.uid() and m.is_active
    and app.is_active_user();
$$;

create or replace function app.is_faculty_level(p_semester_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_hod()
      or coalesce(app.semester_role(p_semester_id) in ('lead_faculty', 'faculty'), false);
$$;

create or replace function app.is_lead(p_semester_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(app.semester_role(p_semester_id) = 'lead_faculty', false);
$$;

create or replace function app.is_semester_member(p_semester_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_hod() or app.is_admin() or app.semester_role(p_semester_id) is not null;
$$;

-- Who may see whose profile: self, HOD/admin, anyone in a shared semester where at
-- least one side is faculty-level (students never see other students), and every
-- signed-in user may see the HOD.
create or replace function app.can_view_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_active_user() and (
    p_profile_id = auth.uid()
    or app.is_hod() or app.is_admin()
    or exists (select 1 from public.system_roles where user_id = p_profile_id and role = 'hod')
    or exists (
      select 1
      from public.memberships me
      join public.memberships them on them.semester_id = me.semester_id
      where me.user_id = auth.uid() and me.is_active and them.user_id = p_profile_id
        and (me.role in ('lead_faculty', 'faculty') or them.role in ('lead_faculty', 'faculty'))
    )
  );
$$;

create or replace function app.require_active_user()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not app.is_active_user() then
    perform app.raise_error('FORBIDDEN', 'Sign in with an active account');
  end if;
  return auth.uid();
end;
$$;

grant execute on function
  app.is_active_user(), app.is_hod(), app.is_admin(), app.has_admin_permission(text),
  app.semester_role(uuid), app.is_faculty_level(uuid), app.is_lead(uuid),
  app.is_semester_member(uuid), app.can_view_profile(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Row-level security. No INSERT/UPDATE/DELETE policies except profile self-edit:
-- every other change goes through the RPC functions below.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.system_roles enable row level security;
alter table public.semesters enable row level security;
alter table public.memberships enable row level security;

revoke all on public.profiles, public.system_roles, public.semesters, public.memberships
  from anon, authenticated;
grant select on public.profiles, public.system_roles, public.semesters, public.memberships
  to authenticated;
grant update (full_name, designation) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (app.can_view_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) and app.is_active_user())
  with check (id = (select auth.uid()));

create policy system_roles_select on public.system_roles for select to authenticated
  using (user_id = (select auth.uid()) or app.is_hod() or app.is_admin());

create policy semesters_select on public.semesters for select to authenticated
  using (app.is_semester_member(id));

create policy memberships_select on public.memberships for select to authenticated
  using (
    app.is_hod() or app.is_admin()
    or app.is_faculty_level(semester_id)
    or (app.is_semester_member(semester_id)
        and (user_id = (select auth.uid()) or role in ('lead_faculty', 'faculty')))
  );

-- Audit log: HOD and admin (lead's project-scoped access arrives with projects in Phase 3).
grant select on public.audit_log to authenticated;
create policy audit_log_select on public.audit_log for select to authenticated
  using (app.is_hod() or app.is_admin());

