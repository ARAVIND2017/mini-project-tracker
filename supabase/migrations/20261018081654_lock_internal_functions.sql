-- Lock down function privileges.
-- Supabase grants EXECUTE on every new function, in every schema, to anon and
-- authenticated (global default privileges for the postgres role). Our internal
-- `app` helpers must not be callable through the API, and public RPCs must be
-- granted explicitly. Guarded by supabase/tests/998_function_privileges.sql.

-- 1. Future functions created by postgres: no automatic EXECUTE for API roles.
alter default privileges for role postgres revoke execute on functions from public, anon, authenticated;

-- 2. Existing internal helpers: close all, then re-open the allow-list that RLS
--    policies and triggers evaluate as the calling role.
revoke execute on all functions in schema app from public, anon, authenticated, service_role;

grant execute on function app.is_api_role(), app.raise_error(text, text, text)
  to anon, authenticated, service_role;

grant execute on function
  app.is_active_user(), app.is_hod(), app.is_admin(), app.has_admin_permission(text),
  app.semester_role(uuid), app.is_faculty_level(uuid), app.is_lead(uuid),
  app.is_semester_member(uuid), app.can_view_profile(uuid)
to authenticated;
