# Database Specification (Supabase / Postgres)

Status: Phase 0 — awaiting approval.

Conventions:
- Every table has `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()` and, where rows are mutable, `updated_at` (maintained by a trigger).
- Foreign keys use `on delete restrict` unless stated otherwise. Business records are never hard-deleted by users; they are withdrawn or superseded instead.
- RLS is enabled on every table. "Read" and "Write" below summarise the policies; the full rules are in USER_ROLES_AND_PERMISSIONS.md.
- All URL columns have the check `url ~* '^https://'`.

## 1. Enum types

These are defined in migration `0001_foundation.sql` and must match WORKFLOW_SPEC.md §1.

```
system_role            hod, admin
semester_role          lead_faculty, faculty, student
semester_status        draft, active, closed
roster_status          empty, pending_invite, active, withdrawn
stage_key              exploration, paper_selection, paper_analysis, code_execution, objectives,
                       implementation, evaluation, paper_writing, final
stage_status           not_started, in_progress, awaiting_approval, changes_requested, approved, exception_approved
task_status            not_started, in_progress, submitted, under_review, changes_requested, resubmitted, verified
record_status          draft, submitted, changes_requested, approved, superseded
paper_status           candidate, submitted, approved, rejected, withdrawn
code_availability      unknown, available, not_available
execution_status       not_started, repository_identified, environment_setup, execution_successful,
                       execution_failed, blocked_dependency_dataset, verification_pending, verified
attempt_outcome        success, failed, blocked
review_target          exploration, paper, paper_analysis, repository, objective, task_submission,
                       draft_section, evaluation, final
review_outcome         accepted, changes_requested, rejected, comment_only
correction_status      open, addressed, verified, waived
evidence_category      research_paper_pdf, paper_analysis, github_repository, execution_screenshot,
                       execution_log, result_file, objective_document, implementation_evidence,
                       test_results, paper_draft, final_report, presentation, final_zip,
                       demo_evidence, other
evidence_verification  unverified, verified, rejected, inaccessible
implementation_type    feature, dataset, model_change, frontend, backend, integration, bug
item_status            planned, in_progress, done, blocked, dropped
evaluation_kind        baseline, proposed
draft_section          title_abstract, introduction, literature_review, problem_objectives, methodology,
                       proposed_approach, implementation, results_discussion, conclusion_future_work, references
deliverable_item       final_paper, project_report, source_repository, source_zip, readme,
                       dataset_references, presentation, demo_evidence
assignment_type        guide, co_reviewer
request_status         pending, approved, rejected, cancelled
signoff_decision       approve, changes_required
```

## 2. Identity and hierarchy

### `profiles`
One row per auth user, created by a trigger on `auth.users` insert.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = `auth.users.id`, on delete cascade |
| full_name | text not null | 1–120 characters |
| email | citext unique not null | copied from auth |
| designation | text | e.g. "Assistant Professor" |
| is_active | bool default true | deactivated users fail every helper check |

Read: the user themselves; faculty-level users of any semester the user belongs to. Write: the user (full_name, designation only); HOD.

### `system_roles`
`user_id uuid FK profiles`, `role system_role`, `granted_by`, `granted_at`, `admin_permissions text[]` (for `admin` only: `manage_users`, `manage_config`, `manage_roster`), `revoked_at`, `revoked_by`. Unique (user_id, role). **Roles are never deleted:** revoking sets `revoked_at`/`revoked_by`, and re-granting clears them. Every permission check ignores revoked rows. A trigger prevents revoking (or deleting) the last active `hod`. Read: HOD, admin, the user. Write: HOD only, through RPCs.

### `semesters`
| Column | Type | Notes |
|---|---|---|
| name | text not null | e.g. "Odd Semester 2026-27" |
| academic_year | text | |
| status | semester_status default draft | |
| start_date | date null | first lab day; required before activation |
| week_count | int default 16 | check 1–30 |
| timezone | text default 'Asia/Kolkata' | must be a valid IANA zone |
| lab_weekday | int default 2 | ISO weekday (1 = Mon … 7 = Sun) |
| lab_start / lab_end | time default 14:00 / 16:40 | check end > start |
| submission_weekday / submission_time | int default 1 / time 23:59 | |
| review_weekday / review_time | int default 4 / time 23:59 | |
| target_paper_year | int default 2026 | |
| max_students | int default 30 | check 1–500 |
| stage_weights | jsonb | nine keys (one per stage_key); values total 100 (checked by trigger) |
| panel_quorum | int null | null = all members |
| paper_change_cutoff_week | int default 4 | |
| require_source_zip | bool default true | |

Read: any member of the semester and the HOD/admin. Write: HOD (admin with `manage_config`).

### `memberships`
`semester_id FK`, `user_id FK profiles`, `role semester_role`, `reports_to uuid FK memberships null`, `is_active bool`. Unique (semester_id, user_id).
- Partial unique index: one active `lead_faculty` per semester.
- Check: a `faculty` row reports to the lead's membership; `lead_faculty` and `student` have no `reports_to`.

Read: members of the same semester. Write: HOD only.

### `faculty_expertise`
`semester_id`, `user_id`, `domain_id`, `is_active`. Unique (user_id, domain_id). Removing a domain switches the row off (history kept). Read: faculty-level users and admins. Write: through `app_set_expertise` only.

## 3. Configuration

### `domains`
`semester_id`, `name` (unique per semester, case-insensitive), `description`, `is_active`. Read: semester members. Write: HOD/admin.

### `evaluation_criteria`
`domain_id`, `name`, `description`, `sort_order`. Used by objective versions and evaluation planning.

### `milestones`
`semester_id`, `week_no` (unique per semester, 1..week_count), `title`, `stage_key` (primary stage of the week), `description`, `is_gate bool`, `checkpoint text`, `start_date_override date null`.

### `task_templates`
`semester_id`, `week_no`, `stage_key`, `domain_id null` (null = all domains), `replaces_template_id null` (lets a domain-specific template replace a generic one), `title`, `description`, `acceptance_criteria text[]` (≥ 1), `required_evidence evidence_category[]`, `sort_order`.

## 4. Roster and projects

### `students` (roster entries)
| Column | Type | Notes |
|---|---|---|
| semester_id | uuid FK | |
| slot_no | int not null | unique (semester_id, slot_no) |
| institution_id | text null | e.g. USN; unique per semester when not null |
| full_name | text null | null for an empty slot |
| email | citext null | unique per semester when not null |
| user_id | uuid FK profiles null | linked when the invite is accepted |
| drive_folder_url | text null | https check |
| status | roster_status | `empty` when name and email are null |

- `status` is derived by a trigger: `empty` (no name/email/ID), `pending_invite` (filled, no account), `active` (account linked); `withdrawn` is set by the HOD and kept.
- Deferred constraint trigger: the number of non-`empty` rows must not exceed `semesters.max_students` (`CAPACITY_EXCEEDED`); the capacity cannot be lowered below the current count.
- Read: faculty-level users; the student reads their own row. Write: HOD/admin (`manage_roster`); the student may update `drive_folder_url` only.

### `student_drive_folders`
`student_id`, `week_no`, `url`. Unique (student_id, week_no). Optional per-week folder links.

### `projects`
| Column | Type | Notes |
|---|---|---|
| semester_id | uuid FK | |
| student_id | uuid FK students unique | individual projects (D11) |
| domain_id | uuid FK domains null | |
| title | text null | the working title |
| guide_id | uuid FK profiles null | protected column |
| is_completed / completed_at | bool / timestamptz | protected |
| blocked / blocked_reason / blocked_at / blocked_by | | flag |

Read: `can_view_project`. Write: the student may change `title` while S5 is not approved; HOD for `domain_id`; `guide_id` only through RPC.

### `project_stages`
`project_id`, `stage_key`, `status stage_status`, `approved_by`, `approved_at`, `exception_reason`. Primary key (project_id, stage_key). Nine rows are created with each project. All columns are protected (written only by workflow functions).

### `project_reviewers`
`project_id`, `user_id`, `is_active`, `added_via_request uuid null`, `added_by`. Unique (project_id, user_id). Written only by workflow functions; removing a co-reviewer switches the row off.

### `assignment_requests`
`project_id`, `type assignment_type`, `faculty_id` (who would become guide/co-reviewer), `requested_by`, `reason`, `status request_status`, `decided_by`, `decided_at`, `decision_note`.
- Partial unique index: one pending request per (project, type, faculty).

### `review_authorizations`
`project_id`, `faculty_id`, `granted_by` (lead or HOD), `valid_until timestamptz null`, `revoked_at null`, `note`. Active when `revoked_at is null and (valid_until is null or valid_until > now())`.

## 5. Stage content

### `research_explorations` (S1)
`project_id unique`, `candidate_topics text[]`, `keywords text[]`, `sources jsonb` (array of `{name, url}`), `proposed_problem text`, `status record_status`, `submitted_at`.

### `papers` (S2)
`project_id`, `title`, `title_normalized` (generated: lower-case, punctuation removed), `authors text[]`, `pub_year int`, `venue`, `doi citext null`, `url`, `pdf_drive_url`, `abstract`, `research_problem`, `relevance_note`, `code_availability`, `foundational_justification null`, `is_selected bool`, `status paper_status`, `selected_at`, `duplicate_override_reason null`.
- Partial unique index: one `is_selected` paper per project.
- Check: `foundational_justification` is required when `pub_year` ≠ the semester's target year (enforced by trigger, because the target year lives on `semesters`).
- Index on (doi) and (title_normalized) for the duplicate check.

### `paper_analyses` (S3)
`paper_id`, `project_id`, `version int`, `problem_addressed`, `research_objectives`, `methodology`, `datasets`, `tools`, `algorithms`, `reported_results`, `limitations`, `research_gaps`, `own_understanding`, `status record_status`. Unique (paper_id, version).

### `code_repositories` (S4)
`project_id`, `paper_id`, `repo_url`, `owner`, `name`, `commit_ref`, `language`, `framework`, `dataset_requirements`, `environment`, `setup_instructions`, `status execution_status` (protected).
- Partial unique index: one active (not replaced) repository per project.

### `execution_attempts`
`repository_id`, `attempted_at`, `outcome attempt_outcome`, `errors text`, `debugging_notes text`, `notes`. Evidence is linked through `evidence.linked_type = 'execution_attempt'`.

### `objective_versions` (S5)
`project_id`, `version`, `original_limitations`, `research_gap`, `problem_statement`, `main_objective`, `specific_objectives text[]` (≥ 2), `contribution`, `scope`, `exclusions`, `evaluation_criteria text[]`, `status record_status`.
- Unique (project_id, version).
- Partial unique index: one `approved` per project.

### `implementation_items` (S6)
`project_id`, `title`, `type implementation_type`, `is_planned bool`, `status item_status`, `commit_links text[]`, `notes`.

### `evaluation_results` (S7)
`project_id`, `kind evaluation_kind`, `test_case`, `expected`, `actual`, `metric_name null`, `metric_value numeric null`, `passed bool`, `evidence_id FK evidence not null`, `corrective_action null`, `status record_status`.

### `paper_drafts` (S8)
`project_id`, `section draft_section`, `version`, `doc_url`, `notes`, `status record_status`. Unique (project_id, section, version).

### `final_deliverables` (S9)
`project_id`, `item deliverable_item`, `evidence_id null`, `verification evidence_verification`, `notes`. Unique (project_id, item). Rows are created with the project; `source_zip` is created only if the semester requires it.

## 6. Tasks, submissions, evidence

### `tasks`
`project_id`, `template_id null`, `week_no`, `stage_key`, `title`, `description`, `acceptance_criteria text[]`, `required_evidence evidence_category[]`, `due_at timestamptz`, `status task_status` (protected), `blocked`, `blocked_reason`, `blocked_at`, `blocked_by`.
- Index (project_id, week_no); index (status, due_at).

### `submissions`
`task_id`, `project_id`, `version int`, `progress_report text` (≥ 100 characters), `submitted_by`, `submitted_at`, `is_late bool` (set by the function), `due_at_snapshot`. Unique (task_id, version). Immutable: no update or delete policies at all.

### `submission_evidence`
`submission_id`, `evidence_id`. Primary key on both.

### `evidence`
`project_id`, `category evidence_category`, `url`, `description` (≥ 10 characters), `stage_key`, `task_id null`, `linked_type text null`, `linked_id uuid null`, `verification evidence_verification` (protected), `verified_by`, `verified_at`, `verification_note`.
- Students can insert, and can update while the evidence is `unverified` and not attached to a submitted submission.
- Index (project_id, category).

## 7. Reviews and corrections

### `reviews`
`project_id`, `target_type review_target`, `target_id uuid`, `reviewer_id`, `outcome review_outcome`, `observations text`, `comments text`, `created_at`. Immutable. Index (target_type, target_id); index (reviewer_id, created_at).

### `corrections`
`review_id`, `project_id`, `description`, `status correction_status` (protected), `student_response`, `addressed_at`, `resolved_by`, `resolved_at`, `resolution_note`. Index (project_id, status).

### `review_meetings`, `meeting_attendees`, `meeting_outcomes`
- Meeting: `semester_id`, `held_on timestamptz`, `title`, `notes`, `recorded_by`.
- Attendee: `meeting_id`, `user_id`.
- Outcome: `meeting_id`, `project_id`, `outcome text`, `action_items text[]`.
- Students read only the outcome rows for their own project.

## 8. Panels and sign-off

- `panels`: `semester_id`, `name`.
- `panel_members`: `panel_id`, `user_id`.
- `panel_projects`: `panel_id`, `project_id` — unique project per semester.
- `final_signoffs`: `project_id`, `panel_member_id`, `decision signoff_decision`, `originality_remark text not null`, `comments`, `created_at`. Unique (project_id, panel_member_id) — a member's latest decision replaces the earlier one through the function, and the history is kept in the audit log.

## 9. Notifications and audit

- `notifications`: `user_id`, `type text`, `title`, `body`, `link`, `read_at`. Users read and update (`read_at` only) their own rows. Rows are inserted by workflow functions.
- `audit_log`: `id bigserial`, `actor_id uuid null`, `action text` (INSERT/UPDATE/DELETE or a workflow action name), `table_name`, `row_id uuid`, `project_id uuid null`, `semester_id uuid null`, `old_data jsonb`, `new_data jsonb`, `created_at`.
  - No update or delete privilege for `anon` or `authenticated`.
  - Read: HOD/admin (all); lead (rows with a `project_id` in the lead's semester).
  - Index (row_id); index (project_id, created_at).

## 10. Views (read models for the dashboards)

| View | Purpose |
|---|---|
| `v_project_overview` | One row per project: student, slot, domain, **guide name**, current stage, stage statuses, progress, overdue count, blocked, open corrections, selected paper title, execution status, objective status |
| `v_review_queue` | Pending items (task submissions and stage records awaiting review) with age, project, guide, eligible reviewers |
| `v_faculty_workload` | Per faculty member: guided projects, pending reviews, average turnaround, reviews this week |
| `v_task_flags` | Tasks with computed `is_overdue` |
| `v_timeliness` | Per project: due, on time, late, average delay, overdue without submission |
| `v_duplicate_warnings` | Shared DOI / title / repository URLs within a semester |

All views are created with `security_invoker = true`, so the RLS of the underlying tables applies to them.

## 11. Integrity rules (summary)

| Rule | Mechanism |
|---|---|
| One project per student | unique `projects.student_id` |
| One selected paper; one approved objective version | partial unique indexes |
| One active lead per semester | partial unique index |
| Capacity limit | trigger on `students` |
| Stage weights total 100 | trigger on `semesters` |
| Submissions and reviews are immutable | no update/delete policies + trigger guard |
| Locked records once submitted/approved | `BEFORE UPDATE` trigger |
| Protected workflow columns | `app.guard_protected_columns` trigger: rejects changes when `current_user` is an API role (`anon`, `authenticated`); workflow RPCs are `security definer`, so inside them `current_user` is the function owner |
| No final sign-off with open corrections | check inside `app_record_signoff` |
| Duplicate approved paper | check inside `app_record_review` for `paper` targets |
