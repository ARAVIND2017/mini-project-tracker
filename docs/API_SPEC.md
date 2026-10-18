# API Specification

Status: Phase 0 — awaiting approval.

The API has three parts:

1. **PostgREST table/view endpoints** (`/rest/v1/<table>`), protected by RLS — used for reads and plain content edits.
2. **RPC workflow functions** (`/rest/v1/rpc/<function>`) — every state change, approval and assignment goes through these.
3. **Edge Function** `admin-users` (`/functions/v1/admin-users`) — account administration with the service-role key.

The frontend calls all three through `supabase-js`, which sends the user's JWT. Unauthenticated (`anon`) requests have no access to any table.

## 1. Conventions

- **Errors:** RPCs raise `P0001` with a message `CODE: text`. PostgREST returns HTTP 400 with `{code, message, details, hint}`; the client parses `CODE` from `message`.

| CODE | Meaning | HTTP (via PostgREST) |
|---|---|---|
| `FORBIDDEN` | The caller is authenticated but lacks the permission | 400 (P0001) |
| `NOT_FOUND` | The record does not exist **or is not visible to the caller** | 400 |
| `VALIDATION` | Input fails a rule (with the field name in `details`) | 400 |
| `INVALID_STATE` | The transition is not allowed from the current status | 400 |
| `GATE_NOT_MET` | A stage dependency or precondition is not met | 400 |
| `DUPLICATE_PAPER` | Another project already has this approved paper | 400 |
| `CAPACITY_EXCEEDED` | The roster is above the semester capacity | 400 |
| RLS denial on an insert/update | | 403 / 401 |

- **IDs:** UUIDs only. A student who requests another student's record gets an empty result or `NOT_FOUND`, never `FORBIDDEN`.
- **Auditing:** every RPC writes a named audit entry (for example `review.recorded`) in addition to the row-level trigger entries.
- **Notifications:** RPCs insert notifications in the same transaction.

## 2. Authentication (Supabase Auth)

| Operation | Client call | Notes |
|---|---|---|
| Sign in | `auth.signInWithPassword({email, password})` | Rate-limited by Supabase |
| Sign out | `auth.signOut()` | |
| Forgot password | `auth.resetPasswordForEmail(email, {redirectTo})` | The response is the same whether the email exists or not |
| Set a new password | `auth.updateUser({password})` on the recovery session | Minimum 10 characters; leaked-password protection when available |
| Accept an invite | Invite link → set-password page → `auth.updateUser({password})` | Links `students.user_id` / activates the membership |
| Current user context | `rpc/app_my_context()` | Returns profile, system roles, memberships per semester, and the student's project id |

## 3. Edge Function `admin-users`

`POST /functions/v1/admin-users` with the body `{ action, ... }`. The caller must be the HOD, or an admin with `manage_users`.

| action | Body | Effect |
|---|---|---|
| `invite_faculty` | `{email, full_name, semester_id, role: 'lead_faculty'\|'faculty', designation?}` | Sends a Supabase invite; creates the profile and membership (faculty `reports_to` = the current lead) |
| `invite_student` | `{student_id}` (a roster row with an email) | Sends an invite; links the roster row on acceptance; status → `pending_invite` |
| `resend_invite` | `{user_id}` | |
| `deactivate_user` / `reactivate_user` | `{user_id, reason}` | Bans or unbans the auth user, sets `profiles.is_active`; audited |

Responses: `200 {ok: true, user_id}` · `400 {code: 'VALIDATION'}` · `403 {code: 'FORBIDDEN'}` · `409 {code: 'ALREADY_EXISTS'}`.

## 4. RPC functions

Who may call each function is listed in **Auth**. Every function re-checks the permission itself; RLS alone is not relied on.

### 4.1 Semester and configuration — HOD (admin with `manage_config`)

| Function | Arguments | Returns | Auth / rules |
|---|---|---|---|
| `app_create_semester` | name, academic_year, settings jsonb | semester id | HOD/admin. Unknown or invalid settings → `VALIDATION`. (Phase 5 adds the default milestones and task templates.) |
| `app_update_semester` | semester_id, settings jsonb | void | HOD/admin. Same settings keys as create; closed semesters → `INVALID_STATE` |
| `app_copy_semester_config` | from_semester, to_semester | void | Copies domains, criteria, milestones, templates — not people |
| `app_activate_semester` / `app_close_semester` | semester_id | void | Activation requires a start date and a lead (the domain requirement is added in Phase 3); only active semesters can be closed |
| `app_set_lead` | semester_id, user_id | void | HOD only. Demotes the previous lead to faculty; re-points `reports_to` |
| `app_set_membership` | semester_id, user_id, role, is_active | membership id | HOD; an admin with `manage_users` may only add *new* faculty memberships. The HOD needs no membership (`VALIDATION`) |
| `app_set_user_active` | user_id, is_active, reason | void | HOD or admin with `manage_users`; not yourself; only the HOD may change HOD/admin accounts; the last active HOD cannot be deactivated. Called by the `admin-users` Edge Function, which also bans/unbans sign-in |
| `app_grant_system_role` / `app_revoke_system_role` | user_id, role, permissions[] | void | HOD only. Revoking is a soft revoke (`revoked_at`), re-granting restores the row; the last active HOD cannot be revoked |
| `app.bootstrap_hod(email)` | email | user id | **Not callable through the API.** Run once from the Supabase SQL editor to make the first HOD |
| `app_import_roster` | semester_id, rows jsonb[] `{slot_no, institution_id?, full_name?, email?, drive_folder_url?, domain_name?}`, dry_run bool | report jsonb (created / updated / errors per row) | HOD/admin. Stores the values exactly as given; empty rows become `empty` slots; `CAPACITY_EXCEEDED` if over capacity |
| `app_generate_tasks` | semester_id, project_id? , regenerate bool | count | HOD/admin. Creates tasks from the templates (with domain overrides) and computes `due_at` |

Domains, criteria, milestones and templates are plain CRUD through PostgREST, with HOD/admin-only write policies.

### 4.2 Assignments

| Function | Arguments | Auth / rules |
|---|---|---|
| `app_set_expertise` | semester_id, domain_ids[] | Faculty-level caller; replaces the caller's own expertise |
| `app_request_assignment` | project_id, type, faculty_id, reason | A faculty-level user for themselves (domain must match their expertise); the lead for anyone (D8) |
| `app_decide_assignment_request` | request_id, approve bool, note | HOD only. On approve: sets `guide_id` or inserts into `project_reviewers`; notifies everyone involved |
| `app_assign_guide` | project_id, faculty_id, note | HOD only (direct assignment) |
| `app_set_project_domain` | project_id, domain_id | HOD/admin |
| `app_grant_review_authorization` | project_id, faculty_id, valid_until?, note | Lead or HOD (D9) |
| `app_revoke_review_authorization` | authorization_id | Lead or HOD |

### 4.3 Student workflow (the caller must be the project's own student)

| Function | Arguments | Rules |
|---|---|---|
| `app_select_paper` | paper_id | Only before the paper-change cutoff week or while no paper is approved |
| `app_submit_record` | target_type (exploration, paper, paper_analysis, repository, objective, draft_section, evaluation, final), target_id | Validates required fields (WORKFLOW_SPEC §2.1); status → `submitted`/`verification_pending`; stage → `awaiting_approval`; notifies the reviewers |
| `app_new_objective_version` | project_id | Copies the latest version into a new draft |
| `app_new_analysis_version` / `app_new_draft_version` | paper_id / project_id, section | Same pattern |
| `app_record_execution_attempt` | repository_id, attempted_at, outcome, errors, debugging_notes, evidence_ids[] | Moves `execution_status` among the student-controlled states |
| `app_submit_task` | task_id, progress_report, evidence_ids[] | Creates submission version n+1; sets `is_late`; task → `submitted`/`resubmitted`. S6+ tasks require S5 approved (`GATE_NOT_MET`) |
| `app_address_correction` | correction_id, response, evidence_ids[] | open → addressed |
| `app_set_blocked` | target ('task'\|'project'), id, blocked bool, reason | Student (own), a reviewer, lead, HOD |

### 4.4 Faculty workflow

| Function | Arguments | Auth / rules |
|---|---|---|
| `app_start_review` | submission_id | Reviewer of the project; task → `under_review` |
| `app_record_review` | target_type, target_id, outcome, observations, comments, corrections text[] | `comment_only`: any faculty-level user. Other outcomes: a reviewer of the project. `changes_requested` requires ≥ 1 correction. Applies the state transitions in WORKFLOW_SPEC §3 and the gate checks; runs the duplicate-paper check on paper approval |
| `app_resolve_correction` | correction_id, action ('verify'\|'reopen'\|'waive'), note | Reviewer of the project; `waive` and `reopen` require a note |
| `app_verify_evidence` | evidence_id, verification, note | Reviewer of the project |
| `app_approve_stage_exception` | project_id, stage_key, reason | Guide, lead or HOD; S4 only in v1 |
| `app_override` | project_id, kind ('duplicate_paper'\|'objective_gate'), reason | HOD only |
| `app_record_meeting` | semester_id, held_on, title, notes, attendee_ids[], outcomes jsonb[] | Faculty-level user |

### 4.5 Panels and sign-off

| Function | Arguments | Auth / rules |
|---|---|---|
| `app_set_panel` | semester_id, panel_id?, name, member_ids[], project_ids[] | HOD |
| `app_record_signoff` | project_id, decision, originality_remark, comments, corrections text[] | Panel member for the project. Preconditions: S7 and S8 approved, checklist verified, no open/addressed corrections. Completes the project when the quorum is reached |

### 4.6 Notifications

| Function | Arguments | Auth |
|---|---|---|
| `app_mark_notifications_read` | ids[] or all | Own rows |

## 5. Read endpoints (PostgREST, RLS-filtered)

| Endpoint | Typical query | Visible to |
|---|---|---|
| `GET /rest/v1/v_project_overview?semester_id=eq.X&domain_id=eq.Y&guide_id=eq.Z` | Project list with guide name, stage, progress, flags | Faculty-level users (all projects); student (own row) |
| `GET /rest/v1/projects?id=eq.X&select=*,project_stages(*),papers(*),...` | Project detail with its stage data | `can_view_project` |
| `GET /rest/v1/tasks?project_id=eq.X&order=week_no` | Timeline | `can_view_project` |
| `GET /rest/v1/submissions?task_id=eq.X&select=*,submission_evidence(evidence(*))` | Version history | `can_view_project` |
| `GET /rest/v1/reviews?project_id=eq.X` and `corrections?project_id=eq.X` | Review thread | `can_view_project` |
| `GET /rest/v1/v_review_queue?semester_id=eq.X` | Queue (filter `eligible_reviewer_ids=cs.{me}` for "mine") | Faculty-level users |
| `GET /rest/v1/v_faculty_workload?semester_id=eq.X` | Workload | HOD, admin, lead |
| `GET /rest/v1/v_timeliness?semester_id=eq.X` | Timeliness | Faculty-level users; student (own) |
| `GET /rest/v1/v_duplicate_warnings?semester_id=eq.X` | Uniqueness warnings | Faculty-level users |
| `GET /rest/v1/audit_log?project_id=eq.X&order=created_at.desc` | Audit trail | HOD, admin; lead (project rows) |
| `GET /rest/v1/notifications?read_at=is.null` | Inbox | Own rows |

**CSV export** is done in the browser from the same views (no separate endpoint), and only for HOD, admin and lead.

## 6. Content write endpoints (PostgREST)

The student's own project only; editable states only; protected columns are rejected by a trigger.

`POST/PATCH` on:
- `research_explorations`, `papers`, `paper_analyses`, `code_repositories`;
- `objective_versions`, `implementation_items`, `evaluation_results`, `paper_drafts`;
- `evidence`;
- `final_deliverables` (`evidence_id`, `notes` only).

There are no `DELETE` policies on these tables. Students withdraw candidate papers (`status = withdrawn`) or drop items (`status = dropped`) instead.
