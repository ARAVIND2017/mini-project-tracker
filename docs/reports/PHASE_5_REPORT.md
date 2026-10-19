# Phase 5 Report — Weekly tasks, submissions, reviews and resubmissions

Date: 2026-10-19 · Status: **built, tested and deployed to Supabase. Awaiting approval to start Phase 6.**

## What was delivered

### Database (live on Supabase, five migrations `p5a`–`p5e`)

| Area | What it does |
|---|---|
| Semester plan | Every new semester starts with the **default 16-week plan**: 16 weekly milestones, including the 7 gates G1–G7, and 19 task templates, each with acceptance criteria and expected evidence. The plan comes from WEEKLY_MILESTONE_PLAN.md. The HOD can rename a week, change its stage or checkpoint, mark it as a gate, or move its start date. Tasks can be added, edited or switched off. |
| Domain-specific tasks | A task template can apply to every domain or to one domain only. A domain task can **replace** a generic one; for example, Web projects can compare features instead of baseline metrics in week 11. |
| Deadlines | Week N's work is due at the semester's submission day and time before the next lab, in the semester's time zone. With the defaults, that is **Monday 23:59 IST**. Moving a week's start date moves its deadline. |
| Task generation | Each project gets one task per template that applies to it. Tasks are created when the semester is activated, when a student is added to an active semester, and when a project changes domain. The HOD can also run it from the **Plan** tab. Refreshing the tasks updates only tasks that have no submission yet; submitted work is never changed. |
| Submissions | Each submission needs a progress report of at least 100 characters and evidence links where the task expects them. Every submission is a **new version that can never be changed**, not even with the service key (DATA-07). Whether it was **late** is recorded once, against the deadline at that moment (FUN-10). |
| Task status | Not started → in progress → submitted → under review → verified. "Changes requested" sends the task back; after corrections the student resubmits it (resubmitted). Corrections work as in Phase 4: the student cannot resubmit while a correction is open, and the reviewer cannot accept until every correction, on any version, is verified or waived. |
| Objectives gate (WF-02) | S6 work (and S7 and S9) cannot be submitted until the S5 objectives are approved, unless the HOD records an override with a reason. |
| S6 completion | S6 is approved automatically once every one of its tasks is verified. |
| Overdue and blocked (FUN-11) | **Overdue** is calculated each time it is shown (the deadline has passed and the task is not verified) and never stored. **Blocked** is a flag with a reason, set on a task or a whole project by the student or a reviewer; it does not change the status. |
| Review queue | Everything waiting for a reviewer in one place: task submissions, stage records and corrections the student has addressed. Each item shows how long it has waited and who may review it. |
| Access | Students see only their own tasks and submissions (SEC-08). The plan is visible to everyone in the semester. Only the HOD changes the plan. Direct writes to the tables are refused (SEC-09). |

### Screens

- **Project page → Weekly tasks.**
  - The 16 weeks, with milestones and gates, and each task's status, deadline, overdue and blocked badges, and open corrections. The current week is highlighted, and totals show how many tasks are verified, how many are overdue, and how many submissions were on time or late.
  - Opening a task shows its acceptance criteria as a checklist for the student's own use, and the evidence it expects.
  - **Student:** start the task and submit it (with a warning if the deadline has passed). After review, the student marks each correction as addressed and resubmits.
  - **Reviewer:** start the review, then record the outcome and corrections.
  - Every version is listed with "on time" or "late", its report and its evidence links. Students and reviewers can mark a task as blocked.
- **Review queue** tab: "Mine" or "All projects", filtered by kind of item and oldest first. Each item links to the exact task or stage.
- **Plan** tab: the weeks with their computed deadlines and their tasks. The HOD edits weeks and tasks, adds domain tasks (including ones that replace a generic task), and can create missing tasks or apply plan changes to unsubmitted tasks.
- **Student home:** the next task and its deadline, plus a "My weekly tasks" link.

## Test results

- **Database tests:** a new file, `005_weekly_tasks.sql`, with 8 groups, all passing, plus every earlier test. It covers:
  - FUN-09: the default plan, the deadlines, a moved week, generation with domain overrides, refreshing tasks, and a change of domain.
  - The weekly loop: submitted on time, two corrections, a blocked resubmission, a late resubmission, then verified. The task ends with one on-time and one late submission.
  - DATA-07, FUN-10, WF-02 (including the HOD override), automatic S6 completion, and FUN-11 (overdue and blocked).
  - The review queue, and journey 5 (cross-review: refused, then authorized, then refused again once the authorization expired).
  - SEC-08, SEC-09 and the audit log.
- **App tests:** 68 passing (7 new): the deadline calculation (the same results as the database), teaching weeks, time-zone formatting, and the review queue helpers.
- **End-to-end:** three journeys pass in a real browser on the local stack, about 50 seconds from a clean reset. The new one, `e2e/phase5-weekly-tasks.spec.ts`, covers journeys 4 and 5:
  - the student submits on time;
  - the guide opens the item from the queue and requests two changes;
  - after the deadline passes, the student fixes both and resubmits (recorded as late);
  - the guide verifies the task;
  - another faculty member can only comment until the lead authorizes them, can review while authorized, and can only comment again after the authorization expires.
  - Screenshots: `docs/demo/p5-*.png`.
- **Lint, typecheck, formatting, production build, secret scan:** pass.
- **Live database check:**
  - Row-level security is on for all 29 tables.
  - No internal function is exposed, and nothing is callable by anonymous visitors.
  - There are 53 workflow functions, each of which checks permissions itself.

## Things to know

- **Changing dates after tasks exist.** If the start date or a week is changed, use **Plan → Apply plan changes to unsubmitted tasks** to move the deadlines. Tasks that already have a submission keep their deadline, so the late flags already recorded stay correct.
- **Evidence:** a task that expects evidence needs at least one link. Which kinds of evidence are listed is guidance for the student, not a hard rule (for example, week 4 can be a documented failure).
- **The weekly reminder emails and notifications** come with Phase 7.

## Next: Phase 6 — Implementation, evaluation, writing and final stages S6–S9

Implementation items (planned and completed, with commit links), evaluation results tagged baseline or proposed with required evidence, the 10 versioned paper-draft sections, the final checklist, panels and panel sign-off with a quorum.
