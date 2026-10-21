# Security review (Phase 8)

Date: 2026-10-21 · Scope: the live Supabase project, the database migrations, the `admin-users` Edge Function, and the React app.

## Summary

- **No critical or high findings.**
- **One medium finding, fixed:** S8-1, users could rename their own profile.
- **Two low items, accepted.**
- **One advisor warning, accepted by design.**

## Method

| Check | How | Result |
|---|---|---|
| **Authorization matrix** | `supabase/tests/900_permission_matrix.sql`: every workflow function (68 actions) run as 13 kinds of caller, each attempt rolled back — 884 cells. The expectations come from `supabase/tests/permission_matrix.json`, which is also rendered as [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) (CI fails if they differ). A test also fails if any workflow function is missing from the matrix. | All cells as expected |
| **Direct writes** | The same test tries insert, update and delete on every table, and an update of **every column** of every table, as different callers | All refused, after S8-1 was fixed |
| **Read isolation** | The same test counts project A's rows in all 19 project tables and views, for every caller. It also checks the workload view and the two audit-log scopes. | As expected: a student sees only their own project |
| **RLS audit** | The live catalogue: RLS on every table; the policies on each table; the privileges of API roles | 41 tables, RLS on all; select policies only; no table or column writable by `authenticated` or `anon` (live check after S8-1) |
| **Internal functions** | `998_function_privileges.sql`, plus a live query | No `app.*` helper callable outside the allow-list; nothing callable by `anon` |
| **Supabase security advisor** | Live | One warning type (below), accepted by design |
| **Supabase performance advisor** | Live | Unused indexes (INFO, expected on an almost empty database); two read policies on `audit_log` (S8-3) |
| **Dependencies** | `pnpm audit` (all, and production only); CI runs `pnpm audit --prod --audit-level high` on every push | No known vulnerabilities |
| **Bundle secrets** | `scripts/scan-bundle.mjs` on every build (SEC-11) | No service-role key or secret in `dist` |
| **Errors (SEC-13)** | Review of `src/lib/errors.ts` and the Edge Function | Only known `CODE: message` errors are shown; anything else becomes a generic message. The Edge Function logs unexpected errors on the server and returns a generic response |
| **Edge Function (SEC-14)** | Code review; Phase 2 tests | The token is verified with `auth.getUser`; the caller's active status and HOD/admin permission are checked before every action; the service-role key is only in the function's environment |
| **Accessibility** | `e2e/accessibility.spec.ts`: axe-core, WCAG 2.1 A and AA | See the Phase 8 report |
| **Backup and restore** | `scripts/backup-drill.sh` | See the Phase 8 report |

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| S8-1 | **Medium** | Signed-in users could change their own `full_name` and `designation` directly through the API (a Phase 2 column grant that no screen used). A student could rename themselves to look like faculty in review threads and notifications, without an audit entry. | **Fixed:** grant revoked (migration `p8b_profile_names`, live). The test checks every column of every table so this cannot come back unnoticed. Test 002 now expects the refusal. If self-service name changes are wanted later, add a workflow function that audits the change and lets the HOD approve it. |
| S8-2 | Low | The Edge Function answers CORS requests from any origin (`*`). The risk is low because it authenticates with a bearer token, not cookies, so another site cannot act on a user's behalf. | **Accepted for now.** Set the production site's address in Phase 9. |
| S8-3 | Low (performance) | `audit_log` has two permissive read policies (HOD/admin and lead), which the advisor flags. | **Partly fixed:** the main policy now contains both rules (migration `p8a_audit_policy_merge`, live). The redundant lead policy is still in place because the `DROP POLICY` needs a confirmation that can't be given from this session. It grants nothing extra. Remove it from the Supabase SQL editor with `drop policy audit_log_select_lead on public.audit_log;` |
| A-1 | Advisor WARN ×65 | "Signed-in users can execute SECURITY DEFINER function" on every `public.app_*` function. | **Accepted by design.** These functions are the only way to write. Each checks the caller itself (`require_active_user`, role and project checks). The authorization matrix proves this cell by cell, and none is callable by `anon`. |

## Items for production (Phase 9)

- **Supabase Auth settings (dashboard):**
  - turn off public sign-up;
  - set the minimum password length and strength;
  - add the production site to the redirect allow-list;
  - set up custom SMTP.
- **Paid Supabase plan,** for daily backups and point-in-time recovery; the free tier has no backups.
- **CORS on the Edge Function:** limit it to the production origin (S8-2).
- **Remove the redundant audit policy** (S8-3).
