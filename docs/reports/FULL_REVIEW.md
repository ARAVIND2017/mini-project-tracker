# Full review of Phases 1–8

Date: 2026-10-21 · Scope: every phase's exit criteria, the specs against the code, the repository against the live Supabase project, and a full run of every test.

## 1. Result in one paragraph

- **Every automated check passes.** 80 app tests, 65 database test groups, 9 browser journeys (on the dev server and on the production build), and the build, security, coverage and backup checks.
- **Six issues were found and fixed today**, listed in §3, all deployed to the live project where they apply.
- **Verified on the live database** without leaving anything behind:
  - **Workflow:** the full journey ran on the deployed database as real users (HOD, lead, guide, faculty, student), inside a transaction that was rolled back afterwards. Before and after: 0 users, 0 semesters, 0 audit entries.
  - **Anonymous access:** none of 49 tables and views can be read, and none of 66 workflow functions can be called.
- **Not verifiable from this environment:** the browser app connected to the live backend over the internet. The network here blocks `supabase.co`. There is also no frontend host yet, and no real accounts: the HOD's email is still needed.

## 2. Phase-by-phase check

| Phase | Exit criteria (IMPLEMENTATION_PLAN.md) | Evidence today | Status |
|---|---|---|---|
| 1 Foundation | Repo, CI, enums, audit, protected columns | `001_foundation.sql`; CI green; enum sync test | ✅ |
| 2 Auth and hierarchy | SEC-01–04, SEC-10, AUD-01; invites; password reset | `002_auth_hierarchy.sql`; **new** `e2e/password-reset.spec.ts` (SEC-03); the deployed Edge Function's code matches the repo (formatting only) | ✅ (SEC-03 test added) |
| 3 Roster and assignments | DATA-02–05, FUN-06–08, SEC-05/06, UI-01; journeys 1–2 | `003_roster_assignments.sql`; `phase3-journey` (now also journey 7: a student opening another student's project gets "Not found") | ✅ (journey 7 completed) |
| 4 Research S1–S5 | VAL-01/02, DATA-06, WF-01/02/07/08, SEC-07/08/09/12; journey 3 | `004_research_stages.sql`; `phase4-research-stages` | ✅ |
| 5 Weekly tasks | FUN-09–11, DATA-07, WF-03/04; journeys 4–5 | `005_weekly_tasks.sql`; `phase5-weekly-tasks` | ✅ |
| 6 S6–S9 and panels | FUN-12–16, DATA-08, WF-05/06; journey 6 | `006_final_stages.sql`; `phase6-final-signoff` | ✅ |
| 7 Dashboards etc. | UI-02, DATA-09, FUN-17/18; 30-project performance | `007_dashboards_notifications.sql` (all views < 0.2 s); `phase7-dashboards` | ✅ (overdue rule corrected, §3) |
| 8 Testing and security | Permission matrix, accessibility, security review, staging, UAT, backup drill | 897-cell matrix; axe 0 violations; security review; backup drill; staging DB chosen and in sync | ⏳ Waiting on you: frontend host and HOD's UAT sign-off |

**Traceability:** every one of the 56 requirement IDs in the PRD and test plan is now named by at least one test. A new CI step (`scripts/check-test-ids.mjs`) fails if one loses its test.

## 3. Issues found and fixed today

| # | Issue | Fix | Live |
|---|---|---|---|
| 1 | **"Overdue" was counted two ways.** The dashboards counted only tasks waiting for the student; the weekly task list followed the spec (deadline passed and not verified). The same project could show different numbers. | Every view now uses the spec's rule (WORKFLOW_SPEC §1, PRD AC6.7). A new test checks that the dashboard, the flags view and the weekly list agree. | ✅ migration `p8d_overdue_definition` |
| 2 | **`app_copy_semester_config` was in the API spec but never built.** Each new semester would have needed its domains, criteria, plan and templates re-entered. | Built: into a draft semester only, HOD/admin only, audited. The old plan is switched off, not deleted, and domain-specific templates are kept. New screen "Copy the setup from an earlier semester", a database test (`008`), a matrix row and a browser step. | ✅ migration `p8c_copy_semester_config` |
| 3 | **No test for SEC-14** (the account Edge Function refusing non-HOD callers). | `e2e/admin-users-function.spec.ts` calls the real function: no token and the public key → 401; student and faculty → 403; HOD → passes the permission check. | — |
| 4 | **No test for SEC-03** (password reset). | `e2e/password-reset.spec.ts` checks: the same answer for known and unknown emails; the link works once ("Link expired" the second time); a redirect to an outside address is not followed. | — |
| 5 | **Journey 7 was incomplete.** Nothing tried opening another student's project by its address. | Added to `phase3-journey`. | — |
| 6 | **The documentation had drifted.** The API spec lacked `app_my_context`; the database spec lacked `v_projects` and `v_tasks`; 15 requirement IDs were tested but unlabelled. | Specs corrected; tests labelled; coverage enforced in CI. | — |

**Also from Phase 8 (earlier today):**

- direct profile renaming closed (S8-1);
- audit read rule merged into one policy;
- a strict Content Security Policy for the production build;
- the validation library's `eval` probe removed.

## 4. Live verification (no data kept)

| Check | How | Result |
|---|---|---|
| Migrations | Live list against the repository | 39 / 39, same versions |
| Edge Function | Deployed source against the repo | Same code (only formatting differs); `verify_jwt` on |
| Generated types | Regenerated from live and compared | Identical apart from the new function |
| Row-level security and grants | Live catalogue | 41 tables, RLS on all; no table or column writable by API roles |
| Anonymous visitor | Every table, view and function tried as `anon` on the live database | 0 / 49 readable, 0 / 66 callable |
| **Full workflow** (`scripts/live-journey.sql`) | Run on the live database as each role, then rolled back | 12 / 12. The sign-up trigger made the profiles. The HOD set up a semester, and activation created 19 tasks. The student saw only their project and could not approve their own work. A late submission was flagged. Unassigned faculty could only comment. The guide was notified and requested a change. The student was notified, fixed it and resubmitted. The guide verified it and the task became verified. The lead saw progress 5% and matching overdue counts, saw the workload table, and recorded a meeting. 123 audit entries were written. |
| Nothing kept | Counts afterwards | users 0 · profiles 0 · semesters 0 · roles 0 · notifications 0 · audit 0 |
| Supabase security advisor | Live | Only the accepted "signed-in users can call the workflow functions" warning, by design |

## 5. Full local run (today)

- **Formatting, lint, typecheck:** pass.
- **App tests:** 80/80 (15 files).
- **Database tests:** all files, 65 groups. These include:
  - the 897-cell permission matrix;
  - the check that every column of every table refuses direct writes;
  - the 30-project performance check.
- **Build:** passes, including the bundle secret scan and the generated host headers. The permissions document and requirement coverage are both up to date.
- **Browser journeys:**
  - **production build** with the real security headers: **9/9**;
  - **dev server:** 8/8 on the second run. The first run had one intermittent failure, consistent with Vite's dev server reloading a page mid-test; the production build has no such reloads, so `pnpm test:e2e:prod` is the definitive run.
- **Backup and restore drill:** 57 tables and 2,717 rows identical after restore; the restored copy works.
- **Dependency audit:** no known vulnerabilities.

## 6. What still needs you (cannot be done or proven from here)

1. **Frontend host** (Netlify, Vercel or Cloudflare Pages). Until then there is no public address to open. The Supabase project sits in an organization created through Vercel's integration.
2. **Supabase Auth settings** in the dashboard:
   - turn off public sign-up;
   - minimum password length 10;
   - the site address in the redirect allow-list;
   - SMTP.
   
   `node scripts/live-check.mjs`, run from your own computer with the two public values, checks these and the anonymous-access rules over the real internet (8 checks; it passes against the local stack).
3. **The HOD's email address,** to create the first real account (`app.bootstrap_hod`).
4. **The real roster** from the HOD (no names or students are ever invented).
5. **UAT** with the HOD and faculty, then the HOD's sign-off (docs/UAT_CHECKLIST.md).
6. **Optional:** remove the redundant audit policy (`drop policy audit_log_select_lead on public.audit_log;` in the SQL editor).
