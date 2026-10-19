-- Phase 5 — Weekly tasks (part C: row-level security and read models)

alter table public.milestones enable row level security;
alter table public.task_templates enable row level security;
alter table public.tasks enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_evidence enable row level security;

revoke all on public.milestones, public.task_templates, public.tasks, public.submissions, public.submission_evidence
from anon, authenticated;
grant select on public.milestones, public.task_templates, public.tasks, public.submissions, public.submission_evidence
to authenticated;

-- The plan is visible to everyone in the semester (students see what each week asks for).
create policy milestones_select on public.milestones for select to authenticated
  using (app.is_semester_member(semester_id) or app.is_admin());
create policy task_templates_select on public.task_templates for select to authenticated
  using (app.is_semester_member(semester_id) or app.is_admin());

create policy tasks_select on public.tasks for select to authenticated
  using (app.can_view_project(project_id));
create policy submissions_select on public.submissions for select to authenticated
  using (app.can_view_project(project_id));
create policy submission_evidence_select on public.submission_evidence for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id and app.can_view_project(s.project_id)));

-- -----------------------------------------------------------------------------
-- v_tasks: active tasks with the computed flags (FUN-11: overdue is never stored).
-- -----------------------------------------------------------------------------
create view public.v_tasks with (security_invoker = true) as
select
  k.id,
  k.project_id,
  p.semester_id,
  k.template_id,
  k.week_no,
  k.stage_key,
  k.title,
  k.description,
  k.acceptance_criteria,
  k.required_evidence,
  k.due_at,
  k.status,
  k.blocked,
  k.blocked_reason,
  k.blocked_at,
  k.blocked_by,
  (k.status <> 'verified' and now() > k.due_at) as is_overdue,
  latest.version as latest_version,
  latest.submitted_at as latest_submitted_at,
  latest.is_late as latest_is_late,
  coalesce(latest.version, 0) as submission_count,
  (select count(*)::int from public.corrections c join public.submissions s on s.id = c.target_id
   where c.target_type = 'task_submission' and s.task_id = k.id and c.status in ('open', 'addressed')) as outstanding_corrections,
  k.updated_at
from public.tasks k
join public.projects p on p.id = k.project_id
left join lateral (
  select s.version, s.submitted_at, s.is_late from public.submissions s
  where s.task_id = k.id order by s.version desc limit 1
) latest on true
where k.is_active;

-- -----------------------------------------------------------------------------
-- v_review_queue: everything waiting for a reviewer — task submissions, stage records
-- and corrections the student has addressed. reviewer_ids lists the guide,
-- co-reviewers and faculty with an active authorization ("Mine"); the lead and the HOD
-- review everything.
-- -----------------------------------------------------------------------------
create view public.v_review_queue with (security_invoker = true) as
with items as (
  select 'submission'::text as item_type, 'task_submission'::public.review_target as target_type,
         s.id as target_id, s.id as item_id, k.project_id, k.stage_key,
         format('Week %s: %s', k.week_no, k.title) as title, s.submitted_at as waiting_since,
         s.version, s.is_late, k.status::text as item_status
  from public.tasks k
  join lateral (select * from public.submissions s where s.task_id = k.id order by s.version desc limit 1) s on true
  where k.is_active and k.status in ('submitted', 'resubmitted', 'under_review')
  union all
  select 'record', 'exploration', e.id, e.id, e.project_id, 'exploration', 'Exploration', e.submitted_at,
         null::int, null::boolean, e.status::text
  from public.research_explorations e where e.status = 'submitted'
  union all
  select 'record', 'paper', x.id, x.id, x.project_id, 'paper_selection', format('Paper: %s', x.title), x.submitted_at,
         null, null, x.status::text
  from public.papers x where x.status = 'submitted'
  union all
  select 'record', 'paper_analysis', a.id, a.id, a.project_id, 'paper_analysis', format('Paper analysis v%s', a.version),
         a.submitted_at, a.version, null, a.status::text
  from public.paper_analyses a where a.status = 'submitted'
  union all
  select 'record', 'repository', r.id, r.id, r.project_id, 'code_execution', 'Code execution verification', r.submitted_at,
         null, null, r.status::text
  from public.code_repositories r where r.is_current and r.status = 'verification_pending'
  union all
  select 'record', 'objective', o.id, o.id, o.project_id, 'objectives', format('Objectives v%s', o.version), o.submitted_at,
         o.version, null, o.status::text
  from public.objective_versions o where o.status = 'submitted'
  union all
  select 'correction', c.target_type, c.target_id, c.id, c.project_id,
         case c.target_type
           when 'exploration' then 'exploration'
           when 'paper' then 'paper_selection'
           when 'paper_analysis' then 'paper_analysis'
           when 'repository' then 'code_execution'
           when 'objective' then 'objectives'
           else (select k.stage_key::text from public.submissions s join public.tasks k on k.id = s.task_id where s.id = c.target_id)
         end::public.stage_key,
         format('Correction to verify: %s', c.description), c.addressed_at, null, null, c.status::text
  from public.corrections c where c.status = 'addressed'
)
select
  i.item_type,
  i.target_type,
  i.target_id,
  i.item_id,
  i.project_id,
  p.semester_id,
  i.stage_key,
  i.title,
  i.waiting_since,
  i.version,
  i.is_late,
  i.item_status,
  st.slot_no,
  st.full_name as student_name,
  p.guide_id,
  g.full_name as guide_name,
  array_remove(
    array[p.guide_id]
    || coalesce((select array_agg(r.user_id) from public.project_reviewers r where r.project_id = p.id and r.is_active), '{}')
    || coalesce((select array_agg(a.faculty_id) from public.review_authorizations a
                 where a.project_id = p.id and a.revoked_at is null and (a.valid_until is null or a.valid_until > now())), '{}'),
    null) as reviewer_ids
from items i
join public.projects p on p.id = i.project_id
join public.students st on st.id = p.student_id
left join public.profiles g on g.id = p.guide_id;

revoke all on public.v_tasks, public.v_review_queue from anon, authenticated;
grant select on public.v_tasks, public.v_review_queue to authenticated;
