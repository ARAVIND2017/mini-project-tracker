# Phase 3 Report — Students, Domains and Assignments

Date: 2026-10-18 · Status: **built, tested and deployed to Supabase. Awaiting approval to start Phase 4.**

## What was delivered

### Database (live on Supabase, seven migrations `p3a`–`p3f`)

| Area | What it does |
|---|---|
| Domains and evaluation criteria | Configurable per semester. Names are unique (ignoring case and spaces). Domains and criteria are switched off rather than deleted. A semester now needs at least one active domain before it can be activated. |
| Faculty expertise | Each faculty member (including the lead and the HOD) chooses their domains. Removed domains are switched off, so the history is kept. |
| Student roster | One row per slot (1–999), storing student ID, name, email and Drive folder link exactly as supplied. Blank rows stay **empty slots**. Status is automatic: empty → no account yet → account active, plus withdrawn. Capacity is enforced, and cannot be lowered below the students already on the roster. |
| Roster import | **Preview first** (nothing is written), then an all-or-nothing import. It catches duplicate slots, student IDs and emails (in the file and against the roster), invalid emails and Drive links, unknown domains, attempts to empty a filled slot, withdrawn slots, and capacity overflow. Re-importing the same file changes nothing. |
| Projects | Each filled slot automatically gets exactly one individual project with its nine stages. Domain and guide are on the project. The student can set a working title until objectives are approved. |
| Guide and co-reviewer requests | Faculty request projects **only in their expertise domains**. The lead can propose anyone. **The HOD approves or rejects.** Approving a guide closes other pending guide requests. The HOD can also assign or unassign a guide directly and remove co-reviewers. |
| Review authorizations | The **lead (or HOD)** lets a faculty member review one project, optionally until a date. Expired or revoked authorizations stop working immediately. |
| Who is a reviewer of a project | The HOD, the lead, the guide, an active co-reviewer, or someone with an active authorization. This is the rule the review workflow in Phases 4–5 will use. |
| Visibility | Students see only their own roster row, project and stages; never other students, expertise or requests. Faculty see the whole semester. The lead can now read the audit history of their semester's projects. |
| `v_projects` | One row per project with student, student ID, domain, **guide name**, co-reviewers, pending requests and current stage. It applies each user's own permissions. |

### Edge Function `admin-users` (version 2)

New action **invite student**. It sends the invitation to the roster email, or links an existing account with the same email (for example from an earlier semester), and gives the student their role. If linking fails, a newly created account is removed again.

### Screens

Every semester now has tabs: **Overview · Projects · Assignments · Roster · Domains · People & roles**.

| Screen | Who | What |
|---|---|---|
| Domains | Everyone (HOD edits) | Add, rename, switch off domains; add or switch off evaluation criteria |
| Roster | Faculty (HOD edits) | Places filled out of capacity; **CSV import with preview** (template download, row-by-row problems, “Import N rows” only when everything is valid); prepare empty slots; edit a slot; invite a student; withdraw a student with a reason |
| Projects | Faculty | Every project with **guide** (or “! Unassigned”), domain, co-reviewers, current stage; search and filters (domain, guide, unassigned); HOD sets domain and guide directly from the list |
| Assignments | Faculty | My domains of expertise; projects in my domains with “Request to guide / co-review”; lead/HOD proposals; requests waiting for the HOD (approve / reject with a note / cancel); review authorizations (grant / revoke); decided requests with notes |
| Home (student) | Student | **My project**: domain, guide, co-reviewers, current stage, working title, own Google Drive folder link |

Semester screens are now loaded on demand (2–13 KB each), so the first page is no bigger than before.

## Test results

- **Database tests:** 11 new groups, all passing, plus every Phase 1–2 test.
  - FUN-06 domains and criteria; FUN-07 expertise.
  - DATA-02/03/05 roster import (values stored as given, blank rows stay empty, one project per filled slot with nine stages).
  - DATA-04 capacity, both in the import and in a database trigger.
  - Student account linking.
  - SEC-08 visibility of roster and projects.
  - FUN-08 / SEC-05 / UI-01 assignment requests.
  - SEC-06 review authorizations, including expired and revoked.
  - HOD direct changes, project domain and title.
  - Withdrawal; audit, including the lead's read access.
- **App tests:** 47 passing. New: CSV reader (quotes, commas and line breaks inside quotes, BOM, header aliases) and the roster import screen (preview before import; import button disabled while there are problems; clear message when the slot column is missing).
- **Lint, typecheck, production build, secret scan:** pass. Edge Function type-checked with Deno.
- **Live database check:** row-level security on all 15 tables; no internal function exposed; nothing callable by anonymous visitors. The projects view runs with each user's own permissions. The only advisor note is the expected one about the 28 workflow functions, which each check permissions themselves.

### Not yet tested end to end

As before, this session cannot reach Supabase, so the screens were not clicked through against the live project. Each screen calls only functions that are covered by the database tests above.

## Problems found and fixed during this phase

1. **Error order when editing a slot.** Clearing a student's name now explains *“withdraw the student instead”* rather than showing a field error.
2. **The Edge Function redeploy failed** because of a setting stored with the first version. Fixed by naming the import map explicitly.
3. **Lint rules** for unused variables now allow the deliberate “drop this field” pattern.

## Things to know

- **Withdrawn students keep their slot**, and still count towards capacity, so history is preserved. To replace a withdrawn student, use another slot.
- **Inviting students sends emails.** With Supabase's built-in sender you can only send a few per hour, so set up SMTP before inviting a whole class (see the Phase 2 report).
- **Main bundle:** 686 kB (199 kB gzipped), mostly supabase-js. This is a warning only. Further splitting of third-party code can be done in Phase 8.

## Next: Phase 4 — Research stages S1–S5

Exploration, paper selection (target-year vs foundational, code availability, duplicate-paper check), structured paper analysis, repository and execution attempts (the eight execution statuses, verification by reviewers, the no-code exception), objective versions with approval, evidence links, reviews and corrections.
