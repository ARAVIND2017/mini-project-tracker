-- Phase 7 — Dashboards, reports, notifications, meetings and audit (part B: dashboard views)
-- Specs: DATABASE_SPEC.md §10 (v_project_overview), PRD F9 (AC9.1 UI-02, AC9.2 DATA-09),
-- UI_UX_SPEC.md dashboards H1, L1, F1 and S1.

-- -----------------------------------------------------------------------------
-- Progress (DATA-09). Calculated, never stored, so nobody can set it by hand:
--   progress = Σ over the nine stages of weight × completion, where completion is
--   1 for an approved stage (or an approved exception), otherwise the share of the
--   stage's active weekly tasks that are verified (0 when it has none).
-- Weights come from the semester settings and total 100.
-- -----------------------------------------------------------------------------
create or replace function app.project_progress(p_project_id uuid)
returns table (progress int, breakdown jsonb)
language sql stable set search_path = '' as $$
  with stages as (
    select ps.stage_key,
           coalesce((se.stage_weights ->> ps.stage_key::text)::numeric, 0) as weight,
           case when ps.status in ('approved', 'exception_approved') then 1::numeric
                else coalesce(t.verified::numeric / nullif(t.total, 0), 0)
           end as completion
    from public.project_stages ps
    join public.projects p on p.id = ps.project_id
    join public.semesters se on se.id = p.semester_id
    left join (select k.stage_key, count(*) as total, count(*) filter (where k.status = 'verified') as verified
               from public.tasks k where k.project_id = p_project_id and k.is_active
               group by k.stage_key) t on t.stage_key = ps.stage_key
    where ps.project_id = p_project_id
  )
  select coalesce(round(sum(weight * completion))::int, 0),
         coalesce(jsonb_object_agg(stage_key, jsonb_build_object(
           'weight', weight, 'completion', round(completion, 3), 'points', round(weight * completion, 1))), '{}')
  from stages;
$$;

-- Everything the overview adds to a project row, read in one pass. Row-level security
-- would otherwise be checked on every task, stage and correction row (too slow for the
-- dashboards), so this checks access once for the project and then reads directly.
-- Returns no row for a project the caller cannot view.
create or replace function app.project_summary(p_project_id uuid)
returns table (
  progress int,
  progress_breakdown jsonb,
  stage_statuses jsonb,
  overdue_tasks int,
  blocked_tasks int,
  open_corrections int,
  addressed_corrections int,
  oldest_open_correction timestamptz,
  selected_paper_title text,
  execution_status public.execution_status,
  objective_status public.record_status,
  last_activity timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    pr.progress,
    pr.breakdown,
    (select jsonb_object_agg(ps.stage_key, ps.status) from public.project_stages ps where ps.project_id = p_project_id),
    (select count(*)::int from public.tasks k
     where k.project_id = p_project_id and k.is_active and k.due_at < now()
       and k.status in ('not_started', 'in_progress', 'changes_requested')),
    (select count(*)::int from public.tasks k where k.project_id = p_project_id and k.is_active and k.blocked),
    c.open,
    c.addressed,
    c.oldest_open,
    (select x.title from public.papers x where x.project_id = p_project_id and x.is_selected limit 1),
    (select r.status from public.code_repositories r where r.project_id = p_project_id and r.is_current
     order by r.created_at desc limit 1),
    (select o.status from public.objective_versions o where o.project_id = p_project_id order by o.version desc limit 1),
    (select max(a.created_at) from public.audit_log a where a.project_id = p_project_id)
  from app.project_progress(p_project_id) pr
  cross join lateral (
    select count(*) filter (where status = 'open')::int as open,
           count(*) filter (where status = 'addressed')::int as addressed,
           min(created_at) filter (where status = 'open') as oldest_open
    from public.corrections where project_id = p_project_id) c
  where app.can_view_project(p_project_id);
$$;

-- -----------------------------------------------------------------------------
-- v_project_overview: one row per project for the dashboards and the projects list.
-- -----------------------------------------------------------------------------
create or replace view public.v_project_overview with (security_invoker = true) as
select
  v.*,
  ps.progress,
  ps.progress_breakdown,
  ps.stage_statuses,
  ps.overdue_tasks,
  ps.blocked_tasks,
  ps.open_corrections,
  ps.addressed_corrections,
  ps.oldest_open_correction,
  ps.selected_paper_title,
  ps.execution_status,
  ps.objective_status,
  greatest(v.updated_at, ps.last_activity) as last_activity
from public.v_projects v
cross join lateral app.project_summary(v.id) ps;

-- -----------------------------------------------------------------------------
-- v_task_flags: active tasks that are overdue (past the deadline with nothing submitted
-- since changes were last requested) or blocked.
-- -----------------------------------------------------------------------------
create or replace view public.v_task_flags with (security_invoker = true) as
select
  k.id as task_id,
  k.project_id,
  p.semester_id,
  k.week_no,
  k.stage_key,
  k.title,
  k.status,
  k.due_at,
  k.blocked,
  k.blocked_reason,
  (k.due_at < now() and k.status in ('not_started', 'in_progress', 'changes_requested')) as is_overdue,
  greatest(0, floor(extract(epoch from now() - k.due_at) / 86400))::int as days_overdue,
  st.slot_no,
  st.full_name as student_name,
  p.guide_id
from public.tasks k
join public.projects p on p.id = k.project_id
join public.students st on st.id = p.student_id
where k.is_active
  and (k.blocked or (k.due_at < now() and k.status in ('not_started', 'in_progress', 'changes_requested')));

-- -----------------------------------------------------------------------------
-- v_faculty_workload (H1, L1): per faculty member of a semester (and the HOD). Only the
-- lead, the HOD and admins see it.
-- -----------------------------------------------------------------------------
-- Who holds the HOD role (the workload view lists the HOD too; system_roles itself is
-- visible only to the HOD and admins).
create or replace function app.current_hod_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select user_id from public.system_roles where role = 'hod' and revoked_at is null;
$$;

create or replace view public.v_faculty_workload with (security_invoker = true) as
with people as (
  select m.semester_id, m.user_id, m.role::text as role
  from public.memberships m
  where m.is_active and m.role in ('lead_faculty', 'faculty')
  union
  select se.id, r.user_id, 'hod'
  from public.semesters se
  cross join app.current_hod_ids() r(user_id)
  where not exists (select 1 from public.memberships m
                    where m.semester_id = se.id and m.user_id = r.user_id and m.is_active)
),
queue as (
  select q.semester_id, u.user_id, q.waiting_since
  from public.v_review_queue q
  cross join lateral unnest(q.reviewer_ids) u(user_id)
),
decided as (
  -- Turnaround: from the submission (or record submission) to the first decision on it.
  select rv.reviewer_id, p.semester_id, rv.created_at,
         extract(epoch from rv.created_at - coalesce(
           (select s.submitted_at from public.submissions s where s.id = rv.target_id),
           (select max(a.created_at) from public.audit_log a
            where a.action = 'record.submitted' and a.row_id = rv.target_id and a.created_at <= rv.created_at)
         )) / 3600 as hours
  from public.reviews rv
  join public.projects p on p.id = rv.project_id
  where rv.outcome <> 'comment_only'
)
select
  pe.semester_id,
  pe.user_id,
  f.full_name,
  pe.role,
  (select count(*)::int from public.projects p where p.semester_id = pe.semester_id and p.guide_id = pe.user_id)
    as guided_projects,
  (select count(*)::int from public.project_reviewers r join public.projects p on p.id = r.project_id
   where p.semester_id = pe.semester_id and r.user_id = pe.user_id and r.is_active) as co_reviewed_projects,
  (select count(*)::int from queue q where q.semester_id = pe.semester_id and q.user_id = pe.user_id)
    as pending_reviews,
  (select min(q.waiting_since) from queue q where q.semester_id = pe.semester_id and q.user_id = pe.user_id)
    as oldest_waiting_since,
  (select round(avg(d.hours)::numeric, 1) from decided d
   where d.semester_id = pe.semester_id and d.reviewer_id = pe.user_id and d.hours is not null)
    as avg_turnaround_hours,
  (select count(*)::int from decided d
   where d.semester_id = pe.semester_id and d.reviewer_id = pe.user_id and d.created_at > now() - interval '7 days')
    as reviews_last_7_days,
  (select count(*)::int from public.corrections c join public.reviews rv on rv.id = c.review_id
   join public.projects p on p.id = c.project_id
   where p.semester_id = pe.semester_id and rv.reviewer_id = pe.user_id and c.status = 'addressed')
    as corrections_to_verify
from people pe
join public.profiles f on f.id = pe.user_id
where app.is_hod() or app.is_admin() or app.is_lead(pe.semester_id);

revoke all on public.v_project_overview, public.v_task_flags, public.v_faculty_workload from anon, authenticated;
grant select on public.v_project_overview, public.v_task_flags, public.v_faculty_workload to authenticated;
