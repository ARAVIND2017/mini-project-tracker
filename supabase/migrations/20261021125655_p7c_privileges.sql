-- Phase 7 — Dashboards, reports, notifications, meetings and audit (part C: privileges)

revoke execute on function
  public.app_mark_notifications_read(uuid[]),
  public.app_refresh_my_reminders(),
  public.app_escalate_to_hod(uuid, text),
  public.app_record_meeting(uuid, timestamptz, text, text, uuid[], jsonb)
from public, anon;

grant execute on function
  public.app_mark_notifications_read(uuid[]),
  public.app_refresh_my_reminders(),
  public.app_escalate_to_hod(uuid, text),
  public.app_record_meeting(uuid, timestamptz, text, text, uuid[], jsonb)
to authenticated;

revoke execute on function
  app.notify(uuid[], text, text, text, text, uuid, text),
  app.project_reviewer_ids(uuid),
  app.project_student_id(uuid),
  app.panel_member_ids(uuid),
  app.target_label(text),
  app.target_link(uuid, text, uuid),
  app.notify_from_audit()
from public, anon, authenticated;

-- Called internally only (by project_summary, which checks access).
revoke execute on function app.project_progress(uuid) from public, anon, authenticated;
-- Evaluated by the dashboard views as the caller: project_summary checks can_view_project
-- itself, and current_hod_ids returns only ids. Closed to anonymous visitors.
revoke execute on function app.project_summary(uuid), app.current_hod_ids() from public, anon;
grant execute on function app.project_summary(uuid), app.current_hod_ids() to authenticated;
