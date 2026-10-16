# Weekly Milestone Plan (default 16-week template)

Status: Phase 0 — awaiting approval.

This is the **default template**. The HOD can change the weeks, tasks, acceptance criteria and deadlines in Semester setup, and can add domain-specific tasks that replace generic ones. Dates are not fixed here: they are computed from the semester start date (the first lab day).

**Weekly rhythm (defaults):**
- Week N starts at lab session N (Tuesday 14:00–16:40).
- Submission for week N is due on **Monday 23:59** before lab N+1.
- Review takes place at lab N+1.
- Faculty outcomes are due by **Thursday 23:59**.

**Gates:**
- **G1** — paper approved (end of Week 2).
- **G2** — execution verified or exception approved (Week 4). Week 4 is also the last week to change paper.
- **G3** — objectives approved (Week 6). Hard gate for S6 tasks.
- **G4** — mid-semester review (Week 8).
- **G5** — results review (Week 12).
- **G6** — all draft sections approved (Week 14).
- **G7** — panel sign-off (Week 16).

| Week | Stage | Task (default template) | Acceptance criteria | Required evidence | Checkpoint |
|---|---|---|---|---|---|
| 1 | S1 | Explore the assigned domain | ≥ 3 candidate topics; ≥ 5 keywords; ≥ 3 sources searched (with links); proposed problem drafted | other (search notes link) | Guide feedback at lab |
| 2 | S1→S2 | Select a research paper | Exploration submitted; paper record complete; **code availability checked**; relevance note; PDF in Drive; foundational justification if not a 2026 paper | research_paper_pdf | **G1 paper approved** |
| 3 | S3 | Analyse the paper | Analysis template complete (all fields); own understanding ≥ 150 characters; limitations listed | paper_analysis | Analysis review |
| 3 | S4 | Identify the repository and set up the environment | Repository record complete (URL, commit, language, dependencies, dataset needs); first execution attempt logged | github_repository | — |
| 4 | S4 | Run the original code | ≥ 1 successful attempt with logs/screenshots and result files, **or** documented failure/blocker with errors and debugging notes | execution_log, execution_screenshot, result_file | **G2 execution verified / exception**; paper-change cutoff |
| 5 | S5 | Identify the research gap | Limitations mapped to a gap; draft problem statement | objective_document | Review |
| 5 | S8 (early) | Draft the literature review | Literature review section v1 with ≥ 8 references (real, verifiable) | paper_draft | Comment-only review |
| 6 | S5 | Finalize objectives | Objective version: main + ≥ 2 specific objectives, contribution, scope, exclusions, evaluation criteria | objective_document | **G3 objectives approved** |
| 7 | S6 | Implementation plan and dataset preparation | Planned features list; dataset prepared and referenced; repository/branch for own work | implementation_evidence | Weekly review |
| 8 | S6 | Core modification — part 1 | Planned items in progress with commit links; working build | implementation_evidence | **G4 mid-semester review** |
| 9 | S6 | Core modification — part 2 | Main contribution implemented end to end (first working version) | implementation_evidence | Weekly review |
| 10 | S6 | Integration and debugging | All planned items done or explicitly dropped with a reason; known bugs listed | implementation_evidence | Weekly review |
| 10 | S8 (early) | Draft the methodology and proposed approach | Methodology + proposed approach sections v1 | paper_draft | Comment-only review |
| 11 | S7 | Testing | Test cases with expected/actual results; baseline results from S4 recorded as `baseline` | test_results | Weekly review |
| 12 | S7 | Evaluation and comparison | Proposed results recorded as `proposed`, with evidence; comparison table/chart; failed tests with corrective actions | test_results | **G5 results review** |
| 13 | S8 | Write the paper — part 1 | Title/abstract, introduction, problem & objectives, implementation sections submitted | paper_draft | Section reviews |
| 14 | S8 | Write the paper — part 2 and revisions | Results & discussion, conclusion & future work, references; all earlier corrections addressed | paper_draft | **G6 drafts approved** |
| 15 | S9 | Final integration and presentation | Report, README with setup steps, presentation, dataset references and permissions; all open corrections closed | final_report, presentation | Pre-final review |
| 16 | S9 | Final demonstration and sign-off | Demo evidence, final paper, source repository, source ZIP (if required), checklist verified | demo_evidence, final_zip | **G7 panel sign-off** |

## Notes on the template

- **Progressive writing.** The literature review starts in Week 5 and methodology in Week 10, so Weeks 13–14 are for finishing and revising rather than writing from scratch.
- **Stage 4 risk.** If the original code needs hardware or data the student cannot get, the guide can approve an S4 exception. The student then reimplements the method from the paper, and that work becomes part of S6. Exceptions are visible on every dashboard.
- **2026 target papers.** The target year is a setting (`target_paper_year`). Older papers are allowed with a justification and are labelled "Foundational".
- **Domain overrides.** For example, a web/system-building domain can replace the "baseline metrics" task in Week 11 with "baseline feature/performance comparison". Evaluation criteria come from the domain configuration.
- **No fabricated content.** Templates ask for links and evidence; the system never generates papers, citations or results.
