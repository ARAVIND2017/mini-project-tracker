-- Phase 3 — Students, domains and assignments (part F: projects view and privileges)

-- One row per project with the names the lists need (PRD D4: always show the guide).
-- security_invoker: the caller's row-level security applies to every table used.
create view public.v_projects with (security_invoker = true) as
select
  p.id,
  p.semester_id,
  p.student_id,
  s.slot_no,
  s.institution_id,
  s.full_name as student_name,
  s.email as student_email,
  s.status as roster_status,
  s.user_id as student_user_id,
  p.domain_id,
  d.name as domain_name,
  p.title,
  p.guide_id,
  g.full_name as guide_name,
  coalesce((select array_agg(rp.full_name order by rp.full_name)
            from public.project_reviewers r join public.profiles rp on rp.id = r.user_id
            where r.project_id = p.id and r.is_active), '{}') as co_reviewer_names,
  (select count(*)::int from public.assignment_requests a
   where a.project_id = p.id and a.status = 'pending') as pending_requests,
  (select ps.stage_key from public.project_stages ps
   where ps.project_id = p.id and ps.status not in ('approved', 'exception_approved')
   order by ps.stage_key limit 1) as current_stage,
  p.blocked,
  p.is_completed,
  p.updated_at
from public.projects p
join public.students s on s.id = p.student_id
left join public.domains d on d.id = p.domain_id
left join public.profiles g on g.id = p.guide_id;

revoke all on public.v_projects from anon, authenticated;
grant select on public.v_projects to authenticated;

-- RPCs for signed-in users only (each checks permissions itself).
revoke execute on function
  public.app_upsert_domain(uuid, text, text, boolean, uuid),
  public.app_upsert_criterion(uuid, text, text, int, boolean, uuid),
  public.app_set_expertise(uuid, uuid[], uuid),
  public.app_import_roster(uuid, jsonb, boolean),
  public.app_update_student(uuid, jsonb),
  public.app_add_empty_slots(uuid, int),
  public.app_withdraw_student(uuid, text),
  public.app_link_student(uuid, uuid),
  public.app_set_my_drive_folder(uuid, text),
  public.app_set_project_domain(uuid, uuid),
  public.app_set_project_title(uuid, text),
  public.app_request_assignment(uuid, public.assignment_type, uuid, text),
  public.app_cancel_assignment_request(uuid),
  public.app_decide_assignment_request(uuid, boolean, text),
  public.app_assign_guide(uuid, uuid, text),
  public.app_remove_co_reviewer(uuid, uuid, text),
  public.app_grant_review_authorization(uuid, uuid, timestamptz, text),
  public.app_revoke_review_authorization(uuid)
from public, anon;

grant execute on function
  public.app_upsert_domain(uuid, text, text, boolean, uuid),
  public.app_upsert_criterion(uuid, text, text, int, boolean, uuid),
  public.app_set_expertise(uuid, uuid[], uuid),
  public.app_import_roster(uuid, jsonb, boolean),
  public.app_update_student(uuid, jsonb),
  public.app_add_empty_slots(uuid, int),
  public.app_withdraw_student(uuid, text),
  public.app_link_student(uuid, uuid),
  public.app_set_my_drive_folder(uuid, text),
  public.app_set_project_domain(uuid, uuid),
  public.app_set_project_title(uuid, text),
  public.app_request_assignment(uuid, public.assignment_type, uuid, text),
  public.app_cancel_assignment_request(uuid),
  public.app_decide_assignment_request(uuid, boolean, text),
  public.app_assign_guide(uuid, uuid, text),
  public.app_remove_co_reviewer(uuid, uuid, text),
  public.app_grant_review_authorization(uuid, uuid, timestamptz, text),
  public.app_revoke_review_authorization(uuid)
to authenticated;

-- Internal helpers added in Phase 3 stay private (the policy helpers were granted in part B).
revoke execute on function
  app.require_open_semester(uuid), app.ensure_project(uuid), app.roster_field_error(text, text, text, text),
  app.is_faculty_member(uuid, uuid), app.project_for_update(uuid), app.apply_guide(uuid, uuid),
  app.derive_student_status(), app.check_roster_capacity()
from public, anon, authenticated;
