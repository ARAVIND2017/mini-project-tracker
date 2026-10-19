# Phase 4 Report — Research stages S1–S5

Date: 2026-10-19 · Status: **built, tested and deployed to Supabase. Awaiting approval to start Phase 5.**

## What was delivered

### Database (live on Supabase, six migrations `p4a`–`p4f`)

| Stage | What the student records | What the reviewer decides |
|---|---|---|
| S1 Exploration | Candidate topics, at least 3 keywords, sources searched (name + https link), proposed research problem (at least 50 characters) | Accept, request changes (with corrections) or reject |
| S2 Paper selection | Up to 10 candidate papers: title, authors, year, venue, DOI or publisher link, PDF Drive link, abstract, research problem, relevance (at least 50 characters), code availability. A paper outside the semester's target year needs a **foundational justification**. One paper is selected and submitted | Approve or reject. The **duplicate check** blocks a paper (same DOI or same title, ignoring case and punctuation) already approved for another project in the semester, unless the **HOD overrides with a reason** |
| S3 Paper analysis | Ten structured fields for the selected paper, including own understanding (at least 150 characters). **Versioned** | Approve; an approved version stays in force while a newer one is reviewed |
| S4 Original code | Repository details and **execution attempts** (success, failed or blocked; errors and debugging notes; evidence links). Each attempt moves the execution status | **Verified** only by a reviewer, and only after a successful attempt with evidence. The guide, lead or HOD can approve an **exception** (no usable public code) with a reason |
| S5 Objectives | Limitations, research gap, problem statement, main objective, at least 2 specific objectives, contribution, scope, exclusions, evaluation criteria (with the domain's criteria offered). **Versioned** | Approve. Approval is the gate for S6, and it locks the working title |

**Rules that apply to every stage:**

- **Locking.** A record can only be edited while it is a draft or has changes requested. A submitted or approved record is locked, and a change means a new version (WF-07).
- **Stage order.** A stage can only be approved after the stages it depends on are approved: 2 after 1, 3 and 4 after 2, 5 after 3 and 4.
- **Corrections.**
  - "Changes requested" needs at least one correction (WF-03).
  - The student responds to each correction (open → addressed).
  - The reviewer then verifies it, reopens it with a note, or waives it with a note (WF-04).
  - The student cannot resubmit while a correction is still open.
  - The reviewer cannot accept while a correction is open or addressed.
- **Who may decide (SEC-07).** Only a reviewer of the project can accept, request changes or reject: the HOD, the lead, the guide, a co-reviewer, or faculty with an active review authorization. Any other faculty member may only add a comment, which changes nothing.
- **Changing an approved paper (WF-08).** A reviewer can withdraw an approved paper until the end of the cutoff week (week 4 by default); after that, only the HOD can. The analysis, repository and objectives built on that paper are reopened, and their records are kept as history.
- **Evidence.** All links must start with `https://`, so `javascript:`, `data:` and `http:` links are refused (SEC-12). A reviewer marks each link verified, rejected or not accessible; the last two need a note.
- **History.** Reviews and execution attempts can never be changed, not even with the service key. Papers are withdrawn and versions superseded, never deleted. Every action is in the audit log under its own name (for example `review.recorded` or `override.duplicate_paper`), in addition to the row-level entries.
- **Access.** Students see only their own project's records, reviews and corrections (SEC-08). Every change goes through the workflow functions; direct writes to the tables are refused (SEC-09).
- **The app never grades.** Faculty record their decisions; the system only enforces the rules.

### Screens

- **Project page** (`/projects/:id`): one page per project, opened from the project list (faculty) or from **My project → Open my research stages** (student).
- **Stage overview:** all nine stages with their status. S1–S5 are open; S6–S9 are shown, and their screens come in Phases 5–6.
- **Each S1–S5 tab** has:
  - the student's form, with "Save draft" and "Save and submit for review";
  - the review thread with every review and correction, and the actions for each;
  - the review form for faculty;
  - the stage's evidence links.
- **S2** also has the candidate paper cards, with select, submit and withdraw, and the HOD override for duplicate papers.
- **S4** also has the execution attempt form and history, and the exception approval.
- **Project list:** a "waiting for review" count, and each student's name opens their project page.

## Test results

- **Database tests:** a new file, `004_research_stages.sql`, with 9 groups, all passing, plus every Phase 1–3 test. It covers WF-01, WF-03, WF-04, WF-07, WF-08, DATA-06, SEC-07, SEC-08 (all nine new tables), SEC-09, SEC-12, the stage gates, versions, the exception, withdrawal after the cutoff, and the audit.
- **App tests:** 61 passing (14 new). They cover who may review, edit or approve exceptions; versions and stage helpers; and the review form, which offers only "comment" to unassigned faculty and sends corrections with "changes requested".
- **End-to-end:** test plan journey 3 runs in a real browser against the local stack (`e2e/phase4-research-stages.spec.ts`). The student and the guide go through S1 to S5 with corrections in S1, S3 and S5, an S4 failed attempt followed by a successful one, and an unassigned faculty member who can only comment. The Phase 1–3 journey still passes. Both run in about 32 seconds from a clean reset. Screenshots are in `docs/demo/p4-*.png` (fictional data).
- **Lint, typecheck, formatting, production build, secret scan:** pass.
- **Live database check:**
  - Row-level security is on for all 24 tables.
  - No internal function is exposed, and nothing is callable by anonymous visitors.
  - The only advisor warning is the expected one for the 46 workflow functions, each of which checks permissions itself.

## Differences from the Phase 0 documents

1. **No direct table writes.** The API spec allowed students to write content tables through PostgREST. Every change now goes through a workflow function instead, which is simpler to secure and test. API_SPEC §4.3 and §6 are updated.
2. **Accepting needs corrections resolved first.** This was not in the original spec; it means nothing is approved with open feedback.
3. **"Changes requested" keeps the same version.** The student edits the same version and resubmits (WORKFLOW_SPEC §3.1); a new version is only created after an approval. Journey 3 therefore runs as "v1 changes requested → resubmitted → approved", followed by an extra version 2 in the database tests.
4. **Evidence links are added, not edited.** A wrong link is marked by the reviewer and the student adds a new one. This keeps the history honest.
5. **Notifications** are not sent yet. The notifications table and inbox arrive in Phase 7, and the workflow functions will start writing to it then.

## Next: Phase 5 — Weekly tasks, submissions, reviews and resubmissions

Milestones and task templates (the default 16-week plan), task generation with domain overrides, weekly submissions with the late flag, the review queue, resubmissions, the "blocked" flag, and the S6 gate on objectives (with the HOD override already stored).
