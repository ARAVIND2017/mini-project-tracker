# User Roles and Permissions

Status: Phase 0 — awaiting approval. Decisions D3, D5, D7–D10 from PRD.md §4 apply.

## 1. Hierarchy

```
HOD / System Administrator — Dr. Vidyavathi B M   (system role, all semesters)
 └── Authorized Administrator (optional, delegated by HOD; none initially)
 └── Lead Faculty            (semester role, exactly one active per semester)
      ├── Faculty            (semester role, reports_to = lead)
      ├── Faculty
      └── Faculty
           └── Students       (semester role, one individual project each)
```

- **System roles** (`system_roles` table): `hod`, `admin`. They are not tied to a semester. Only an existing HOD can grant them, and the last HOD cannot be removed.
- **Semester roles** (`memberships` table): `lead_faculty`, `faculty`, `student`. A user has at most one membership per semester.
- **Project relationships** (who may *act* on a project, as opposed to only seeing it):
  - **Guide** — one per project (`projects.guide_id`). May be the HOD, the lead or a faculty member.
  - **Co-reviewer** — zero or more standing reviewers (`project_reviewers`). Added with HOD approval.
  - **Review authorization** — a temporary or one-off right to review a project, granted by the lead (`review_authorizations`).
  - **Panel member** — signs off on the final project (`panel_members` × `panel_projects`).

"Faculty-level user" below means the HOD, the lead or a faculty member of the semester.
"Reviewer of project P" means: the HOD, the lead, P's guide, a co-reviewer of P, or a faculty member with an active review authorization for P.

## 2. Authorization matrix

Key: ✅ allowed · 👁 view only · 🅿 only as reviewer of the project · 🅶 only as guide · ⚙ admin, if the HOD delegated that permission · ✋ propose only (HOD approves) · ❌ not allowed

### 2.1 Administration and configuration

| Action | HOD | Admin | Lead | Faculty | Student |
|---|---|---|---|---|---|
| Create / close a semester | ✅ | ⚙ | ❌ | ❌ | ❌ |
| Edit semester settings (dates, deadlines, capacity, weights) | ✅ | ⚙ | ❌ | ❌ | ❌ |
| Invite users, deactivate users | ✅ | ⚙ | ❌ | ❌ | ❌ |
| Grant or revoke system roles (HOD/admin) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Appoint the lead, change semester roles or `reports_to` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Import or edit the student roster | ✅ | ⚙ | ❌ | ❌ | ❌ |
| Manage domains, milestones, task templates, evaluation criteria | ✅ | ⚙ | ✋ | ❌ | ❌ |
| Generate or regenerate tasks for projects | ✅ | ⚙ | ❌ | ❌ | ❌ |
| Set a project's domain | ✅ | ⚙ | ✋ | ❌ | ❌ |

### 2.2 Assignments

| Action | HOD | Admin | Lead | Faculty | Student |
|---|---|---|---|---|---|
| Record own domain expertise | ✅ | — | ✅ | ✅ | ❌ |
| Request to guide a project (in an expertise domain) | ✅ | — | ✅ | ✅ | ❌ |
| Propose a guide change or a co-reviewer for another faculty member | — | — | ✋ | ❌ | ❌ |
| Approve or reject assignment requests | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign or reassign a guide directly | ✅ | ❌ | ❌ | ❌ | ❌ |
| Grant or revoke a review authorization for one project | ✅ | ❌ | ✅ | ❌ | ❌ |
| Form panels, assign members and projects | ✅ | ❌ | ✋ | ❌ | ❌ |

### 2.3 Project content and workflow

| Action | HOD | Admin | Lead | Faculty | Student |
|---|---|---|---|---|---|
| View all projects, papers, evidence, reviews, timelines | ✅ | ✅ | ✅ | ✅ | ❌ |
| View own project | — | — | — | — | ✅ |
| View other students' projects | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create or edit stage content (exploration, papers, analysis, repository, attempts, objectives, implementation, evaluation, drafts, checklist) | ❌ | ❌ | ❌ | ❌ | Own project, while editable |
| Add evidence links | ❌ | ❌ | ❌ | ❌ | Own project |
| Submit a task / resubmit | ❌ | ❌ | ❌ | ❌ | Own project |
| Submit a stage record for approval | ❌ | ❌ | ❌ | ❌ | Own project |
| Mark a task or project as Blocked (with reason) | ✅ | ❌ | ✅ | 🅿 | Own project |
| Comment (outcome `comment_only`) | ✅ | ❌ | ✅ | ✅ | ❌ |
| Record a review outcome (accepted / changes requested / rejected) | ✅ | ❌ | ✅ | 🅿 | ❌ |
| Approve a paper, analysis, objectives, drafts; verify execution | ✅ | ❌ | ✅ | 🅿 | ❌ |
| Approve a stage exception (e.g. no public code) | ✅ | ❌ | ✅ | 🅶 | ❌ |
| Override the duplicate-paper check | ✅ | ❌ | ❌ | ❌ | ❌ |
| Override the "objectives approved" gate for S6 | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mark a correction addressed | ❌ | ❌ | ❌ | ❌ | Own project |
| Verify or waive a correction | ✅ | ❌ | ✅ | 🅿 | ❌ |
| Set evidence verification (verified / rejected / inaccessible) | ✅ | ❌ | ✅ | 🅿 | ❌ |
| Record a review meeting | ✅ | ❌ | ✅ | ✅ | 👁 own outcomes |
| Record a final sign-off | Panel member only | ❌ | Panel member only | Panel member only | ❌ |

### 2.4 Reporting and audit

| Action | HOD | Admin | Lead | Faculty | Student |
|---|---|---|---|---|---|
| Department dashboard and all reports | ✅ | ✅ | ✅ | 👁 project reports | ❌ |
| Faculty workload report | ✅ | ✅ | ✅ | ❌ | ❌ |
| CSV export | ✅ | ✅ | ✅ | ❌ | ❌ |
| Audit log — everything | ✅ | ✅ | ❌ | ❌ | ❌ |
| Audit log — project records only | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit or delete audit entries | ❌ | ❌ | ❌ | ❌ | ❌ |

## 3. Editability ("lock") rules for student content

A student can edit a stage record only while its status is `draft` or `changes_requested`. Once it is `submitted` or `approved`, it is locked. If an approved record has to change (for example a new objective version), a **new version** is created; the old one becomes `superseded`. Records in a closed semester are read-only for everyone.

## 4. How permissions are enforced

1. **Row-Level Security (RLS)** is enabled on every table in the `public` schema. With no policy, access is denied.
2. **Helper functions** (SQL, `security definer`, `stable`, fixed `search_path`):
   - `app.is_hod()`, `app.is_admin()`, `app.has_admin_permission(perm)`
   - `app.semester_role(semester_id)` → `lead_faculty | faculty | student | null`
   - `app.is_faculty_level(semester_id)` → HOD, or lead/faculty membership
   - `app.is_lead(semester_id)`
   - `app.is_project_student(project_id)`
   - `app.can_view_project(project_id)` → faculty-level in the project's semester, or the project's own student
   - `app.is_project_reviewer(project_id)` → HOD, lead, guide, co-reviewer, or an active review authorization
   - `app.is_panel_member_for(project_id)`
3. **Read policies** use `can_view_project`. A student who requests another student's record gets an empty result (equivalent to "not found"). The response does not confirm that the record exists.
4. **Content write policies** allow the student to insert or update only rows of their own project, and only while the row is editable (checked by a `BEFORE UPDATE` trigger).
5. **Status and approval fields are never writable directly.** A trigger rejects changes to workflow columns (`status`, `approved_by`, `is_late`, …) when the statement runs as an API role (`anon` or `authenticated`). Workflow RPC functions are `security definer`, so inside them the current role is the function owner and the change is allowed — there is no flag a client could set. Workflow RPCs are `security definer` functions that check permissions explicitly before acting.
6. **Privileged account operations** (inviting users, deactivating accounts) run in a Supabase Edge Function that uses the service-role key. The function verifies the caller's JWT and HOD/admin role first. The service-role key never reaches the browser.
7. **The frontend only hides controls.** Hiding a button is never treated as security.

## 5. Edge cases

| Case | Rule |
|---|---|
| A faculty member who is guide of P also sits on P's panel | Allowed by default (O5 in PRD); configurable. |
| The lead leaves mid-semester | The HOD appoints a new lead. Review authorizations granted by the old lead remain valid until they expire or are revoked. |
| A guide is reassigned | Open reviews stay attributed to the original reviewer. Open corrections can be verified by the new guide. |
| A student withdraws | The roster status becomes `withdrawn`; the project becomes read-only; the student loses access to editing. |
| Empty roster slot | It has no account and no project. It does not count as an active project on dashboards. |
| The HOD account is the only system admin | The HOD's own system role cannot be revoked while it is the last one. |
| A user has both a system role (HOD) and a semester membership | Not needed — HOD rights already include faculty-level rights. Creating such a membership is rejected. |
