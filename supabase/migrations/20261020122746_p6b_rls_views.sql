-- Phase 6 — S6–S9 (part B: row-level security and the read models for sign-off)

alter table public.implementation_items enable row level security;
alter table public.evaluation_results enable row level security;
alter table public.paper_drafts enable row level security;
alter table public.final_deliverables enable row level security;
alter table public.panels enable row level security;
alter table public.panel_members enable row level security;
alter table public.panel_projects enable row level security;
alter table public.final_signoffs enable row level security;

revoke all on public.implementation_items, public.evaluation_results, public.paper_drafts, public.final_deliverables,
  public.panels, public.panel_members, public.panel_projects, public.final_signoffs
from anon, authenticated;
grant select on public.implementation_items, public.evaluation_results, public.paper_drafts, public.final_deliverables,
  public.panels, public.panel_members, public.panel_projects, public.final_signoffs
to authenticated;

create policy implementation_items_select on public.implementation_items for select to authenticated
  using (app.can_view_project(project_id));
create policy evaluation_results_select on public.evaluation_results for select to authenticated
  using (app.can_view_project(project_id));
create policy paper_drafts_select on public.paper_drafts for select to authenticated
  using (app.can_view_project(project_id));
create policy final_deliverables_select on public.final_deliverables for select to authenticated
  using (app.can_view_project(project_id));
create policy final_signoffs_select on public.final_signoffs for select to authenticated
  using (app.can_view_project(project_id));

-- Panels and their members are visible in the semester; a student sees only their own
-- project's panel assignment.
create policy panels_select on public.panels for select to authenticated
  using (app.is_semester_member(semester_id) or app.is_admin());
create policy panel_members_select on public.panel_members for select to authenticated
  using (exists (select 1 from public.panels p where p.id = panel_id
                 and (app.is_semester_member(p.semester_id) or app.is_admin())));
create policy panel_projects_select on public.panel_projects for select to authenticated
  using (app.can_view_project(project_id));

-- -----------------------------------------------------------------------------
-- v_timeliness (WORKFLOW_SPEC.md §6): per project, counted on each task's first
-- submission. Overdue and lateness are facts for the panel, not a grade.
-- -----------------------------------------------------------------------------
create view public.v_timeliness with (security_invoker = true) as
select
  p.id as project_id,
  p.semester_id,
  count(k.id) filter (where k.due_at < now())::int as tasks_due,
  count(k.id) filter (where f.is_late = false)::int as submitted_on_time,
  count(k.id) filter (where f.is_late)::int as submitted_late,
  round((avg(extract(epoch from f.submitted_at - f.due_at_snapshot) / 86400) filter (where f.is_late))::numeric, 1)
    as avg_days_late,
  count(k.id) filter (where k.due_at < now() and f.id is null and k.status <> 'verified')::int as overdue_without_submission,
  round(avg(v.versions)::numeric, 2) as avg_review_cycles
from public.projects p
left join public.tasks k on k.project_id = p.id and k.is_active
left join lateral (
  select s.id, s.is_late, s.submitted_at, s.due_at_snapshot from public.submissions s
  where s.task_id = k.id order by s.version limit 1
) f on true
left join lateral (
  select count(*) as versions from public.submissions s where s.task_id = k.id having count(*) > 0
) v on true
group by p.id, p.semester_id;

-- -----------------------------------------------------------------------------
-- v_duplicate_warnings (WORKFLOW_SPEC.md §6): values shared by projects in a semester.
-- Duplicate approved papers are blocked unless the HOD overrides; the rest are warnings.
-- -----------------------------------------------------------------------------
create view public.v_duplicate_warnings with (security_invoker = true) as
select pr.semester_id, 'paper_doi'::text as kind, x.doi::text as value,
       array_agg(distinct x.project_id) as project_ids
from public.papers x join public.projects pr on pr.id = x.project_id
where x.doi is not null and x.status in ('submitted', 'approved')
group by pr.semester_id, x.doi::text having count(distinct x.project_id) > 1
union all
select pr.semester_id, 'paper_title', x.title_normalized, array_agg(distinct x.project_id)
from public.papers x join public.projects pr on pr.id = x.project_id
where x.status in ('submitted', 'approved')
group by pr.semester_id, x.title_normalized having count(distinct x.project_id) > 1
union all
select pr.semester_id, 'repository_url', lower(r.repo_url), array_agg(distinct r.project_id)
from public.code_repositories r join public.projects pr on pr.id = r.project_id
where r.is_current
group by pr.semester_id, lower(r.repo_url) having count(distinct r.project_id) > 1
union all
select p.semester_id, 'project_title', btrim(regexp_replace(lower(p.title), '[^[:alnum:]]+', ' ', 'g')),
       array_agg(distinct p.id)
from public.projects p
where p.title is not null
group by p.semester_id, btrim(regexp_replace(lower(p.title), '[^[:alnum:]]+', ' ', 'g')) having count(*) > 1;

-- -----------------------------------------------------------------------------
-- The review queue also lists S7 result sets, S8 sections and projects waiting for sign-off
-- (the panel's items appear for every reviewer; the sign-off itself is for panel members).
-- -----------------------------------------------------------------------------
create or replace view public.v_review_queue with (security_invoker = true) as
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
  select 'record', 'evaluation', pr.id, pr.id, pr.id, 'evaluation', 'Evaluation results', max(er.submitted_at),
         null, null, 'submitted'
  from public.evaluation_results er join public.projects pr on pr.id = er.project_id
  where er.status = 'submitted' group by pr.id
  union all
  select 'record', 'draft_section', d.id, d.id, d.project_id, 'paper_writing',
         format('Paper section: %s v%s', replace(d.section::text, '_', ' '), d.version), d.submitted_at,
         d.version, null, d.status::text
  from public.paper_drafts d where d.status = 'submitted'
  union all
  select 'record', 'final', ps.project_id, ps.project_id, ps.project_id, 'final', 'Final sign-off (panel)', ps.updated_at,
         null, null, ps.status::text
  from public.project_stages ps where ps.stage_key = 'final' and ps.status = 'awaiting_approval'
  union all
  select 'correction', c.target_type, c.target_id, c.id, c.project_id,
         case c.target_type
           when 'exploration' then 'exploration'
           when 'paper' then 'paper_selection'
           when 'paper_analysis' then 'paper_analysis'
           when 'repository' then 'code_execution'
           when 'objective' then 'objectives'
           when 'evaluation' then 'evaluation'
           when 'draft_section' then 'paper_writing'
           when 'final' then 'final'
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

revoke all on public.v_timeliness, public.v_duplicate_warnings from anon, authenticated;
grant select on public.v_timeliness, public.v_duplicate_warnings to authenticated;
