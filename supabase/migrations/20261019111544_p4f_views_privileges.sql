-- Phase 4 — Research stages S1–S5 (part F: projects view and privileges)

-- The project list also shows how many stages are waiting for a reviewer.
create or replace view public.v_projects with (security_invoker = true) as
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
  p.updated_at,
  (select count(*)::int from public.project_stages ps
   where ps.project_id = p.id and ps.status = 'awaiting_approval') as awaiting_review
from public.projects p
join public.students s on s.id = p.student_id
left join public.domains d on d.id = p.domain_id
left join public.profiles g on g.id = p.guide_id;

revoke all on public.v_projects from anon, authenticated;
grant select on public.v_projects to authenticated;

revoke execute on function
  public.app_save_exploration(uuid, jsonb),
  public.app_save_paper(uuid, jsonb, uuid),
  public.app_select_paper(uuid),
  public.app_withdraw_paper(uuid, text),
  public.app_save_analysis(uuid, jsonb),
  public.app_new_analysis_version(uuid),
  public.app_save_repository(uuid, jsonb),
  public.app_record_execution_attempt(uuid, timestamptz, public.attempt_outcome, text, text, text, jsonb),
  public.app_save_objective(uuid, jsonb),
  public.app_new_objective_version(uuid),
  public.app_add_evidence(uuid, public.stage_key, public.evidence_category, text, text),
  public.app_submit_record(public.review_target, uuid),
  public.app_address_correction(uuid, text, uuid[]),
  public.app_record_review(public.review_target, uuid, public.review_outcome, text, text, text[]),
  public.app_resolve_correction(uuid, text, text),
  public.app_verify_evidence(uuid, public.evidence_verification, text),
  public.app_approve_stage_exception(uuid, public.stage_key, text),
  public.app_override(uuid, text, text)
from public, anon;

grant execute on function
  public.app_save_exploration(uuid, jsonb),
  public.app_save_paper(uuid, jsonb, uuid),
  public.app_select_paper(uuid),
  public.app_withdraw_paper(uuid, text),
  public.app_save_analysis(uuid, jsonb),
  public.app_new_analysis_version(uuid),
  public.app_save_repository(uuid, jsonb),
  public.app_record_execution_attempt(uuid, timestamptz, public.attempt_outcome, text, text, text, jsonb),
  public.app_save_objective(uuid, jsonb),
  public.app_new_objective_version(uuid),
  public.app_add_evidence(uuid, public.stage_key, public.evidence_category, text, text),
  public.app_submit_record(public.review_target, uuid),
  public.app_address_correction(uuid, text, uuid[]),
  public.app_record_review(public.review_target, uuid, public.review_outcome, text, text, text[]),
  public.app_resolve_correction(uuid, text, text),
  public.app_verify_evidence(uuid, public.evidence_verification, text),
  public.app_approve_stage_exception(uuid, public.stage_key, text),
  public.app_override(uuid, text, text)
to authenticated;

-- Internal helpers added in Phase 4 stay private.
revoke execute on function
  app.check_keys(jsonb, text[]), app.jtext(jsonb, text, text, int), app.jtext_array(jsonb, text, text, int, int),
  app.valid_url(text, text, text), app.jurl(jsonb, text, text), app.jint(jsonb, text, text, int, int),
  app.missing_text(text, int, text), app.missing_items(text[], int, text), app.require_complete(text[]),
  app.min_text(text, int, text, text), app.require_student_project(uuid), app.require_reviewer(uuid, text),
  app.semester_week(uuid), app.stage_label(public.stage_key), app.stage_dependencies(public.stage_key),
  app.stage_done(uuid, public.stage_key), app.touch_stage(uuid, public.stage_key),
  app.set_stage_status(uuid, public.stage_key, public.stage_status, text),
  app.count_corrections(uuid, public.correction_status[]), app.selected_paper(uuid),
  app.analysis_fields(jsonb), app.target_project(public.review_target, uuid),
  app.awaiting_review(public.review_target, uuid), app.duplicate_paper_exists(public.papers),
  app.decide_version(text, uuid, uuid, public.stage_key, boolean)
from public, anon, authenticated;
