// CSV columns for the reports (FUN-17). Kept out of the component modules.
import { STAGES } from '@/domain/constants';
import type { CsvColumn } from '@/domain/csv';
import type { AuditEntry, OverviewRow, TimelinessRow } from '@/lib/reports';
import type { QueueItem } from '@/lib/tasks';

const stageName = (key: string | null | undefined) => {
  if (!key) return 'All stages complete';
  const s = STAGES.find((x) => x.key === key);
  return s ? `S${s.no} ${s.name}` : key;
};

export const OVERVIEW_COLUMNS: CsvColumn<OverviewRow>[] = [
  { header: 'Slot', value: (p) => p.slot_no },
  { header: 'Student ID', value: (p) => p.institution_id },
  { header: 'Student', value: (p) => p.student_name },
  { header: 'Roster status', value: (p) => p.roster_status },
  { header: 'Domain', value: (p) => p.domain_name },
  { header: 'Guide', value: (p) => p.guide_name },
  { header: 'Co-reviewers', value: (p) => (p.co_reviewer_names ?? []).join('; ') },
  { header: 'Title', value: (p) => p.title },
  { header: 'Current stage', value: (p) => stageName(p.current_stage) },
  { header: 'Progress %', value: (p) => p.progress },
  { header: 'Selected paper', value: (p) => p.selected_paper_title },
  { header: 'Code execution', value: (p) => p.execution_status },
  { header: 'Objectives', value: (p) => p.objective_status },
  { header: 'Overdue tasks', value: (p) => p.overdue_tasks },
  { header: 'Blocked tasks', value: (p) => p.blocked_tasks },
  { header: 'Open corrections', value: (p) => p.open_corrections },
  { header: 'Corrections to verify', value: (p) => p.addressed_corrections },
  { header: 'Waiting for review', value: (p) => p.awaiting_review },
  { header: 'Completed', value: (p) => (p.is_completed ? 'yes' : 'no') },
  { header: 'Last activity', value: (p) => p.last_activity },
];

export const TIMELINESS_COLUMNS: CsvColumn<TimelinessRow & { project?: OverviewRow }>[] = [
  { header: 'Slot', value: (t) => t.project?.slot_no },
  { header: 'Student', value: (t) => t.project?.student_name },
  { header: 'Guide', value: (t) => t.project?.guide_name },
  { header: 'Tasks due so far', value: (t) => t.tasks_due },
  { header: 'First submitted on time', value: (t) => t.submitted_on_time },
  { header: 'First submitted late', value: (t) => t.submitted_late },
  { header: 'Average days late', value: (t) => t.avg_days_late },
  { header: 'Overdue with no submission', value: (t) => t.overdue_without_submission },
  { header: 'Average submissions per task', value: (t) => t.avg_review_cycles },
];

export const QUEUE_COLUMNS: CsvColumn<QueueItem>[] = [
  { header: 'Slot', value: (i) => i.slot_no },
  { header: 'Student', value: (i) => i.student_name },
  { header: 'Guide', value: (i) => i.guide_name },
  { header: 'Stage', value: (i) => stageName(i.stage_key) },
  { header: 'Type', value: (i) => i.item_type },
  { header: 'Item', value: (i) => i.title },
  { header: 'Waiting since', value: (i) => i.waiting_since },
  { header: 'Late', value: (i) => (i.is_late ? 'yes' : '') },
];

export const AUDIT_COLUMNS = (names: Record<string, string>): CsvColumn<AuditEntry>[] => [
  { header: 'When', value: (a) => a.created_at },
  { header: 'Who', value: (a) => (a.actor_id ? (names[a.actor_id] ?? a.actor_id) : 'System') },
  { header: 'Action', value: (a) => a.action },
  { header: 'Table', value: (a) => a.table_name },
  { header: 'Record', value: (a) => a.row_id },
  { header: 'Project', value: (a) => a.project_id },
  { header: 'Details', value: (a) => (a.new_data ? JSON.stringify(a.new_data) : '') },
];
