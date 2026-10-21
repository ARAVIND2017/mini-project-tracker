-- Phase 8 — Security review finding S8-1 (medium): signed-in users could rename their
-- own profile (full name, designation) directly through the API, which no screen uses.
-- A student could appear as "Dr …" in review threads. Names come from the HOD's
-- invitations and the roster, so the direct write path is closed.
revoke update (full_name, designation) on public.profiles from authenticated;
