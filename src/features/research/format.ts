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
