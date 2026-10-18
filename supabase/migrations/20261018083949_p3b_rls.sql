-- Phase 3 — Students, domains and assignments (part B: permission helpers and RLS)
-- Specs: USER_ROLES_AND_PERMISSIONS.md §1 ("reviewer of project P"), §2, §4.

create or replace function app.project_semester(p_project_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select semester_id from public.projects where id = p_project_id;
$$;

-- The signed-in student owns this project.
create or replace function app.is_project_student(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_active_user() and exists (
    select 1 from public.projects p join public.students s on s.id = p.student_id
    where p.id = p_project_id and s.user_id = auth.uid() and s.status = 'active');
$$;

create or replace function app.can_view_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_faculty_level(app.project_semester(p_project_id))
      or app.is_admin()
      or app.is_project_student(p_project_id);
$$;

-- HOD, the semester's lead, the guide, an active co-reviewer, or a faculty member
-- with an active review authorization (USER_ROLES_AND_PERMISSIONS.md §1).
create or replace function app.is_project_reviewer(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_hod()
    or app.is_lead(app.project_semester(p_project_id))
    or (app.is_faculty_level(app.project_semester(p_project_id)) and (
          exists (select 1 from public.projects where id = p_project_id and guide_id = auth.uid())
       or exists (select 1 from public.project_reviewers
                  where project_id = p_project_id and user_id = auth.uid() and is_active)
       or exists (select 1 from public.review_authorizations
                  where project_id = p_project_id and faculty_id = auth.uid() and revoked_at is null
                    and (valid_until is null or valid_until > now()))));
$$;

-- A user who can act as faculty in the semester: HOD, or an active lead/faculty membership.
create or replace function app.is_faculty_member(p_user_id uuid, p_semester_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_user_id and is_active) and (
    app.holds_system_role(p_user_id, 'hod')
    or exists (select 1 from public.memberships
               where user_id = p_user_id and semester_id = p_semester_id and is_active
                 and role in ('lead_faculty', 'faculty')));
$$;

grant execute on function
  app.project_semester(uuid), app.is_project_student(uuid), app.can_view_project(uuid),
  app.is_project_reviewer(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: reads only. Every write goes through the RPC functions (parts C–E).
-- -----------------------------------------------------------------------------
alter table public.domains enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.faculty_expertise enable row level security;
alter table public.students enable row level security;
alter table public.student_drive_folders enable row level security;
alter table public.projects enable row level security;
alter table public.project_stages enable row level security;
alter table public.project_reviewers enable row level security;
alter table public.assignment_requests enable row level security;
alter table public.review_authorizations enable row level security;

revoke all on public.domains, public.evaluation_criteria, public.faculty_expertise, public.students,
  public.student_drive_folders, public.projects, public.project_stages, public.project_reviewers,
  public.assignment_requests, public.review_authorizations
from anon, authenticated;

grant select on public.domains, public.evaluation_criteria, public.faculty_expertise, public.students,
  public.student_drive_folders, public.projects, public.project_stages, public.project_reviewers,
  public.assignment_requests, public.review_authorizations
to authenticated;

-- Domains and criteria: everyone in the semester (students see their domain).
create policy domains_select on public.domains for select to authenticated
  using (app.is_semester_member(semester_id));
create policy evaluation_criteria_select on public.evaluation_criteria for select to authenticated
  using (exists (select 1 from public.domains d where d.id = domain_id and app.is_semester_member(d.semester_id)));

-- Expertise: faculty-level users and admins of the semester.
create policy faculty_expertise_select on public.faculty_expertise for select to authenticated
  using (app.is_faculty_level(semester_id) or app.is_admin());

-- Roster: faculty-level users and admins; a student sees only their own row.
create policy students_select on public.students for select to authenticated
  using (app.is_faculty_level(semester_id) or app.is_admin()
         or (user_id = (select auth.uid()) and app.is_active_user()));
create policy student_drive_folders_select on public.student_drive_folders for select to authenticated
  using (exists (select 1 from public.students s where s.id = student_id
                 and (app.is_faculty_level(s.semester_id) or app.is_admin()
                      or (s.user_id = (select auth.uid()) and app.is_active_user()))));

-- Projects and their stage/reviewer data: whoever may view the project.
create policy projects_select on public.projects for select to authenticated
  using (app.can_view_project(id));
create policy project_stages_select on public.project_stages for select to authenticated
  using (app.can_view_project(project_id));
create policy project_reviewers_select on public.project_reviewers for select to authenticated
  using (app.can_view_project(project_id));

-- Assignment requests and review authorizations: faculty-level users and admins only.
create policy assignment_requests_select on public.assignment_requests for select to authenticated
  using (app.is_faculty_level(app.project_semester(project_id)) or app.is_admin());
create policy review_authorizations_select on public.review_authorizations for select to authenticated
  using (app.is_faculty_level(app.project_semester(project_id)) or app.is_admin());

-- Audit log: the lead may read entries about projects in their semester (second,
-- permissive policy; the HOD/admin policy from Phase 2 still applies).
create policy audit_log_select_lead on public.audit_log for select to authenticated
  using (project_id is not null and app.is_lead(app.project_semester(project_id)));
