# AI Feature Specification (future phase 9b)

Status: Phase 0 — for information. **Nothing in this document is built before the core system passes Phase 8 and the HOD approves Phase 9b.**

## 1. Principles

1. The core tracker never depends on AI. Every AI feature can be switched off (feature flag per semester) without losing any function.
2. AI **drafts and highlights**; people **decide**. AI never grades, approves, verifies, marks complete, or changes any status.
3. Every AI output shows its sources: links to the exact records (submission, review, evidence) it was based on.
4. AI must not invent citations, results or claims. Outputs that mention a paper, metric or result must quote a stored record; otherwise they say "not recorded".
5. AI output is labelled as AI-generated and stored separately from human records.

## 2. Candidate use cases

| # | Feature | Input (only these records) | Output | Who sees it | Human action required |
|---|---|---|---|---|---|
| AI-1 | Weekly update summary | One project's submissions and reviews for a week | 3–5 bullet summary with record links | Guide, lead, HOD | None (read-only aid) |
| AI-2 | Progress report draft | Project overview, stage statuses, timeliness, open corrections | Editable draft report | Lead, HOD | A person edits and saves it as their own report |
| AI-3 | Missing-evidence check | Task acceptance criteria + attached evidence metadata (not file contents) | List of criteria with no matching evidence | Student, guide | Student adds evidence; the guide decides |
| AI-4 | Repeated-blocker detection | Blocked reasons, execution errors, correction texts across a semester | Clusters such as "5 projects blocked on CUDA version" | Lead, HOD | Lead decides on corrective action |
| AI-5 | Paper-analysis helper | The student's own analysis fields + the paper's abstract as entered | Questions the student has not answered yet (e.g. "dataset size not stated") | Student | Student writes the answers; AI never fills the fields |
| AI-6 | Review summary | All reviews and corrections of one project | Structured summary for the panel | Panel | None |

## 3. Explicitly not allowed

- Assigning marks or ranking students.
- Approving papers, objectives, drafts, or verifying execution or evidence.
- Writing paper sections or analysis content on behalf of a student.
- Generating references, DOIs or results.
- Reading Drive file contents (out of scope; links only).

## 4. Architecture

- One Supabase Edge Function `ai-assist` calls the Anthropic Claude API. The model is chosen in Phase 9b (current candidates: `claude-sonnet-5-5` for summaries, `claude-opus-5-5` for complex analysis); the API key is stored in Edge Function secrets.
- The function:
  1. checks the caller's permission with the same helpers as the RPCs;
  2. builds the input **only** from records the caller may see;
  3. sends minimal fields (no emails or institution IDs);
  4. asks for structured output (JSON with `claims[]`, each with `source_record_ids[]`);
  5. rejects any claim without a valid source ID;
  6. stores the output in `ai_outputs` (feature, input record IDs, model, prompt version, output, created_by, created_at).
- Rate limit per user per day; monthly budget cap per semester.

## 5. Privacy

- Data sent: record text fields needed for the feature, with pseudonymous project IDs instead of names.
- The provider's commercial terms must not allow training on the data; this is to be confirmed before enabling.
- The HOD can view every AI request in `ai_outputs` and in the audit log.

## 6. Validation before enabling

- An evaluation set of ≥ 30 fictional project histories with expected outputs per feature.
- Acceptance criteria:
  - 0 fabricated sources;
  - ≥ 90 % of claims judged correct by two faculty reviewers;
  - no output that implies an approval or a grade.
- A re-run of the evaluation is required whenever the model or the prompt version changes.

## 7. Open questions

- Which features the faculty actually want first (proposed order: AI-1, AI-3, AI-4).
- Budget for API usage.
- Whether students should have access to AI-3/AI-5, or faculty only.
