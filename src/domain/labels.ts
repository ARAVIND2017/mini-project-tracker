import type { EnumValue } from './constants';

export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export interface StatusLabel {
  label: string;
  tone: Tone;
}

/** Status families that are shown as chips. Keys are Postgres enum names. */
export const STATUS_LABELS = {
  stage_status: {
    not_started: { label: 'Not started', tone: 'neutral' },
    in_progress: { label: 'In progress', tone: 'info' },
    awaiting_approval: { label: 'Awaiting approval', tone: 'warning' },
    changes_requested: { label: 'Changes requested', tone: 'warning' },
    approved: { label: 'Approved', tone: 'success' },
    exception_approved: { label: 'Exception approved', tone: 'success' },
  },
  task_status: {
    not_started: { label: 'Not started', tone: 'neutral' },
    in_progress: { label: 'In progress', tone: 'info' },
    submitted: { label: 'Submitted', tone: 'info' },
    under_review: { label: 'Under review', tone: 'info' },
    changes_requested: { label: 'Changes requested', tone: 'warning' },
    resubmitted: { label: 'Resubmitted', tone: 'info' },
    verified: { label: 'Verified', tone: 'success' },
  },
  record_status: {
    draft: { label: 'Draft', tone: 'neutral' },
    submitted: { label: 'Submitted', tone: 'info' },
    changes_requested: { label: 'Changes requested', tone: 'warning' },
    approved: { label: 'Approved', tone: 'success' },
    superseded: { label: 'Superseded', tone: 'neutral' },
  },
  paper_status: {
    candidate: { label: 'Candidate', tone: 'neutral' },
    submitted: { label: 'Submitted', tone: 'info' },
    approved: { label: 'Approved', tone: 'success' },
    rejected: { label: 'Rejected', tone: 'danger' },
    withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  },
  execution_status: {
    not_started: { label: 'Not started', tone: 'neutral' },
    repository_identified: { label: 'Repository identified', tone: 'info' },
    environment_setup: { label: 'Environment setup in progress', tone: 'info' },
    execution_successful: { label: 'Execution successful', tone: 'info' },
    execution_failed: { label: 'Execution failed', tone: 'danger' },
    blocked_dependency_dataset: { label: 'Blocked by dependency or dataset', tone: 'danger' },
    verification_pending: { label: 'Faculty verification pending', tone: 'warning' },
    verified: { label: 'Verified', tone: 'success' },
  },
  review_outcome: {
    accepted: { label: 'Accepted', tone: 'success' },
    changes_requested: { label: 'Changes requested', tone: 'warning' },
    rejected: { label: 'Rejected', tone: 'danger' },
    comment_only: { label: 'Comment', tone: 'neutral' },
  },
  correction_status: {
    open: { label: 'Open', tone: 'warning' },
    addressed: { label: 'Addressed', tone: 'info' },
    verified: { label: 'Verified', tone: 'success' },
    waived: { label: 'Waived', tone: 'neutral' },
  },
  evidence_verification: {
    unverified: { label: 'Not yet verified', tone: 'neutral' },
    verified: { label: 'Verified', tone: 'success' },
    rejected: { label: 'Rejected', tone: 'danger' },
    inaccessible: { label: 'Not accessible', tone: 'danger' },
  },
} as const satisfies {
  [
    F in
      | 'stage_status'
      | 'task_status'
      | 'record_status'
      | 'paper_status'
      | 'execution_status'
      | 'review_outcome'
      | 'correction_status'
      | 'evidence_verification'
  ]: Record<EnumValue<F>, StatusLabel>;
};

export type StatusFamily = keyof typeof STATUS_LABELS;
