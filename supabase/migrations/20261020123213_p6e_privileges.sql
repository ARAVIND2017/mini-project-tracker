-- Phase 6 — S6–S9 (part E: privileges)

revoke execute on function
  public.app_save_implementation_item(uuid, jsonb, uuid),
  public.app_save_evaluation_result(uuid, jsonb, uuid),
  public.app_save_draft(uuid, public.draft_section, jsonb),
  public.app_new_draft_version(uuid, public.draft_section),
  public.app_set_deliverable(uuid, public.deliverable_item, text, text, text),
  public.app_verify_deliverable(uuid, public.evidence_verification, text),
  public.app_set_panel(uuid, text, uuid[], uuid[], uuid),
  public.app_record_signoff(uuid, public.signoff_decision, text, text, text[])
from public, anon;

grant execute on function
  public.app_save_implementation_item(uuid, jsonb, uuid),
  public.app_save_evaluation_result(uuid, jsonb, uuid),
  public.app_save_draft(uuid, public.draft_section, jsonb),
  public.app_new_draft_version(uuid, public.draft_section),
  public.app_set_deliverable(uuid, public.deliverable_item, text, text, text),
  public.app_verify_deliverable(uuid, public.evidence_verification, text),
  public.app_set_panel(uuid, text, uuid[], uuid[], uuid),
  public.app_record_signoff(uuid, public.signoff_decision, text, text, text[])
to authenticated;

revoke execute on function
  app.ensure_deliverables(uuid), app.project_ensure_deliverables(), app.require_objectives_gate(public.projects),
  app.deliverable_category(public.deliverable_item), app.required_deliverables(uuid),
  app.count_target_corrections(public.review_target, uuid, public.correction_status[])
from public, anon, authenticated;
-- RLS-style helper used only by the workflow functions; kept private as well.
revoke execute on function app.is_panel_member_for(uuid) from public, anon, authenticated;
