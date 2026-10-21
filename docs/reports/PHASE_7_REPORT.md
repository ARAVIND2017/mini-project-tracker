# Phase 7 Report — Dashboards, reports, notifications, meetings and audit

Date: 2026-10-21 · Status: **built, tested and deployed to Supabase. Awaiting approval to start Phase 8.**

## What was delivered

### Database (live on Supabase, three migrations `p7a`–`p7c`)

**Notifications (FUN-18)**

- **How they are made:** the database writes notifications itself, from the workflow events already recorded in the audit log, in the same transaction. No workflow function had to change, and no notification can be missed or faked from the browser.
- **Who is notified of what:**

  | Event | Notified |
  |---|---|
  | A weekly task or stage record is submitted | The project's reviewers (for S9, also the panel) |
  | A review is recorded | The student |
  | A correction is addressed | The reviewers (for S9, the panel) |
  | A guide or co-reviewer request is decided | The faculty member who asked |
  | An S4 exception is approved, a panel member decides, the project is completed | The student (on completion, also the guide) |
  | A meeting outcome is recorded | The student |
  | The lead escalates a project | The HOD |

- **Rules:** nobody is notified of their own action, and links are in-app paths only.
- **Deadline reminders:** a "due soon" reminder for each open task due in the next 48 hours, added once per task. The app adds them while the student is using it, so no scheduled job is needed.
- **Inbox:** users read only their own notifications and can mark them as read. Nothing else can be written directly.

**Escalation:** the lead (or the HOD) can raise a project with the HOD by writing a note. The HOD is notified and the escalation goes into the audit log.

**Review meetings:**

- A meeting records the date, title, notes, who attended, and one outcome per project discussed (with action items).
- Meetings cannot be edited afterwards and cannot be dated in the future.
- **A student sees only the outcome for their own project** and not the attendance list.

**Progress (DATA-09):**

- Progress is **calculated, never stored**. There is no column anyone could set.
- Each stage counts its full weight once approved (or after an approved exception). Before that it counts the share of its weekly tasks that are verified. Submitted work counts only after review.
- The weights are the semester's setting (total 100).
- The breakdown for each stage is available, and the student page shows it.

**Dashboard read models:**

- `v_project_overview`: one row per project, with progress, stage statuses, overdue and blocked tasks, open corrections and corrections waiting to be verified, the selected paper, execution and objective status, and last activity.
- `v_task_flags`: overdue or blocked tasks, with how many days overdue.
- `v_faculty_workload`: for each faculty member and the HOD — projects guided and co-reviewed, items waiting, oldest wait, corrections to verify, average turnaround and reviews in the last 7 days. **Only the HOD, admins and the lead see it.**

### Screens

- **Notification bell** in the header, showing the unread count, and a **Notifications** page. Opening a notification marks it as read; "Mark all as read" is also available.
- **Semester overview dashboard:**
  - **HOD and lead:**
    - key figures: projects, average progress, without a guide, overdue, blocked, waiting for review, open corrections, completed;
    - the stage funnel, with the S5 objectives gate count;
    - "needs attention": overdue and blocked tasks, and the oldest open corrections;
    - the domain × stage heat table;
    - the faculty workload table;
    - CSV reports.
  - **Faculty:** the counts in their own review queue, the oldest items waiting, and their students with stage, flags and progress.
  - **Every number links to the list behind it (UI-02).** The Projects list now takes its filters from the address (stage, flag, domain, guide, search), so a dashboard number and the list it opens always agree.
- **Student home:** progress with "How is this calculated?", latest feedback, timeliness, meeting outcomes, and the number of corrections to address and overdue tasks.
- **Projects list:** new progress and flags columns, stage and flag filters, an option to include withdrawn students, and "Clear filters".
- **Escalate to HOD** on the project page, for the lead.
- **Meetings** tab: the list of meetings, and a form to record one (attendees, plus an outcome and action items for each project).
- **Audit log** tab (HOD, admins and the lead): filter by kind of action and by project, see who did what and when, and export it.
- **CSV export (FUN-17)** of the project overview, timeliness, review queue and audit log, for the HOD, admins and the lead only. Cells that a spreadsheet would treat as formulas are neutralized.

## Test results

- **Database tests:** a new file, `007_dashboards_notifications.sql`, plus every earlier file, all passing. It covers:
  - a notification for each workflow event, the right recipients, and none for the person who acted;
  - inbox privacy, and that notifications cannot be written directly;
  - reminders added once per task, and only for tasks due within 48 hours;
  - escalation (lead only, a note required, audited);
  - meetings (students see only their own outcome, cannot record a meeting, and cannot see attendance; nothing can be edited);
  - the progress formula, including approved exceptions, partly verified stages, changed weights and the absence of any stored progress;
  - overdue counting;
  - the workload view limited to the lead and the HOD;
  - **performance with 30 projects × 16 weeks:** every dashboard view answers in under 0.2 s, against a 1 s limit (best of three runs, locally and on GitHub Actions). The timings are shown on each CI run.
- **End-to-end:** a new journey, `e2e/phase7-dashboards.spec.ts`, runs alongside the four earlier ones. All five pass in a real browser from a clean reset, in about 1.5 minutes. The new journey covers:
  - the student sees the review in the inbox and on the dashboard;
  - the guide's dashboard lists only their students;
  - the HOD's numbers open lists of exactly that size;
  - the lead escalates and the HOD is notified;
  - the CSV export opens with the right rows;
  - a meeting is recorded, and each student sees only their own outcome;
  - the audit log works.
  - Screenshots: `docs/demo/p7-*.png`.
- **App tests:** 80 passing, including new tests that check each dashboard number matches the list its link opens, and the CSV quoting. **Lint, typecheck, formatting, production build, secret scan:** pass.
- **Live database check:**
  - Row-level security is on for all 41 tables.
  - No internal function is exposed, and nothing is callable by anonymous visitors.
  - There are 65 workflow functions.

## Things to know

- **A performance fix was needed.** The first version of the overview checked access on every task and correction row and took about 3.7 s with 30 projects. It now checks access once per project (about 0.2 s). The review queue is fast once the database has statistics, which the live database keeps up to date automatically; the test gathers them first to match.
- **"Overdue" (corrected in Phase 8):** the dashboards first counted only tasks waiting for the student, while the weekly task list followed the spec (deadline passed and not verified). Since Phase 8 every screen uses the spec's rule (WORKFLOW_SPEC §1, AC6.7), and a test checks that they agree. "Overdue, not submitted" under timeliness is a separate, named figure.
- **The lead's audit log** shows entries about the semester's projects. Semester-wide entries (settings, roster, meetings) are visible to the HOD and admins. This is the access rule set in Phase 3.
- **Notifications are in-app only.** Email delivery would need the SMTP settings from the Phase 2 report.
- **Still waiting on you:**
  - Dr Vidyavathi B M's email address, to make her the HOD;
  - the Supabase dashboard settings from the Phase 2 report: turn off public sign-up, set the password rules, the redirect URLs and SMTP.

## Next: Phase 8 — Core testing, security verification, user acceptance

- Complete the permission matrix.
- An accessibility check.
- A security review: an RLS audit of every table, the Supabase security advisor and a dependency audit.
- Staging deployment.
- User acceptance testing with the HOD and faculty using fictional data.
- A backup and restore drill.
