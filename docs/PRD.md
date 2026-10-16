# PRD — Research-Based Mini-Project Management System

| | |
|---|---|
| Status | Phase 0 — awaiting approval |
| Owner | HOD: Dr. Vidyavathi B M |
| Last updated | 2026-10-16 |
| Related | TRD.md, USER_ROLES_AND_PERMISSIONS.md, WORKFLOW_SPEC.md |

## 1. Problem

Undergraduate mini-projects follow a research-driven path (paper → original code → research gap → own contribution → evaluation → paper writing → demo). Today, progress is tracked informally in Drive folders and conversations, so nobody can answer at a glance: *which paper did each student choose, does the original code actually run, are objectives approved, which corrections are still open, who is late, and who is waiting on faculty?*

## 2. Goal

A single web application where the HOD, the lead faculty, the faculty and the students track every project from paper selection to final sign-off — **based on evidence and approvals, not on self-reported percentages.**

### Success measures

- 100 % of active students have an approved paper by the end of Week 2 (or a logged reason why not).
- Every stage transition is backed by a recorded faculty decision with a timestamp.
- Any dashboard number can be drilled down to the underlying records.
- Faculty review turnaround (submission → outcome) is measurable per faculty.
- Final sign-off is impossible while corrections are open or the checklist is incomplete.

### Non-goals (v1)

- Automatic grading or marks computed by the system.
- Copying files out of Google Drive (links and metadata only).
- Plagiarism detection of document contents.
- AI features (separate later phase — see AI_FEATURE_SPEC.md).
- Team projects (projects are **individual only**).

## 3. Users

| Role | Who | Count |
|---|---|---|
| HOD / System Administrator | Dr. Vidyavathi B M | 1 |
| Authorized Administrator | Optional delegate appointed by the HOD | 0 initially |
| Lead Faculty | To be added by the HOD | 1 |
| Faculty | To be added by the HOD | 3 (configurable) |
| Student | Roster supplied by the HOD | up to 30 per semester (configurable capacity) |

## 4. Decisions recorded from stakeholder review (2026-10-16)

| # | Decision |
|---|---|
| D1 | Platform: **Supabase** (Postgres + Auth + Row-Level Security + Edge Functions) with a React/TypeScript/Tailwind frontend. Replaces the originally proposed MongoDB + Express. |
| D2 | Student capacity is configurable per semester; default **30**. Roster slots may be blank until filled. |
| D3 | HOD is **Dr. Vidyavathi B M**. Other faculty and students are added later by the HOD in the app. No names are seeded. |
| D4 | Project lists always show the **guide**. |
| D5 | Faculty declare their **domain expertise** and select (request) the projects they will guide in those domains. |
| D6 | Semester dates are entered by the HOD in the setup screen; nothing date-related is hardcoded. |
| D7 | The HOD may also guide and review students. |
| D8 | Guide changes and standing co-reviewer assignments proposed by the lead or faculty require **HOD approval**. |
| D9 | The **lead faculty** authorizes faculty to review students who are not assigned to them. |
| D10 | Final sign-off is given by a **panel**. |
| D11 | Projects are **individual only**. |
| D12 | Evaluation focuses on **uniqueness of the work** and **on-time submission**. The system provides uniqueness checks and timeliness data; the panel makes the judgement. |
| D13 | Documents stay in the existing **Google Drive** folders; the app stores links. |
| D14 | GitHub repository is created later; development starts in a local git repository. |

Defaults adopted (can be changed on request): code-availability check at paper selection, formal "no code / blocked" exception for Stage 4, paper change cut-off at end of Week 4, *Overdue* and *Blocked* as flags rather than statuses, progressive paper writing from Week 5.

## 5. Feature list with user stories and acceptance criteria

Notation: **AC** = acceptance criterion. Every AC is covered by a test in TEST_PLAN.md (IDs in brackets).

### F1 Semester workspace (HOD)

- *As the HOD, I create a semester workspace and configure its settings so the tracker can be reused every semester.*
- AC1.1 Only the HOD (or an admin with delegated config permission) can create a semester. [SEC-01]
- AC1.2 Settings: name, academic year, start date (first lab day), number of weeks (default 16), timezone (default Asia/Kolkata), lab weekday and time (default Tuesday 14:00–16:40), submission deadline (default Monday 23:59), faculty review deadline (default Thursday 23:59), target paper year (default 2026), student capacity (default 30), stage weights, panel quorum. [FUN-01]
- AC1.3 Week dates are derived from the start date; individual milestone dates can be overridden. [FUN-02]
- AC1.4 A semester can be in draft, active or closed. Closed semesters are read-only. [FUN-03]

### F2 Accounts and hierarchy

- *As the HOD, I invite faculty, appoint one lead faculty and place the other faculty under the lead.*
- AC2.1 Invites are sent by email; the invitee sets a password. [FUN-04]
- AC2.2 Exactly one active lead faculty per semester. [DATA-01]
- AC2.3 Only the HOD can change roles or the hierarchy; each change is audited with before/after values. [SEC-02, AUD-01]
- AC2.4 Password recovery by email link (single use, time-limited). [SEC-03]
- AC2.5 Deactivated users cannot sign in or act; their history remains. [SEC-04]

### F3 Student roster and projects

- *As the HOD, I import the real roster exactly as supplied, including blank slots.*
- AC3.1 CSV import with preview; rows are stored exactly as given; no generated names or IDs. [DATA-02]
- AC3.2 Blank slots are kept as `empty` roster entries and can be filled later. [DATA-03]
- AC3.3 Imports beyond the semester capacity are rejected with a clear message. [DATA-04]
- AC3.4 Each filled roster entry has exactly one individual project. [DATA-05]
- AC3.5 Each student has a Drive folder link (optionally per-week folder links). [FUN-05]

### F4 Domains, expertise and guide selection

- *As a faculty member, I record my domain expertise and request to guide students in those domains.*
- AC4.1 Domains are configurable per semester (none hardcoded). [FUN-06]
- AC4.2 Faculty (including the lead and the HOD) record expertise domains. [FUN-07]
- AC4.3 Guide requests are allowed only for projects in the requester's expertise domains (the HOD can override). [FUN-08]
- AC4.4 Requests become effective only after HOD approval; the HOD can also assign directly. [SEC-05]
- AC4.5 Every project list shows the guide, or "Unassigned". [UI-01]
- AC4.6 The lead faculty can grant a faculty member review authorization for a specific project (optionally time-limited). [SEC-06]

### F5 Research stages S1–S5

- *As a student, I record my exploration, paper, analysis, repository and execution attempts, and objectives using structured forms.*
- AC5.1 Stage forms enforce required fields (see WORKFLOW_SPEC.md); a bare link cannot be submitted as an analysis. [VAL-01]
- AC5.2 A paper is flagged as a target-year paper or a foundational paper; foundational papers require a justification. [VAL-02]
- AC5.3 No two projects in a semester can hold the same approved paper (same DOI or normalized title) unless the HOD overrides with a reason. [DATA-06]
- AC5.4 Execution status follows the eight defined states; "Verified" can only be set by an authorized reviewer, and requires at least one execution attempt with evidence. [WF-01]
- AC5.5 Objectives are versioned; only one version can be approved; S6 tasks cannot be submitted before objectives are approved (unless the HOD records an override). [WF-02]

### F6 Weekly tasks, submissions, reviews and corrections

- *As a student, I see my weekly tasks with acceptance criteria, submit a progress report with evidence, and respond to corrections.*
- *As a faculty member, I review submissions in my queue, record an outcome and corrections, and later verify the corrections.*
- AC6.1 Tasks are generated from the semester templates (with domain-specific overrides). [FUN-09]
- AC6.2 Every submission is a new immutable version; history is never overwritten. [DATA-07]
- AC6.3 Each submission records whether it was on time or late (compared with the task deadline at the time of submission). [FUN-10]
- AC6.4 Review outcomes: accepted, changes requested, rejected, comment only. A "changes requested" review must contain at least one correction. [WF-03]
- AC6.5 Corrections move open → addressed (student) → verified (reviewer), or waived (reviewer, with a reason). [WF-04]
- AC6.6 Only the guide, co-reviewers, faculty with an active review authorization, the lead and the HOD can record review outcomes; all faculty can comment. [SEC-07]
- AC6.7 Overdue is computed (deadline passed and task not verified); Blocked is a flag with a reason. [FUN-11]

### F7 Implementation, evaluation, writing and final stages S6–S9

- AC7.1 Implementation items distinguish planned and completed features, with commit links and evidence. [FUN-12]
- AC7.2 Evaluation results are tagged **baseline** (original implementation) or **proposed** (student contribution) and must reference evidence. [DATA-08]
- AC7.3 Draft sections are versioned, each with a Drive/Docs link, and are approved one by one. [FUN-13]
- AC7.4 The final checklist covers the paper, report, repository, ZIP (if required), README, dataset references, presentation and demo evidence. [FUN-14]

### F8 Panel sign-off and evaluation records

- AC8.1 The HOD forms panels and assigns projects to them. [FUN-15]
- AC8.2 A panel member can record a sign-off only when the checklist is complete and no corrections are open. [WF-05]
- AC8.3 A sign-off records a decision, remarks on originality/uniqueness and comments; timeliness statistics are shown alongside. [FUN-16]
- AC8.4 The project is marked complete only when the panel quorum (default: all members) has approved. [WF-06]

### F9 Dashboards and reports

- AC9.1 Role dashboards as defined in UI_UX_SPEC.md; every number links to a filtered list. [UI-02]
- AC9.2 Progress is calculated from approved stages and verified tasks only; it cannot be edited by hand. [DATA-09]
- AC9.3 CSV export of the project overview, review queue, timeliness and audit trail (HOD/lead). [FUN-17]

### F10 Notifications

- AC10.1 In-app notifications for new submissions (reviewers), review outcomes (student), corrections, approvals, assignment decisions and upcoming deadlines (48 h). [FUN-18]

### F11 Audit history

- AC11.1 Inserts, updates and deletes of business records are written to an append-only audit log with the actor, time and before/after values. [AUD-01]
- AC11.2 No user, including the HOD, can edit or delete audit entries through the application. [AUD-02]

## 6. Questions the system must answer (traceability)

| Question | Where it is answered |
|---|---|
| Which paper has each student selected? Is it relevant? | Project overview → Paper column; S2 record with relevance note and approval |
| Downloaded and analysed? | S2 PDF evidence; S3 analysis status |
| Original repository available / executed? Errors? | S4 repository status; execution attempts with errors and logs |
| Research gaps and objectives finalized? | S5 objective version status |
| Modifications being implemented? | S6 implementation items |
| Weekly tasks completed? | Task statuses, timeline |
| Faculty observations and corrections? | Reviews and correction tracker |
| Paper, results and documentation ready? | S7, S8, S9 records and final checklist |
| Who is delayed, blocked or waiting for faculty? | Flags (overdue/blocked) and review queue age on the dashboards |

## 7. Open items (not blocking Phase 1)

- O1 Authorized administrator — whether one is needed now. Default: none; the role exists but is unused.
- O2 Hosting provider for the frontend and budget for a paid Supabase plan (needed for backups). See DEPLOYMENT_AND_SECURITY.md.
- O3 Email sender domain / SMTP account for invites and password resets.
- O4 Faculty names and emails, roster file, domain list and semester start date — entered in the app by the HOD.
- O5 Panel composition rules (whether the guide may sit on their own student's panel). Default: allowed.
