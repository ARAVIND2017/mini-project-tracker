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
| `app_generate_tasks` | semester_id, project_id?, regenerate bool | count | HOD/admin (`manage_config`); needs a start date. Creates the missing tasks from the templates (with domain overrides) and computes `due_at`; with `regenerate`, refreshes tasks that have no submission and switches off those whose template no longer applies. Tasks are also generated automatically when the semester is activated, when a project is added to an active semester, and when a project's domain changes |
| `app_upsert_milestone` | semester_id, week_no, data {title, stage_key, description, is_gate, checkpoint, start_date_override} | milestone id | HOD/admin (`manage_config`). Built in Phase 5; a new semester starts with the default 16-week plan |
| `app_upsert_task_template` | semester_id, data {week_no, stage_key, domain_id, replaces_template_id, title, description, acceptance_criteria[], required_evidence[], sort_order, is_active}, template_id? | template id | HOD/admin. A domain template may replace a generic one; templates are switched off, never deleted |

Domains, criteria, milestones and templates are changed through the functions above (there are no table write privileges).

### 4.2 Domains, roster and assignments (built in Phase 3)

| Function | Arguments | Auth / rules |
|---|---|---|
| `app_upsert_domain` | semester_id, name, description?, is_active?, domain_id? | HOD/admin (`manage_config`). Names unique per semester (ignoring case/spaces). Domains are switched off, never deleted |
| `app_upsert_criterion` | domain_id, name, description?, sort_order?, is_active?, criterion_id? | HOD/admin (`manage_config`) |
| `app_set_expertise` | semester_id, domain_ids[], user_id? | Faculty-level caller for themselves; the HOD for anyone. Unlisted domains are switched off (history kept) |
| `app_import_roster` | semester_id, rows jsonb, dry_run (default **true**) | HOD/admin (`manage_roster`). Preview by default; a real import is all-or-nothing. Values stored as given (surrounding spaces trimmed). Blank rows → empty slots. Errors: duplicate slot/ID/email, bad email/Drive link, unknown domain, emptying a filled slot, withdrawn slot, `CAPACITY_EXCEEDED` |
| `app_update_student` | student_id, patch {institution_id, full_name, email, drive_folder_url} | HOD/admin (`manage_roster`). A filled slot cannot be emptied; email is fixed once the student has an account |
| `app_add_empty_slots` | semester_id, up_to_slot | HOD/admin (`manage_roster`) |
| `app_withdraw_student` | student_id, reason | HOD. Keeps the roster entry and project; removes the student role |
| `app_link_student` | student_id, user_id | HOD/admin; called by the `admin-users` Edge Function (`invite_student`). Roster email must match the account email |
| `app_set_my_drive_folder` | student_id, url | The student, for their own roster entry |
| `app_set_project_domain` | project_id, domain_id \| null | HOD/admin (`manage_config`) |
| `app_set_project_title` | project_id, title | The project's student (until objectives are approved) or the HOD |
| `app_request_assignment` | project_id, type, faculty_id, reason | A faculty-level user for themselves, only in their expertise domains (HOD exempt); the lead or HOD may propose anyone. The project needs a domain |
| `app_cancel_assignment_request` | request_id | The requester or the HOD; pending only |
| `app_decide_assignment_request` | request_id, approve, note? | HOD only. Approving a guide closes other pending guide requests for that project |
| `app_assign_guide` | project_id, faculty_id \| null, note? | HOD only (direct assignment or unassignment) |
| `app_remove_co_reviewer` | project_id, faculty_id, note? | HOD only (row switched off, kept) |
| `app_grant_review_authorization` | project_id, faculty_id, valid_until?, note? | Lead or HOD (D9). Not for the guide; one active authorization per person and project |
| `app_revoke_review_authorization` | authorization_id | Lead or HOD |

The `admin-users` Edge Function gained `invite_student {student_id}` (HOD/admin with `manage_roster` or `manage_users`): it sends the invitation (or reuses an existing account with the same email) and calls `app_link_student`.

**Read model:** `v_projects` (security invoker) — one row per project with slot, student, student ID, domain, **guide name**, co-reviewer names, pending request count and current stage.

### 4.3 Student workflow (the caller must be the project's own student)

Built in Phase 4 for S1–S5. Forms send every field as `p_data` jsonb; unknown fields → `VALIDATION`. A record can be saved while it is `draft` or `changes_requested` (`INVALID_STATE` otherwise).

| Function | Arguments | Rules |
|---|---|---|
| `app_save_exploration` | project_id, data {candidate_topics[], keywords[], sources[{name,url}], proposed_problem} | One exploration per project. Blank list entries are dropped; source links must be https |
| `app_save_paper` | project_id, data {title, authors[], pub_year, venue, doi, url, pdf_drive_url, abstract, research_problem, relevance_note, code_availability, foundational_justification}, paper_id? | New candidate (at most 10 open) or edit of a `candidate`. DOI may be pasted as a doi.org link |
| `app_select_paper` | paper_id | Candidate only; not while another paper is submitted or approved |
| `app_withdraw_paper` | paper_id, reason? | Candidate: the student or a reviewer. Approved: a reviewer until the end of the cutoff week, then only the HOD (WF-08); reason ≥ 10 characters. Later stages built on the paper are reopened and their records superseded |
| `app_save_analysis` / `app_new_analysis_version` | paper_id, data / paper_id | For the selected paper. A new version starts from the approved one |
| `app_save_repository` | project_id, data {repo_url, owner, name, commit_ref, language, framework, dataset_requirements, environment, setup_instructions} | Needs a selected paper. A repository for an earlier paper is kept as history (`is_current = false`) |
| `app_record_execution_attempt` | repository_id, attempted_at, outcome, errors?, debugging_notes?, notes?, evidence jsonb[{category,url,description}] | Moves `execution_status` among the student-controlled states. Failed/blocked need the errors. Attempts are immutable |
| `app_save_objective` / `app_new_objective_version` | project_id, data / project_id | Versioned; one approved version per project |
| `app_add_evidence` | project_id, stage_key, category, url, description | https only (SEC-12); description ≥ 10 characters |
| `app_submit_record` | target_type (exploration, paper, paper_analysis, repository, objective), target_id | Validates required fields (WORKFLOW_SPEC §2.1) and lists everything missing; refuses while corrections are open; status → `submitted` / `verification_pending`; stage → `awaiting_approval` (unless an approved version is already in force). The repository needs a successful attempt with evidence (WF-01) |
| `app_address_correction` | correction_id, response, evidence_ids[]? | open → addressed; response ≥ 10 characters |
| `app_start_task` | task_id | not_started → in_progress |
| `app_submit_task` | task_id, progress_report (≥ 100 characters), evidence jsonb [{category,url,description}], evidence_ids[]? | Creates immutable submission version n+1 and records `is_late` against the deadline at that moment; task → `submitted` (or `resubmitted` after changes were requested). Refused while the task waits for review, while corrections are open, or without evidence when the task expects some. S6, S7 and S9 tasks need S5 approved or the HOD's `objective_gate` override (`GATE_NOT_MET`, WF-02) |
| `app_set_blocked` | target ('task'\|'project'), id, blocked bool, reason | Student (own), a reviewer, lead, HOD. A flag with a reason; the status does not change |

### 4.4 Faculty workflow

| Function | Arguments | Auth / rules |
|---|---|---|
| `app_start_review` | submission_id | Reviewer of the project; latest version only; task → `under_review` |
| `app_record_review` | target_type, target_id, outcome, observations, comments, corrections text[] | `comment_only`: any faculty-level user; changes nothing and creates no corrections. Other outcomes: a reviewer of the project, only for a record waiting for review. `changes_requested` requires ≥ 1 correction; `rejected` requires observations; `accepted` requires every correction on the record verified or waived and the stages it depends on approved (`GATE_NOT_MET`). Applies the state transitions in WORKFLOW_SPEC §3; runs the duplicate-paper check on paper approval (`DUPLICATE_PAPER`) |
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

## 6. Content writes

**Changed in Phase 3–4:** there are no PostgREST write endpoints. API roles have `SELECT` only, and every content change goes through the workflow functions in §4, which check the caller, the lock rules and the required fields. Direct `POST/PATCH/DELETE` on any table fails with "permission denied" (SEC-09). Business records are never deleted: candidate papers are withdrawn, versions are superseded, repositories are replaced, and reviews and execution attempts are immutable.
