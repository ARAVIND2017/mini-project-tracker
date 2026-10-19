-- Phase 5 — Weekly tasks (part E: privileges)

revoke execute on function
  public.app_upsert_milestone(uuid, int, jsonb),
  public.app_upsert_task_template(uuid, jsonb, uuid),
  public.app_generate_tasks(uuid, uuid, boolean),
  public.app_start_task(uuid),
  public.app_submit_task(uuid, text, jsonb, uuid[]),
  public.app_start_review(uuid),
  public.app_set_blocked(text, uuid, boolean, text)
from public, anon;

grant execute on function
  public.app_upsert_milestone(uuid, int, jsonb),
  public.app_upsert_task_template(uuid, jsonb, uuid),
  public.app_generate_tasks(uuid, uuid, boolean),
  public.app_start_task(uuid),
  public.app_submit_task(uuid, text, jsonb, uuid[]),
  public.app_start_review(uuid),
  public.app_set_blocked(text, uuid, boolean, text)
to authenticated;

revoke execute on function
  app.week_due_at(uuid, int), app.seed_default_plan(uuid), app.effective_template_ids(uuid),
  app.generate_project_tasks(uuid, boolean), app.semester_seed_plan(), app.semester_generate_on_activate(),
  app.project_generate_tasks(), app.require_plan_editor(uuid), app.count_task_corrections(uuid, public.correction_status[]),
  app.task_for_student(uuid)
from public, anon, authenticated;
