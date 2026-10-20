# Phase 6 Report — Implementation, evaluation, writing and final sign-off (S6–S9)

Date: 2026-10-20 · Status: **built, tested and deployed to Supabase. Awaiting approval to start Phase 7.**

## What was delivered

### Database (live on Supabase, five migrations `p6a`–`p6e`)

| Stage | What the student records | What faculty and the panel decide |
|---|---|---|
| S6 Implementation | Work items: planned or added later, type, status (planned, in progress, done, blocked, dropped), commit links, notes. A dropped item needs a reason. Items can be recorded only once S5 is approved, or after the HOD's override. | S6 is approved automatically when all its weekly tasks (weeks 7–10) are verified (Phase 5). |
| S7 Evaluation | Test results marked **baseline** (the original work, from S4) or **proposed** (the student's own contribution). Each has expected and actual results, an optional metric, passed or failed, and a **required evidence link** (DATA-08). A failed test needs a corrective action. The results are submitted and reviewed as one set, which needs at least one baseline and one proposed result. | The guide accepts, or requests changes with corrections. S7 can be approved only after S6. |
| S8 Paper writing | The 10 paper sections, each a link to Google Docs or Drive, with notes. Each section has its own versions. Sections can be started early: the plan has the literature review in week 5. | Each section is approved on its own. S8 is complete when all ten are approved (and S5 is). |
| S9 Final | The final checklist: final paper, report, source repository, source ZIP (if the semester requires it), README, dataset references and permissions, presentation, demo evidence. Each item is a link; replacing one resets its verification. Submitting for sign-off needs S7 and S8 approved, every item added, and a panel. | A reviewer or a panel member verifies each item. Then the **panel signs off** (below). |

**Panels and sign-off**

- **Panels:** the HOD creates them, chooses the members (faculty of the semester; a guide may sit on their own student's panel) and assigns the projects. A project is on one panel at a time.
- **Sign-off rules (WF-05):** only members of the project's panel can sign off, and only after the student has submitted S9. An **approval** needs:
  - S7 and S8 approved;
  - every checklist item verified;
  - **no open or addressed correction anywhere in the project**;
  - a required **originality remark**.
- **Changes required:** at least one correction. S9 goes back to the student, who fixes the item, responds to the correction and resubmits.
- **Completion (WF-06):** when the number of approvals reaches the quorum, S9 is approved and the project is marked **complete**. The quorum is a semester setting; by default every member must approve.
- **Decisions:** a member's newer decision replaces their earlier one, and the audit log keeps both. Panel members can verify the corrections they raised.
- **Information for the panel:**
  - **Timeliness:** tasks due so far, tasks first submitted on time and late, average days late, tasks overdue with no submission, and review rounds per task.
  - **Uniqueness warnings:** the same paper DOI or title, the same code repository, or the same project title as another project in the semester.
- **The system never grades.** It checks the preconditions and records the panel's decisions.

### Screens

- **Project page:** all nine stage tabs are open now.
  - **S6:** a list of work items with commit links, and a link to the weekly tasks that complete the stage.
  - **S7:** separate Baseline and Proposed lists, a form to add or edit results, submitting the whole set, and the review thread.
  - **S8:** the ten sections with their status and version. Each section has a document link and notes, "Save and submit", "Start a new version", and its own review thread.
  - **S9:** the checklist (the student adds links; faculty verify, mark "not accessible" or reject), "Submit for final sign-off", and the **sign-off summary**: preconditions, timeliness, uniqueness, and each panel member's decision and remark.
  - **Sign-off form** for panel members: approve or changes required, originality remark, comments and corrections. Other faculty can comment on S9 but cannot decide it.
- **Panels** tab: the HOD creates and edits panels (name, members, projects); everyone else sees them.
- **Review queue:** now also lists S7 result sets, S8 sections and projects waiting for the panel.

## Test results

- **Database tests:** a new file, `006_final_stages.sql`, with 5 groups, all passing, plus every earlier test. It covers:
  - the S5 gate for S6 work;
  - S6 items;
  - S7 evaluation (DATA-08, and S7 needing S6), with changes requested, a correction and a resubmission;
  - S8 completion only after all ten sections;
  - the S9 checklist and panel: only the HOD forms panels, students and non-members cannot sign off, and "final" cannot be decided through ordinary reviews;
  - WF-05: an approval is refused while the checklist is unverified or a correction is still addressed;
  - WF-06: one approval out of two is not enough, "changes required" reopens S9, and the second approval completes the project;
  - the uniqueness view, SEC-08 and SEC-09.
- **End-to-end:** four journeys pass in a real browser on the local stack, about 66 seconds from a clean reset. The new one, `e2e/phase6-final-signoff.spec.ts`, is test plan journey 6:
  - baseline and proposed results are accepted, and all ten paper sections approved;
  - the HOD forms a panel of two;
  - the student completes the checklist and submits;
  - the guide verifies the checklist and approves, and the second member requires changes;
  - the student fixes it and resubmits, and the second member verifies and approves;
  - the project shows as complete.
  - Screenshots: `docs/demo/p6-*.png`.
- **App tests:** 68 passing. **Lint, typecheck, formatting, production build, secret scan:** pass.
- **Live database check:**
  - Row-level security is on for all 37 tables.
  - No internal function is exposed, and nothing is callable by anonymous visitors.
  - There are 61 workflow functions, each of which checks permissions itself.

## Things to know

- **Earlier approvals stay in place.** If one member requires changes, the other members' earlier approvals still count. With the default quorum (every member), the project cannot complete until the member who required changes approves. The HOD can set a smaller quorum in the semester settings.
- **"Similar titles"** currently means the same title after ignoring case and punctuation. A looser similarity check could be added in Phase 9.
- **No notifications yet.** Panels and students are not notified automatically; that comes in Phase 7.

## Next: Phase 7 — Dashboards, reports, notifications, meetings and audit

- HOD, lead, faculty and student dashboards, with the stage funnel, workload, overdue tasks and blocked projects.
- Progress calculated from the stage weights.
- In-app notifications written by the workflow functions.
- Review meetings.
- CSV export.
- An audit log screen.
