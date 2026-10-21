-- Phase 8 — consistency review: one definition of "overdue" everywhere.
-- WORKFLOW_SPEC.md §1 and PRD AC6.7: overdue = the deadline has passed and the task is
-- not verified (computed, never stored). v_tasks already used it; the Phase 7 dashboard
-- views counted only tasks waiting for the student, so the dashboards and the weekly
-- task list could disagree. Work waiting for faculty is shown by the review queue.
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
     where k.project_id = p_project_id and k.is_active and k.due_at < now() and k.status <> 'verified'),
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
  (k.due_at < now() and k.status <> 'verified') as is_overdue,
  greatest(0, floor(extract(epoch from now() - k.due_at) / 86400))::int as days_overdue,
  st.slot_no,
  st.full_name as student_name,
  p.guide_id
from public.tasks k
join public.projects p on p.id = k.project_id
join public.students st on st.id = p.student_id
where k.is_active
  and (k.blocked or (k.due_at < now() and k.status <> 'verified'));

