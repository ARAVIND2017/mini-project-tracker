-- Phase 2 — Authentication and faculty hierarchy (part 4d: RPC privileges)
-- Specs: USER_ROLES_AND_PERMISSIONS.md, DATABASE_SPEC.md §2, API_SPEC.md §4.1.

-- -----------------------------------------------------------------------------
-- Function privileges: RPCs for signed-in users only; app helpers stay private
-- except the policy helpers granted above.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.app_my_context(),
  public.app_create_semester(text, text, jsonb),
  public.app_update_semester(uuid, jsonb),
  public.app_activate_semester(uuid),
  public.app_close_semester(uuid),
  public.app_set_membership(uuid, uuid, public.semester_role, boolean),
  public.app_set_lead(uuid, uuid),
  public.app_set_user_active(uuid, boolean, text),
  public.app_grant_system_role(uuid, public.system_role, text[]),
  public.app_revoke_system_role(uuid, public.system_role)
from public, anon;

grant execute on function
  public.app_my_context(),
  public.app_create_semester(text, text, jsonb),
  public.app_update_semester(uuid, jsonb),
  public.app_activate_semester(uuid),
  public.app_close_semester(uuid),
  public.app_set_membership(uuid, uuid, public.semester_role, boolean),
  public.app_set_lead(uuid, uuid),
  public.app_set_user_active(uuid, boolean, text),
  public.app_grant_system_role(uuid, public.system_role, text[]),
  public.app_revoke_system_role(uuid, public.system_role)
to authenticated;
