# Workflow Specification

Status: Phase 0 — awaiting approval.

This document is the single source of truth for stages, statuses and transitions. The same values are used in the database enums (`supabase/migrations`) and the frontend constants (`src/domain/constants.ts`); a test keeps them in sync.

## 1. Status families (kept separate on purpose)

| Family | Values | Applies to |
|---|---|---|
| `stage_status` | not_started, in_progress, awaiting_approval, changes_requested, approved, exception_approved | Each of the nine stages of a project |
| `task_status` | not_started, in_progress, submitted, under_review, changes_requested, resubmitted, verified | Weekly tasks |
| `record_status` | draft, submitted, changes_requested, approved, superseded | Stage records that need approval (exploration, analysis, objective version, draft section) |
| `paper_status` | candidate, submitted, approved, rejected, withdrawn | Papers |
| `execution_status` | not_started, repository_identified, environment_setup, execution_successful, execution_failed, blocked_dependency_dataset, verification_pending, verified | Original-code repository (S4) |
| `review_outcome` | accepted, changes_requested, rejected, comment_only | A review |
| `correction_status` | open, addressed, verified, waived | A correction |
| `evidence_verification` | unverified, verified, rejected, inaccessible | An evidence link |
| `request_status` | pending, approved, rejected, cancelled | Assignment requests |
| `signoff_decision` | approve, changes_required | A panel member's sign-off |

**Flags (not statuses):**

- **Overdue** = `now() > due_at` and `status <> verified`. Computed in views; never stored.
- **Blocked** = `blocked = true` with `blocked_reason`, `blocked_at` and `blocked_by`. It can be set on a task or a project and does not change the status.
- **Late** = a submission's `submitted_at > task.due_at` at the moment of submission. Stored once on the submission (`is_late`), never recalculated.

## 2. Stages

| No | Key | Name | Approval record | Gate to next stage |
|---|---|---|---|---|
| 1 | `exploration` | Domain and research exploration | `research_explorations` | Approved by a reviewer |
| 2 | `paper_selection` | Research paper selection | `papers` (the selected one) | Selected paper approved |
| 3 | `paper_analysis` | Paper analysis | `paper_analyses` (latest version) | Analysis approved |
| 4 | `code_execution` | Repository and original code execution | `code_repositories` | Status `verified`, **or** stage `exception_approved` |
| 5 | `objectives` | Research gap and objective finalization | `objective_versions` | One version approved (**hard gate for S6**) |
| 6 | `implementation` | Proposed implementation | `implementation_items` + weekly tasks | All S6 tasks verified |
| 7 | `evaluation` | Testing and evaluation | `evaluation_results` | Results review accepted |
| 8 | `paper_writing` | Research paper writing | `paper_drafts` (10 sections) | All required sections approved |
| 9 | `final` | Final documentation and demonstration | `final_deliverables` + `final_signoffs` | Panel quorum approves |

Stages may overlap in time (for example, writing starts in Week 5), but a stage cannot be `approved` before the stages it depends on are approved. Dependencies: 2→1, 3→2, 4→2, 5→3 and 5→4, 6→5, 7→6, 8→5, 9→7 and 9→8.

### 2.1 Required fields per stage record

**S1 Exploration** — candidate topics (≥ 1), research keywords (≥ 3), sources searched (≥ 1: name + URL), proposed research problem (≥ 50 characters).

**S2 Paper** — title, authors (≥ 1), publication year, venue, DOI or publisher URL, PDF Drive link, abstract, research problem, relevance to the assigned domain (≥ 50 characters), code availability (`unknown | available | not_available`). If the year ≠ the semester's target year, a **foundational justification** is required. A project may have several candidate papers but only one `selected`.

**S3 Analysis** — problem addressed, research objectives, methodology, datasets, tools, algorithms/models, reported results and metrics, limitations, research gaps, own understanding (≥ 150 characters). These are structured fields, so a bare link is not accepted.

**S4 Repository** — repository URL, owner, name, commit or release reference (recommended), language, framework, dataset requirements, environment/dependencies, setup instructions. **Execution attempts** (one or more): attempted at, outcome (`success | failed | blocked`), errors encountered, debugging notes, evidence links (logs/screenshots/result files).

**S5 Objective version** — original limitations, research gap, proposed problem statement, main objective, specific objectives (≥ 2), proposed contribution, scope, exclusions, evaluation criteria (from the domain's criteria plus custom ones).

**S6 Implementation item** — title, type (`feature | dataset | model_change | frontend | backend | integration | bug`), planned/completed, status, commit links, notes, evidence.

**S7 Evaluation result** — kind (`baseline | proposed`), test case, expected result, actual result, metric name and value (optional), passed, evidence link (**required**), corrective action if failed.

**S8 Draft section** — section (title & abstract, introduction, literature review, problem & objectives, methodology, proposed approach, implementation, results & discussion, conclusion & future work, references), version, document link, notes.

**S9 Final deliverables** — final paper, project report, source repository, source ZIP (if required by the semester settings), README with setup instructions, dataset references and usage permissions, presentation, demo evidence. Each item has an evidence link and a verification status.

## 3. State transitions

### 3.1 Stage record (`record_status`) — exploration, analysis, objective version, draft section

```
draft ──submit (student)──▶ submitted ──review: accepted──▶ approved
  ▲                            │
  │                            ├─review: changes_requested─▶ changes_requested ──edit+submit──▶ submitted
  │                            └─review: rejected──────────▶ changes_requested (with reason)
approved ──new version (student)──▶ new row in draft; old row ▶ superseded (only when it is replaced)
```

### 3.2 Paper (`paper_status`)

```
candidate ──select+submit──▶ submitted ──accepted──▶ approved
                                 ├──changes_requested──▶ candidate (stays selected, editable)
                                 └──rejected──▶ rejected (deselected; student selects another)
approved ──withdraw (reviewer or HOD, until end of Week 4 by default)──▶ withdrawn
```

The duplicate check runs on approval: if another project in the same semester has an approved paper with the same DOI or normalized title, approval fails with `DUPLICATE_PAPER` unless the HOD gives an override with a reason.

### 3.3 Repository execution (`execution_status`)

```
not_started → repository_identified → environment_setup → execution_successful ─┐
                                        │        ▲                              │
                                        ▼        │                              ▼
                                 execution_failed┘                  verification_pending (student submits)
                                        │                                       │
                                        ▼                                       ├─accepted▶ verified (reviewer only)
                          blocked_dependency_dataset                            └─changes_requested▶ environment_setup
```

The student moves the status between the first six states by recording execution attempts. `verification_pending` requires at least one successful attempt that has evidence. Only a reviewer can set `verified`. If the paper has no public code or the code is permanently blocked, the guide, the lead or the HOD may set S4 to `exception_approved` with a reason. The student then reimplements the method from the paper, and that work is tracked as S6 items.

### 3.4 Task (`task_status`)

```
not_started ─(student edits/adds evidence)─▶ in_progress ─submit─▶ submitted
submitted ─(reviewer opens)─▶ under_review
submitted|under_review ─accepted─▶ verified
submitted|under_review ─changes_requested─▶ changes_requested ─resubmit─▶ resubmitted ─▶ under_review ...
```

`comment_only` reviews never change a status. `rejected` on a task behaves like `changes_requested` but is recorded as rejected.

### 3.5 Correction (`correction_status`)

`open → addressed` (student, with a response and optional evidence) `→ verified` (reviewer). The reviewer may send it back from `addressed → open` with a note, or set `open|addressed → waived` with a reason.

### 3.6 Stage status — derived and stored by the workflow functions

- `not_started` → `in_progress`: the first content row or task activity in the stage.
- → `awaiting_approval`: the stage's approval record is submitted.
- → `changes_requested`: the review requested changes.
- → `approved`: the gate condition in §2 is met.
- → `exception_approved`: an authorized exception was recorded (S4 only in v1).

## 4. Weekly review workflow

1. Tasks for week N become visible to the student at the start of week N (in fact, all tasks are visible; the current week is highlighted).
2. The student works and adds evidence links. The task moves to `in_progress` on the first activity.
3. The student submits a progress report (required, ≥ 100 characters) and evidence links → a new `submissions` row (version n) is created, and `is_late` is recorded.
4. The submission appears in the review queue of every reviewer of the project. The guide is the primary owner.
5. A reviewer opens it (`under_review`) and records the outcome, observations and corrections.
6. With `changes_requested`, the student revises the work, marks corrections as addressed and resubmits (version n+1).
7. The reviewer verifies the corrections and accepts the submission → task `verified`.
8. All versions, reviews and corrections are kept permanently.
9. The lead and the HOD see queue ageing (time from submission to review) and unresolved corrections.

**Default timing** (all configurable per semester):

- Weeks start on the lab day (Tuesday).
- Work for week N is due on **Monday 23:59** before the next lab.
- It is reviewed at the next **Tuesday 14:00–16:40** lab.
- Faculty record outcomes by **Thursday 23:59**.
- Corrections are due with the next submission.

## 5. Progress calculation

```
progress(project) = Σ over stages s of  weight(s) × completion(s)

completion(s) = 1                                   if stage s is approved or exception_approved
              = verified_tasks(s) / total_tasks(s)  otherwise (0 if the stage has no tasks)
```

Default weights: S1 5, S2 10, S3 10, S4 15, S5 10, S6 20, S7 10, S8 10, S9 10 (total 100). Weights are a semester setting and must total 100. Progress is shown as a number with a breakdown; it is never entered by hand.

## 6. Evaluation support (uniqueness and timeliness — D12)

The system **supports** the panel's judgement; it does not grade.

**Uniqueness:**
- duplicate approved paper (DOI or normalized title) — blocked unless the HOD overrides;
- duplicate repository URL across projects — warning;
- similar project titles — warning;
- each sign-off includes a required *originality remark*.

**Timeliness**, per project:
- tasks due;
- submitted on time;
- submitted late;
- average days late;
- tasks overdue without a submission;
- review cycles per task.

Both sets of figures are shown on the panel's sign-off screen and in reports.

## 7. Final sign-off

1. The student completes the final checklist and submits S9.
2. Preconditions (checked on the server): S7 and S8 approved, all checklist items verified, **zero open or addressed corrections**.
3. Each panel member records a decision (`approve | changes_required`), an originality remark and comments.
4. When the number of `approve` decisions reaches the quorum (default: all panel members), S9 becomes `approved` and the project becomes `completed`.
5. A `changes_required` decision creates corrections and returns S9 to `changes_requested`.
