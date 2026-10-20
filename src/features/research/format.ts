import type { Enums } from '@/lib/database.types';

export const formatWhen = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

export const EVIDENCE_LABELS: Record<Enums<'evidence_category'>, string> = {
  research_paper_pdf: 'Research paper PDF',
  paper_analysis: 'Paper analysis',
  github_repository: 'Code repository',
  execution_screenshot: 'Execution screenshot',
  execution_log: 'Execution log',
  result_file: 'Result file',
  objective_document: 'Objective document',
  implementation_evidence: 'Implementation evidence',
  test_results: 'Test results',
  paper_draft: 'Paper draft',
  final_report: 'Final report',
  presentation: 'Presentation',
  final_zip: 'Final ZIP',
  demo_evidence: 'Demo evidence',
  other: 'Other',
};

export const DRAFT_SECTION_LABELS: Record<Enums<'draft_section'>, string> = {
  title_abstract: 'Title and abstract',
  introduction: 'Introduction',
  literature_review: 'Literature review',
  problem_objectives: 'Problem and objectives',
  methodology: 'Methodology',
  proposed_approach: 'Proposed approach',
  implementation: 'Implementation',
  results_discussion: 'Results and discussion',
  conclusion_future_work: 'Conclusion and future work',
  references: 'References',
};

export const DELIVERABLE_LABELS: Record<Enums<'deliverable_item'>, string> = {
  final_paper: 'Final paper',
  project_report: 'Project report',
  source_repository: 'Source code repository',
  source_zip: 'Source code ZIP',
  readme: 'README with setup instructions',
  dataset_references: 'Dataset references and usage permissions',
  presentation: 'Presentation',
  demo_evidence: 'Demo evidence (video or screenshots)',
};

export const IMPLEMENTATION_TYPE_LABELS: Record<Enums<'implementation_type'>, string> = {
  feature: 'Feature',
  dataset: 'Dataset',
  model_change: 'Model change',
  frontend: 'Frontend',
  backend: 'Backend',
  integration: 'Integration',
  bug: 'Bug fix',
};

export const ITEM_STATUS_LABELS: Record<Enums<'item_status'>, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
  dropped: 'Dropped',
};
