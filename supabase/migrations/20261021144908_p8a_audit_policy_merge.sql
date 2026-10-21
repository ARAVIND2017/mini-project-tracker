-- Phase 8 — audit_log: the main read policy now also covers the lead's project rows
-- (same rule as audit_log_select_lead, which becomes redundant).
alter policy audit_log_select on public.audit_log
  using (app.is_hod() or app.is_admin()
         or (project_id is not null and app.is_lead(app.project_semester(project_id))));
