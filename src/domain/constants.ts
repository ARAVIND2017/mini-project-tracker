/**
 * Canonical workflow values. These must match the Postgres enum types in
 * supabase/migrations (checked by constants.sync.test.ts) and WORKFLOW_SPEC.md §1.
 */
export const ENUMS = {
  system_role: ['hod', 'admin'],
  semester_role: ['lead_faculty', 'faculty', 'student'],
  semester_status: ['draft', 'active', 'closed'],
  roster_status: ['empty', 'pending_invite', 'active', 'withdrawn'],
  stage_key: [
    'exploration',
    'paper_selection',
    'paper_analysis',
    'code_execution',
    'objectives',
    'implementation',
    'evaluation',
    'paper_writing',
    'final',
  ],
  stage_status: [
    'not_started',
    'in_progress',
    'awaiting_approval',
    'changes_requested',
    'approved',
    'exception_approved',
  ],
  task_status: [
    'not_started',
    'in_progress',
    'submitted',
    'under_review',
    'changes_requested',
    'resubmitted',
    'verified',
  ],
  record_status: ['draft', 'submitted', 'changes_requested', 'approved', 'superseded'],
  paper_status: ['candidate', 'submitted', 'approved', 'rejected', 'withdrawn'],
  code_availability: ['unknown', 'available', 'not_available'],
  execution_status: [
    'not_started',
    'repository_identified',
    'environment_setup',
    'execution_successful',
    'execution_failed',
    'blocked_dependency_dataset',
    'verification_pending',
    'verified',
  ],
  attempt_outcome: ['success', 'failed', 'blocked'],
  review_target: [
    'exploration',
    'paper',
    'paper_analysis',
    'repository',
    'objective',
    'task_submission',
    'draft_section',
    'evaluation',
    'final',
  ],
  review_outcome: ['accepted', 'changes_requested', 'rejected', 'comment_only'],
  correction_status: ['open', 'addressed', 'verified', 'waived'],
  evidence_category: [
    'research_paper_pdf',
    'paper_analysis',
    'github_repository',
    'execution_screenshot',
    'execution_log',
    'result_file',
    'objective_document',
    'implementation_evidence',
    'test_results',
    'paper_draft',
    'final_report',
    'presentation',
    'final_zip',
    'demo_evidence',
    'other',
  ],
  evidence_verification: ['unverified', 'verified', 'rejected', 'inaccessible'],
  implementation_type: [
    'feature',
    'dataset',
    'model_change',
    'frontend',
    'backend',
    'integration',
    'bug',
  ],
  item_status: ['planned', 'in_progress', 'done', 'blocked', 'dropped'],
  evaluation_kind: ['baseline', 'proposed'],
  draft_section: [
    'title_abstract',
    'introduction',
    'literature_review',
    'problem_objectives',
    'methodology',
    'proposed_approach',
    'implementation',
    'results_discussion',
    'conclusion_future_work',
    'references',
  ],
  deliverable_item: [
    'final_paper',
    'project_report',
    'source_repository',
    'source_zip',
    'readme',
    'dataset_references',
    'presentation',
    'demo_evidence',
  ],
  assignment_type: ['guide', 'co_reviewer'],
  request_status: ['pending', 'approved', 'rejected', 'cancelled'],
  signoff_decision: ['approve', 'changes_required'],
} as const;

export type EnumName = keyof typeof ENUMS;
export type EnumValue<N extends EnumName> = (typeof ENUMS)[N][number];

export type StageKey = EnumValue<'stage_key'>;
export type StageStatus = EnumValue<'stage_status'>;
export type TaskStatus = EnumValue<'task_status'>;
export type RecordStatus = EnumValue<'record_status'>;
export type ExecutionStatus = EnumValue<'execution_status'>;
export type ReviewOutcome = EnumValue<'review_outcome'>;
export type CorrectionStatus = EnumValue<'correction_status'>;

export interface StageDefinition {
  key: StageKey;
  no: number;
  name: string;
  /** Stages that must be approved before this one can be approved (WORKFLOW_SPEC §2). */
  dependsOn: readonly StageKey[];
}

export const STAGES: readonly StageDefinition[] = [
  { key: 'exploration', no: 1, name: 'Domain and research exploration', dependsOn: [] },
  { key: 'paper_selection', no: 2, name: 'Research paper selection', dependsOn: ['exploration'] },
  { key: 'paper_analysis', no: 3, name: 'Paper analysis', dependsOn: ['paper_selection'] },
  {
    key: 'code_execution',
    no: 4,
    name: 'Original code execution',
    dependsOn: ['paper_selection'],
  },
  {
    key: 'objectives',
    no: 5,
    name: 'Research gap and objectives',
    dependsOn: ['paper_analysis', 'code_execution'],
  },
  { key: 'implementation', no: 6, name: 'Proposed implementation', dependsOn: ['objectives'] },
  { key: 'evaluation', no: 7, name: 'Testing and evaluation', dependsOn: ['implementation'] },
  { key: 'paper_writing', no: 8, name: 'Research paper writing', dependsOn: ['objectives'] },
  {
    key: 'final',
    no: 9,
    name: 'Final documentation and demonstration',
    dependsOn: ['evaluation', 'paper_writing'],
  },
];

/** Default stage weights (WORKFLOW_SPEC §5). A semester setting; must total 100. */
export const DEFAULT_STAGE_WEIGHTS: Readonly<Record<StageKey, number>> = {
  exploration: 5,
  paper_selection: 10,
  paper_analysis: 10,
  code_execution: 15,
  objectives: 10,
  implementation: 20,
  evaluation: 10,
  paper_writing: 10,
  final: 10,
};

/** Semester defaults (DATABASE_SPEC §2 `semesters`). Every value is editable by the HOD. */
export const SEMESTER_DEFAULTS = {
  weekCount: 16,
  timezone: 'Asia/Kolkata',
  labWeekday: 2, // ISO weekday: Tuesday
  labStart: '14:00',
  labEnd: '16:40',
  submissionWeekday: 1, // Monday
  submissionTime: '23:59',
  reviewWeekday: 4, // Thursday
  reviewTime: '23:59',
  targetPaperYear: 2026,
  maxStudents: 30,
  paperChangeCutoffWeek: 4,
} as const;
