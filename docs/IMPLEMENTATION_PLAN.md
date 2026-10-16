# Implementation Plan

Status: Phase 0 complete when approved. Every phase ends with a phase report (`docs/reports/PHASE_<n>_REPORT.md`) and **your approval** before the next phase starts.

## Per-phase procedure

1. Re-read the phase scope and the relevant specs.
2. Inspect the repository state.
3. Implement only the approved scope.
4. Run the unit, DB/RLS and (where relevant) e2e tests.
5. Review security, data integrity and error handling.
6. Check every acceptance criterion.
7. Write the phase report: what was done, test results, open issues.
8. Get approval.

## Phases

### Phase 0 — Requirements and documentation ✅ (this set of 12 documents)
- **Exit:** documents approved.

### Phase 1 — Repository and application foundation
- Vite + React + TypeScript (strict) + Tailwind v4 + React Router + TanStack Query.
- ESLint, Prettier, Vitest; `.env.example`; validated environment loading.
- Supabase project folder: `config.toml`, migration `0001_foundation.sql`:
  - extensions;
  - all enum types;
  - an `app` schema for helpers;
  - an `updated_at` trigger;
  - `audit_log` table and generic audit trigger;
  - an error-raising helper.
- Database test harness (`scripts/db-test.sh`): throwaway Postgres + Supabase auth shim + migrations + SQL tests.
- Domain constants (`src/domain/constants.ts`) with an enum-sync test against the migration.
- App shell: layout, routes, error boundary, not-found page, Supabase connection status.
- GitHub Actions CI (lint, typecheck, unit tests, build, DB tests). It becomes active once the repository is on GitHub.
- **Exit:** CI-equivalent commands pass locally; the app builds; the DB harness applies the migrations and the tests pass.

### Phase 2 — Authentication and faculty hierarchy
- Migrations: `profiles` (+ trigger on `auth.users`), `system_roles`, `semesters`, `memberships`, helper functions (`app.is_hod`, …), RLS.
- RPCs:
  - `app_my_context`;
  - `app_create_semester`, `app_activate_semester`, `app_close_semester`;
  - `app_set_lead`, `app_set_membership`;
  - `app_grant_system_role`, `app_revoke_system_role`.
- Edge Function `admin-users`: invite and deactivate.
- Bootstrap script for the first HOD account (Dr. Vidyavathi B M — email supplied at run time, not stored in the repository).
- UI: sign in, forgot/reset password, accept invite, semester setup wizard (details, schedule), People & roles.
- **Exit:** SEC-01..04, SEC-10, SEC-14, DATA-01, DATA-10 and AUD-01/02 pass; the HOD can invite a lead and faculty end to end on a local stack.

### Phase 3 — Students, domains and assignments
- Migrations: domains, evaluation criteria, faculty expertise, students (roster), drive folders, projects, project stages, project reviewers, assignment requests, review authorizations.
- RPCs:
  - `app_import_roster` (with dry run);
  - `app_set_expertise`;
  - `app_request_assignment`, `app_decide_assignment_request`;
  - `app_assign_guide`, `app_set_project_domain`;
  - `app_grant_review_authorization`, `app_revoke_review_authorization`.
- Edge Function: `invite_student`.
- UI: roster (import preview, slot grid), domains, expertise & guide requests, assignment requests (HOD), review authorization (lead), projects list with guide column.
- **Exit:** DATA-02..05, SEC-05, SEC-06, SEC-08 (for these tables), UI-01.

### Phase 4 — Research stages S1–S5
- Migrations: research explorations, papers, analyses, repositories, execution attempts, objective versions, evidence, reviews, corrections; lock and protected-column triggers.
- RPCs:
  - `app_select_paper`, `app_submit_record`;
  - `app_record_execution_attempt`;
  - `app_new_*_version`;
  - `app_record_review` for these targets;
  - `app_resolve_correction`, `app_verify_evidence`;
  - `app_approve_stage_exception`, `app_override`.
- UI: stage tabs S1–S5, review panel, correction tracker, evidence list.
- **Exit:** WF-01, WF-03, WF-04, WF-07, WF-08, DATA-06, SEC-07, SEC-09, SEC-12; e2e journey 3.

### Phase 5 — Weekly tasks, submissions, reviews and resubmissions
- Migrations: milestones, task templates, tasks, submissions, submission evidence; the default 16-week template.
- RPCs:
  - `app_generate_tasks`;
  - `app_submit_task`, `app_start_review`;
  - `app_address_correction`, `app_set_blocked`;
  - `app_record_review` for task submissions.
- UI: milestone/template editor, timeline, submit task, review queue.
- **Exit:** WF-02, DATA-07, FUN-09..11; e2e journeys 4 and 5.

### Phase 6 — Implementation, evaluation, writing and final stages S6–S9
- Migrations: implementation items, evaluation results, paper drafts, final deliverables, panels, panel members, panel projects, final sign-offs.
- RPCs: `app_set_panel`, `app_record_signoff`; reviews for drafts, evaluation and final.
- UI: stage tabs S6–S9, final checklist, panels, sign-off screen with timeliness and uniqueness data.
- **Exit:** DATA-08, WF-05, WF-06; e2e journey 6.

### Phase 7 — Dashboards, reports, notifications, meetings and audit UI
- Views: `v_project_overview`, `v_review_queue`, `v_faculty_workload`, `v_task_flags`, `v_timeliness`, `v_duplicate_warnings`.
- Notifications (inserted by the RPCs) + inbox; meetings.
- Dashboards H1, L1, F1, S1; CSV export; audit log screen.
- **Exit:** UI-02, DATA-09, FUN-17, FUN-18; performance check with 30 seeded projects.

### Phase 8 — Core testing, security verification, user acceptance
- Complete the generated permission matrix; accessibility run; security review (RLS audit of every table, Supabase security advisor, dependency audit).
- Staging deployment; UAT with the HOD and faculty using fictional data; backup/restore drill.
- **Exit:** no open high/critical issues; UAT signed off by the HOD.

### Phase 9 — Production deployment, then AI assistance
- **9a:** production Supabase project, production frontend, real accounts and roster entered by the HOD, monitoring.
- **9b (separate approval):** AI features per AI_FEATURE_SPEC.md, behind a feature flag.
- **Exit 9a:** production smoke test, first backup verified. **Exit 9b:** AI evaluation set passes; human-approval rules verified.

## Dependencies

```
P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9a → P9b
                └── P5 milestones can be configured in parallel with P4 UI work
```

## Release gates

| Gate | Condition |
|---|---|
| Merge to `main` | CI green; migrations are append-only; no secrets in the diff |
| Staging | Phase 7 complete; e2e journeys 1–7 pass |
| Production | Phase 8 exit met; HOD approval; backups enabled and a restore tested |
| AI enabled | Phase 9b exit met; the HOD turns on the feature flag |

## Risks

| Risk | Mitigation |
|---|---|
| RLS mistakes expose data | Default-deny; generated matrix tests; Supabase security advisor in Phase 8 |
| Free-tier limits (paused projects, no backups, email rate limit) | Paid plan and custom SMTP before production (see DEPLOYMENT_AND_SECURITY.md) |
| Workflow rules change mid-semester | Templates and settings are data; migrations add rules without rewriting history |
| Faculty adoption | Queue-first dashboards; lab-day review fits the existing Tuesday rhythm |
