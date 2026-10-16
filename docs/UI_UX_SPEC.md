# UI / UX Specification

Status: Phase 0 — awaiting approval.

## 1. Principles

- **Evidence first.** Every status chip opens the record behind it: who decided, when, and on what evidence.
- **One project page for everyone.** Students, faculty and the HOD see the same project page. Available actions depend on the role.
- **Queues over searching.** Faculty start from "what needs me now".
- **Status is never shown by colour alone.** Each status chip has an icon and a text label.
- **Plain language.** "Changes requested — 2 open corrections", not internal codes.

## 2. Navigation

Top bar: semester switcher (users with memberships in several semesters), notifications bell, user menu.

Left navigation by role:

| HOD | Lead | Faculty | Student |
|---|---|---|---|
| Dashboard | Dashboard | Dashboard | My project |
| Projects | Projects | Projects | Timeline & tasks |
| Review queue | Review queue | My review queue | Feedback & corrections |
| Assignments (requests) | Assignments (propose, authorize) | Expertise & guide requests | Evidence |
| Panels & sign-off | Meetings | Meetings | Final checklist |
| People & roles | Reports | | |
| Semester setup | | | |
| Reports · Audit log | | | |

## 3. Screen inventory

| ID | Screen | Roles | Key content and actions |
|---|---|---|---|
| A1 | Sign in | All | Email, password, "Forgot password" |
| A2 | Forgot / reset password | All | Neutral confirmation message |
| A3 | Accept invite / set password | Invitees | Password rules shown as you type |
| H1 | HOD dashboard | HOD, admin | See §4 |
| H2 | Semester setup wizard | HOD | Steps: details & dates → schedule & deadlines → domains → 16-week milestones and templates → stage weights → review & activate |
| H3 | People & roles | HOD | Invite faculty, set the lead, hierarchy tree, deactivate users, system roles |
| H4 | Roster | HOD | CSV import with dry-run preview (row-by-row result); slot grid showing empty slots; invite students; Drive links |
| H5 | Assignment requests | HOD | Pending guide/co-reviewer requests with domain match and current load; approve/reject with a note; direct assignment |
| H6 | Panels | HOD | Create panels, members, projects; sign-off progress |
| H7 | Audit log | HOD, admin, lead (project scope) | Filter by actor, project, action and date; diff view |
| L1 | Lead dashboard | Lead | See §4 |
| L2 | Review authorization | Lead, HOD | Grant or revoke per project, with an optional expiry |
| F1 | Faculty dashboard | Faculty | See §4 |
| F2 | Expertise & guide requests | Faculty-level | Choose expertise domains; list unassigned projects in those domains; "Request to guide" |
| P1 | Projects list | Faculty-level | Table: slot, student, ID, domain, **guide**, stage, progress, paper, execution, objectives, flags, last activity. Filters, saved views, CSV export |
| P2 | Project page | All (scoped) | Header (student, domain, guide, co-reviewers, progress, flags) + **stage stepper S1–S9** + tabs below |
| P2.1 | ↳ Overview | | Stage status cards, open corrections, next deadline |
| P2.2 | ↳ Stage tabs S1–S9 | | Structured forms (student) or read-only view with a review panel (reviewers); version history; evidence |
| P2.3 | ↳ Timeline | | 16 weeks × tasks; status chips; overdue/blocked badges; submission versions |
| P2.4 | ↳ Reviews & corrections | | Thread in time order; correction tracker |
| P2.5 | ↳ Evidence | | All links by category, with verification status |
| P2.6 | ↳ History | | Audit trail for this project (HOD, admin, lead) |
| R1 | Review queue | Faculty-level | Tabs: Task submissions · Papers · Analyses · Executions · Objectives · Drafts · Corrections to verify. Columns: age, student, guide, item. "Mine" / "All" toggle |
| R2 | Review panel (drawer) | Reviewers | Submission + evidence links + earlier corrections; outcome selector; observations; corrections list editor |
| S1 | Student home | Student | See §4 |
| S2 | Submit task | Student | Acceptance criteria checklist (for self-check), progress report, evidence picker / add link, late warning if past the deadline |
| M1 | Meetings | Faculty-level | Meeting form with attendees and per-project outcomes |
| N1 | Notifications | All | Inbox with links |
| X1 | Sign-off screen | Panel members | Checklist status, open corrections (must be 0), timeliness stats, uniqueness warnings, decision + originality remark |

## 4. Dashboards

Every tile and chart segment links to P1 or R1 with the matching filter applied.

### HOD (H1)

- **KPI row:**
  - registered students / capacity;
  - active projects;
  - empty slots;
  - submissions this week (submitted / due);
  - pending reviews (with the oldest age);
  - overdue tasks;
  - blocked projects.
- **Stage funnel:** number of projects at each stage S1–S9.
- **Gate status:**
  - papers approved;
  - execution verified / exception / failed / blocked;
  - objectives approved;
  - draft sections approved;
  - projects completed.
- **Domain distribution:** projects per domain, with guide coverage.
- **Faculty workload table:** guided projects, pending reviews, average turnaround, reviews this week.
- **Attention lists:**
  - blocked projects (with reasons);
  - overdue > 7 days;
  - submissions waiting > 3 days;
  - unassigned projects;
  - pending assignment requests.

### Lead (L1)

- All projects by domain × stage (heat table).
- Review queues per faculty member, with ageing.
- Blocked students and technical problems (execution failed/blocked).
- Upcoming meetings and the next lab session.
- Milestone delays: the expected stage for the current week compared with the actual stage, per project.
- Corrective actions (open corrections older than one week).
- Button: "Escalate to HOD" — creates a notification to the HOD with a link and a note.

### Faculty (F1)

- My students (guide / co-reviewer / authorized), each with stage and flags.
- My queue counts by type.
- Corrections waiting for my verification.
- Executions with errors in my projects.
- Upcoming review dates.
- A shared "All projects" summary, which links to P1.

### Student (S1)

- Header: domain, guide, project title, progress (with breakdown).
- Current-week card: tasks, acceptance criteria, deadline countdown, "Submit".
- Stage stepper with the status of each stage.
- Latest feedback and open corrections (with "Mark addressed").
- Paper, execution and objective summaries.
- Final checklist progress.
- My timeliness: on-time and late counts.

## 5. Reusable components

AppShell · RoleGuard (UI only) · StatusChip (per status family) · StageStepper · ProgressBar with breakdown popover · DataTable (sort, filter, CSV) · Timeline (week × task grid) · EvidenceList / EvidenceLinkForm · ReviewThread · CorrectionTracker · ReviewPanel · VersionHistory · DiffView · KpiTile · EmptyState · ErrorState · ConfirmDialog · FormField set (text, textarea with a counter, tag input, URL input with https check, date/time in the semester timezone).

## 6. Interaction rules

- Forms save drafts explicitly ("Save draft") and submit with confirmation ("Submit for review — you cannot edit after submitting").
- Locked records show a lock banner explaining why and what to do next (for example "Create a new version").
- Late submissions are allowed, but show a warning first: "This will be recorded as late."
- Destructive or irreversible actions (approve, waive, deactivate, override) need confirmation and, where the rules require one, a reason.
- Loading uses skeletons; errors show a friendly message and a retry button; empty states explain the next step.
- Times are shown in the semester timezone with the abbreviation (for example "Mon 20 Oct, 23:59 IST").
- Layout is responsive: tables become cards below 768 px; the stage stepper scrolls horizontally on small screens.

## 7. Visual design

- Neutral base with one accent colour.
- Status colours: grey = not started, blue = in progress/submitted, amber = changes requested/awaiting, green = approved/verified, red = rejected/overdue/blocked.
- Light and dark themes.
- Base font size 16 px; tabular numbers in tables.
