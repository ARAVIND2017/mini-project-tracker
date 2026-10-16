# Test Plan

Status: Phase 0 — awaiting approval.

## 1. Levels and tools

| Level | Tool | Runs | What it covers |
|---|---|---|---|
| Unit (frontend/domain) | Vitest | every commit (CI) | Pure functions: progress calculation, deadline computation, status labels, Zod schemas, enum sync |
| Database & RLS | SQL test scripts (`supabase/tests/*.sql`) run by `scripts/db-test.sh` on a throwaway Postgres with a Supabase auth shim; later also `supabase test db` (pgTAP) on the local Supabase stack | every commit (CI) | Constraints, triggers, RLS policies, workflow RPCs, audit |
| Component | Vitest + Testing Library | every commit | Forms, StatusChip, StageStepper, ReviewPanel |
| End-to-end | Playwright against a local Supabase stack with seeded fictional test users | before each phase sign-off | Full user journeys per role |
| Acceptance (UAT) | Checklist run by the HOD and faculty on staging | Phase 8 | PRD acceptance criteria |

Test data uses clearly fictional people (for example "Test Student 01", `student01@example.test`). Real roster data is never used in automated tests.

## 2. Authorization matrix tests (generated)

For every RPC and every table policy, the test runs each combination of:

- **Caller:** anon, student (own project), student (other project), faculty (unassigned), faculty (guide), faculty (co-reviewer), faculty (with an active authorization), faculty (expired authorization), lead, HOD, admin (with/without each permission), deactivated user.
- **Operation:** select, insert, update, delete, rpc.

The expected result for each cell comes from USER_ROLES_AND_PERMISSIONS.md §2. The matrix is kept as data (`supabase/tests/permission_matrix.json`), and a generator turns it into SQL tests, so the documentation and the tests cannot drift apart silently.

## 3. Test catalogue (IDs referenced by PRD.md)

### Security

| ID | Test |
|---|---|
| SEC-01 | Only the HOD or an admin with `manage_config` can create a semester; others get `FORBIDDEN` |
| SEC-02 | Only the HOD can change roles, the lead or `reports_to`; the lead and faculty get `FORBIDDEN` |
| SEC-03 | Password reset: the response is the same for unknown emails; tokens are single-use (Supabase); the redirect URL is on the allowlist |
| SEC-04 | A deactivated user's JWT can no longer read or write (the helper functions check `is_active`) |
| SEC-05 | A guide request has no effect until the HOD approves; the requester cannot approve their own request |
| SEC-06 | Only the lead or HOD can grant a review authorization; it stops working after `valid_until` and after revocation |
| SEC-07 | An unassigned faculty member can comment but cannot record accepted/changes_requested/rejected |
| SEC-08 | Student A cannot select, insert or update any row of student B's project (all tables); the select returns 0 rows |
| SEC-09 | A student cannot change protected columns (`status`, `guide_id`, `is_late`, `verification`, …) through PostgREST |
| SEC-10 | `anon` has no access to any table or RPC except the auth endpoints |
| SEC-11 | The service-role key is absent from the frontend bundle (a build-output scan in CI) |
| SEC-12 | URL fields reject `javascript:`, `data:` and `http:` |
| SEC-13 | Error messages contain no SQL or stack traces |
| SEC-14 | The Edge Function rejects callers who are not HOD/admin, and requests without a JWT |

### Data integrity

| ID | Test |
|---|---|
| DATA-01 | A second active lead in a semester is rejected |
| DATA-02 | A roster import stores exactly the values given; no values are generated |
| DATA-03 | Blank rows become `empty` slots and do not count as projects |
| DATA-04 | An import above `max_students` fails with `CAPACITY_EXCEEDED` and changes nothing (atomic) |
| DATA-05 | One project per filled roster entry; a second project is rejected |
| DATA-06 | A duplicate approved DOI or normalized title in the same semester is rejected; it succeeds with an HOD override and the reason is logged |
| DATA-07 | Submissions cannot be updated or deleted; a new submission gets version n+1 |
| DATA-08 | An evaluation result without evidence is rejected; baseline and proposed results stay separate |
| DATA-09 | Progress equals the formula for the seeded scenarios; there is no column that lets anyone set progress |
| DATA-10 | Stage weights that do not total 100 are rejected |

### Workflow

| ID | Test |
|---|---|
| WF-01 | Execution `verified` is impossible without a successful attempt with evidence, and is only possible for a reviewer |
| WF-02 | An S6 task submission is rejected with `GATE_NOT_MET` before objectives are approved; it succeeds after approval or an HOD override |
| WF-03 | `changes_requested` without a correction is rejected |
| WF-04 | Correction transitions: valid paths succeed, invalid ones fail with `INVALID_STATE` |
| WF-05 | Sign-off is rejected while corrections are open or addressed, or the checklist is incomplete |
| WF-06 | The project completes only when the quorum is reached; a `changes_required` decision reopens S9 |
| WF-07 | Locked records cannot be edited after submission; a new version can be created |
| WF-08 | Paper change after the cutoff week is rejected, except by the HOD |

### Functional

| ID | Test |
|---|---|
| FUN-01..18 | One test per PRD acceptance criterion (settings saved, week dates derived, invite flow, task generation with domain override, late flag, overdue computation, notifications created, CSV export columns, …) |

### Audit

| ID | Test |
|---|---|
| AUD-01 | Each insert/update/delete on business tables creates an audit row with the actor and before/after data |
| AUD-02 | `authenticated` cannot update or delete `audit_log` (permission denied) |

### UI

| ID | Test |
|---|---|
| UI-01 | The project list shows the guide name or "Unassigned" |
| UI-02 | Each dashboard tile's count equals the number of rows in its drill-down list |

## 4. End-to-end journeys (Playwright)

1. **HOD setup:** create a semester → domains → invite the lead and faculty → import a roster with 2 blank slots → generate tasks → activate.
2. **Guide selection:** a faculty member sets expertise → requests to guide → the HOD approves → the guide appears in the project list.
3. **Student S1→S5:** exploration → paper (approved) → analysis (changes requested → resubmitted → approved) → repository with a failed and then a successful attempt → verified → objectives v1 changes requested → v2 approved.
4. **Weekly loop:** submit (on time) → review with 2 corrections → address → resubmit (late) → verify → task verified; timeliness shows 1 on time and 1 late.
5. **Cross-review:** an unassigned faculty member is refused → the lead grants an authorization → the review succeeds → the authorization expires → refused again.
6. **Final:** S7/S8 approved → checklist → panel of 2 → one approves, one requires changes → corrections fixed → both approve → completed.
7. **Isolation:** student A tries to open student B's project URL → sees "Not found".

## 5. Non-functional checks

- **Performance:** dashboard queries take < 1 s with a seeded semester of 30 projects × 16 weeks of data (`EXPLAIN ANALYZE` in the DB tests).
- **Accessibility:** axe-core run in Playwright on every main screen; keyboard-only run through journeys 3 and 4.
- **Backup/restore drill** (Phase 8): restore a backup into a scratch project and check that the row counts match.

## 6. Exit criteria per phase

- All tests for the phase pass in CI.
- No skipped tests without a written reason.
- Matrix tests cover every new table and RPC.
- The phase report lists any open defects with their severity.
