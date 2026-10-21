# Phase 8 Report — Core testing, security verification, user acceptance

Date: 2026-10-21 · Status: **automated testing and the security review are done. Staging and UAT need your decisions (below).**

## What was delivered

### 1. The generated permission matrix (TEST_PLAN.md §2)

- **Source:** `supabase/tests/permission_matrix.json` holds the expected result for each action and caller.
  - 68 actions covering all 65 workflow functions.
  - 13 kinds of caller: not signed in, own student, other student, unassigned faculty, guide, co-reviewer, faculty with a valid authorization, faculty with an expired one, lead, HOD, admin with every delegated permission, admin with none, and a deactivated user.
- **Test:** `900_permission_matrix.sql` builds one fixture and runs **every action as every caller** (884 attempts, each rolled back).
  - Every refusal must be `FORBIDDEN`, `NOT_FOUND` or "permission denied". A different error would mean the permission check came too late.
  - It fails if a new workflow function is not in the matrix.
- **Other checks in the same file:**
  - insert, update and delete on every table, and an update of every single column, all refused;
  - who can read project A's rows in all 19 project tables and views;
  - the workload view and the two audit-log scopes.
- **Documentation:** `docs/PERMISSION_MATRIX.md` is generated from the same file. CI fails if the document is out of date, so the tests and the documentation cannot drift apart.
- **The test bites:** wrongly allowing one cell fails it.

**What the matrix found:** four places where the code deliberately does more than the summary table in USER_ROLES_AND_PERMISSIONS.md said. The table is now corrected:

- an admin with "manage users" may add a new faculty member to a semester, as part of inviting them;
- **only the HOD** may withdraw a student, although admins may edit the roster;
- a reviewer may withdraw a student's candidate paper (not yet submitted);
- the HOD may change a project's title at any time.

It also documents that a student does not see the assignment requests or review authorizations on their own project.

### 2. Security review — [SECURITY_REVIEW.md](../SECURITY_REVIEW.md)

- **No critical or high findings.**
- **One medium finding, fixed and deployed (S8-1):** any signed-in user could rename their own profile directly through the API. A student could have appeared as "Dr …" in review threads. No screen used this. The direct write is now closed on the live database, and the test checks every column so it cannot return.
  - **This reverses a Phase 2 feature** ("users can edit their own name"). If you want self-service name changes, I can add an audited version instead.
- **Two low items:**
  - The Edge Function accepts requests from any website. This is safe because it uses sign-in tokens, not cookies; it will be limited to the production address in Phase 9.
  - The audit log has a redundant read policy. Its rule is now merged into the main policy; removing the old one needs a one-line `DROP` in the Supabase SQL editor (given in the review), which this session cannot confirm.
- **Supabase advisors:** the security advisor flags that signed-in users can call the 65 workflow functions. That is the design: they are the only way to write, and each checks permissions, as the matrix proves.
- **Dependency audit:** no known vulnerabilities.
- **Live state:**
  - 41 tables, row-level security on all of them;
  - no table or column writable directly by signed-in or anonymous users;
  - nothing callable by anonymous visitors.

### 3. Accessibility (TEST_PLAN.md §5) — `e2e/accessibility.spec.ts`

- **axe-core (WCAG 2.1 A and AA) on 29 screens:**
  - signed out: sign-in, forgot password, status;
  - every HOD semester tab, the notifications page and the audit log;
  - the faculty dashboard, seven stage tabs of a project and weekly tasks, as the guide;
  - the student's home and weekly tasks.
- **Result:** one problem found and fixed. Links inside the dashboard's text lists relied on colour alone, so they are now underlined. Now **0 violations**.
- **Keyboard-only run:** sign in, open the weekly tasks, start week 2, write the report, add the evidence link and submit, all with Tab and Enter. The focused button shows a visible focus ring.

### 4. Backup and restore drill — `scripts/backup-drill.sh`

- **On the local stack**, after the full browser suite:
  - dumped the database (788 KB);
  - restored it into a new database;
  - compared every table: **57 tables, 2,506 rows, identical**;
  - checked that the restored copy works: projects, the review queue, all 65 workflow functions, and row-level security on every table.
- **The live project is on the free tier, which has no managed backups.** The script works on any Postgres connection, so the same drill can run against staging once it exists. Daily backups need a paid plan (Phase 9).

### 5. UAT checklist — [UAT_CHECKLIST.md](../UAT_CHECKLIST.md)

- **Format:** three sessions (about 2 hours) for the HOD, the lead and one faculty member, on staging with fictional data.
- **Coverage:** each step is tied to the PRD acceptance criteria (AC1.1–AC11.2) and has an expected result and a result column.
- **Defects and sign-off:** there is a defect list with severities and a sign-off line for the HOD. The exit rule is no open critical or high defects.

### 6. Staging preparation (ready to deploy)

- **Security headers for any host**, all from one source (`scripts/host-config.mjs`):
  - a strict Content Security Policy: only the site's own scripts and styles, network calls only to Supabase, no framing;
  - nosniff, a referrer policy, a permissions policy and HSTS;
  - long caching for hashed assets.
  
  The build writes `_headers` and `_redirects` (Netlify and Cloudflare Pages) and checks that `vercel.json` matches.
- **Tested in a real browser:** all six journeys pass against the **production build** served with exactly these headers (`scripts/serve-dist.mjs`). A new check, `e2e/zz-production-build.spec.ts`:
  - confirms the headers;
  - confirms deep links work;
  - finds **no CSP violations** on nine main screens.
  
  It caught one problem: the validation library probed for `eval` on every page. It is now configured not to, without loosening the policy.
- **"Deploy database to staging"**: a manual GitHub Actions workflow. It pushes the migrations and the Edge Function, and stops unless its three secrets are set.
- **UAT helper `scripts/uat/prepare-s6.sql`**: fast-forwards one fictional project to S6 for session 3. It refuses any student whose name does not start with "UAT ".
- **[STAGING_RUNBOOK.md](../STAGING_RUNBOOK.md)**: the remaining clicks for Supabase, the three hosts and the pre-UAT checks.

## Test results

- **Database tests:** all files pass, including the new matrix (884 cells) and the per-column write check.
- **End-to-end:** **6 journeys pass** from a clean reset in about 2 minutes, on the dev server and also on the production build with its security headers (plus the production-build check).
- **App tests:** 80 passing. **Lint, typecheck, formatting, build, secret scan, dependency audit:** pass. CI now also checks that the permission matrix document is up to date.

## What needs you before Phase 8 can be closed

1. **Staging.** The plan calls for a separate Supabase project ("mpt-staging") and a static host for the frontend. Both are your choice and may cost money:
   - **Supabase:** either create a second (free) project for staging, or use the current project as staging and create production later in Phase 9. The current project holds only test data.
   - **Frontend host:** Netlify, Vercel or Cloudflare Pages (open decision O2 in the PRD). Any of them can serve the built `dist` folder. I need an account or token to deploy, or you can connect the GitHub repository yourself.
2. **UAT.** Once staging is up, Dr Vidyavathi B M and faculty run the checklist and the HOD signs it.
3. **Still open from earlier phases:**
   - the HOD's email address, to run `app.bootstrap_hod`;
   - the Supabase Auth settings from the Phase 2 report: sign-up off, password rules, redirect URLs, SMTP.
4. **Optional:** remove the redundant audit policy (one line in the SQL editor, see S8-3).

## Next

Once staging and UAT are signed off: Phase 9a, production. That means the production Supabase project on a paid plan with backups, the production frontend, real accounts and the roster entered by the HOD, monitoring, and a first verified backup.
