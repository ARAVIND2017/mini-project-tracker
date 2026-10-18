# Phase 2 Report — Authentication and Faculty Hierarchy

Date: 2026-10-18 · Status: **built, tested and deployed to Supabase. Needs your setup steps below, then approval to start Phase 3.**

## What was delivered

### Database (live on Supabase project `utkekzbkdtcbmupbxmpp`)

| Item | Detail |
|---|---|
| Tables | `profiles` (created automatically for each new auth user), `system_roles` (HOD/admin, soft revoke), `semesters` (all settings from the plan), `memberships` (lead/faculty/student per semester) |
| Rules in the database | One active lead per semester; faculty automatically report to the current lead; semester settings checked (timezone, stage weights total 100, lab end after start, paper-change cutoff within the weeks); closed semesters read-only; last active HOD cannot be revoked or deactivated; the HOD needs no membership |
| Row-level security | Students see only themselves, their faculty and the HOD — never other students. Faculty see everyone in their semester. Non-members see no semesters. Deactivated users see nothing. |
| Workflow functions (RPCs) | `app_my_context`, `app_create_semester`, `app_update_semester`, `app_activate_semester`, `app_close_semester`, `app_set_membership`, `app_set_lead`, `app_set_user_active`, `app_grant_system_role`, `app_revoke_system_role` |
| One-time setup | `app.bootstrap_hod(email)` — makes the first HOD; cannot be called from the app |
| Audit | Every change to these tables, and every workflow action, is written to `audit_log` with the person who did it. Only the HOD/admin can read it. |

Migrations (in `supabase/migrations/`, matching the versions recorded in Supabase): `auth_tables`, `auth_rls`, `auth_semester_rpcs`, `auth_membership_rpcs`, `auth_account_rpcs`, `auth_soft_revoke`, `auth_rpc_privileges`, `lock_internal_functions`.

### Edge Function `admin-users` (deployed, sign-in required)

Invite faculty (by email, with role), resend invitation, deactivate/reactivate an account. It uses the server-only key **only** for Supabase Auth (sending invites, blocking sign-in). Every database change runs as the signed-in HOD, so the database re-checks permissions and records the HOD in the audit log. If the database refuses an invite, the new account is removed again.

### Frontend

| Screen | What it does |
|---|---|
| Sign in | Email + password; same message for unknown email and wrong password; deactivated accounts are told to contact the HOD |
| Forgot password | Sends a reset link; same response whether or not the email exists |
| Choose your password | Landing page for invitation and reset links (also when a link lands on the home page) |
| Home | Welcome, the user's semesters and role; HOD shortcut to setup |
| Semesters | List; HOD creates a semester with the full settings form (dates, schedule, research rules, stage weights with live total) |
| Semester detail | Edit settings; activation checklist (start date + lead); activate; close (with confirmation) |
| People & roles | Invite faculty or the lead; table with role, “reports to”, status; make lead, remove/restore, resend invite, deactivate/reactivate (with a reason) |

## Test results

- **Database tests** (`pnpm test:db`): 15 groups pass — profiles, HOD bootstrap, anon has no access (SEC-10), system roles and soft revoke, semester creation permissions (SEC-01), settings validation (DATA-10), hierarchy (SEC-02, DATA-01), row-level visibility, profile self-service, semester lifecycle, deactivated accounts (SEC-04), audit (AUD-01), function privileges, RLS on every table.
- **Unit and component tests** (`pnpm test`): 38 pass — error mapping, context/role helpers, semester settings rules, password rules, route guard.
- **Lint, format, typecheck, production build and secret scan**: pass.
- **Edge Function**: type-checked with Deno; deployed.
- **Live database checks**: RLS on all 5 tables; no internal function callable by app users; no function callable by anonymous visitors.
- **Visual check**: sign-in (desktop and 375 px phone width), reset and expired-link screens.

### Not yet tested end to end

This cloud session cannot reach `*.supabase.co`, so the full flow — invite email → set password → sign in → create semester — has **not** been run against the live project yet. It is covered by database tests and component tests, and should be checked by you (steps below) or in a session using the `mini-project-tracker` environment.

## Problems found and fixed during this phase

1. **Supabase grants EXECUTE on every new function to app users by default.** My local test database did not copy this, so internal helpers were callable on the live project for a few minutes (not exploitable: the sensitive one runs with the caller's own rights, which cannot write roles). Fixed with a migration, the test database now mirrors Supabase, and a new test fails if it ever happens again.
2. **Supabase's tool waits for a confirmation on `DELETE` statements**, which cannot reach you from here. Rather than work around it, revoking a role is now a *soft revoke* (who/when kept), which also gives a better history.
3. **Large migrations timed out** through the Supabase connection, so Phase 2 was applied in eight smaller migrations. Nothing was half-applied (checked after every timeout).
4. **Dashboard invitations land on the home page.** The app now detects invitation/reset links anywhere and sends the user to choose a password.

## Your setup steps (Supabase dashboard, about 10 minutes)

Open https://supabase.com/dashboard/project/utkekzbkdtcbmupbxmpp

1. **Turn off public sign-up** — *Authentication → Sign In / Providers →* turn **off** “Allow new users to sign up”. (Invitations still work.)
2. **Password rules** — same page, *Email* provider: minimum length **10**, password requirements **letters and digits**.
3. **Redirect URLs** — *Authentication → URL Configuration*:
   - Site URL: `http://localhost:5173` (change to the real address once the app is hosted)
   - Redirect URLs: add `http://localhost:5173/auth/set-password`
4. **Invite the HOD** — *Authentication → Users → Add user → Send invitation* with Dr. Vidyavathi B M's email.
5. **Make her the HOD** — send me her email and I will run the one-time command, or run it yourself in *SQL Editor*:
   ```sql
   select app.bootstrap_hod('her-email@example.edu');
   ```
6. She opens the invitation email, chooses a password, and can then create the semester and invite the faculty from **People & roles**.

**Email limit:** Supabase's built-in email sender allows only a few emails per hour and is meant for testing. Before inviting all faculty and students, set up custom SMTP (*Project Settings → Authentication → SMTP Settings*) with the department's email account (PRD open item O3).

## Open items carried forward

- O1 Authorized administrator (role exists; none appointed).
- O2 Frontend hosting and paid Supabase plan (backups).
- O3 SMTP account for invitations and password resets.
- Bundle size (697 kB / 202 kB gzipped) — route-level code splitting planned with Phase 3 screens.

## Next: Phase 3 — Students, domains and assignments

Domains and evaluation criteria, faculty expertise, the student roster (CSV import with preview, blank slots kept, capacity enforced), projects, guide requests with HOD approval, co-reviewers, lead-granted review authorizations, and the projects list showing the guide.
