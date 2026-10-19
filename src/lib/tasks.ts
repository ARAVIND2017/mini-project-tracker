import type { Enums, Json, Tables, Views } from './database.types';
import { run } from './api';
import type { EvidenceInput } from './research';
import { requireSupabase } from './supabase';

// Phase 5: the semester plan, weekly tasks, submissions and the review queue.

export type Milestone = Tables<'milestones'>;
export type TaskTemplate = Tables<'task_templates'>;
export type TaskRow = Views<'v_tasks'>;
export type Submission = Tables<'submissions'>;
export type SubmissionEvidence = Tables<'submission_evidence'>;
export type QueueItem = Views<'v_review_queue'>;

const db = () => requireSupabase();

// ---------------------------------------------------------------- plan -------------
export async function listPlan(
  semesterId: string,
): Promise<{ milestones: Milestone[]; templates: TaskTemplate[] }> {
  const [milestones, templates] = await Promise.all([
    run(db().from('milestones').select('*').eq('semester_id', semesterId).order('week_no')),
    run(
      db()
        .from('task_templates')
        .select('*')
        .eq('semester_id', semesterId)
        .order('week_no')
        .order('sort_order'),
    ),
  ]);
  return { milestones: milestones ?? [], templates: templates ?? [] };
}

export const upsertMilestone = (
  semesterId: string,
  weekNo: number,
  data: Record<string, unknown>,
) =>
  run(
    db().rpc('app_upsert_milestone', {
      p_semester_id: semesterId,
      p_week_no: weekNo,
      p_data: data as Json,
    }),
  );

export const upsertTaskTemplate = (
  semesterId: string,
  data: Record<string, unknown>,
  templateId?: string,
) =>
  run(
    db().rpc('app_upsert_task_template', {
      p_semester_id: semesterId,
      p_data: data as Json,
      p_template_id: templateId ?? undefined,
    }),
  );

export const generateTasks = (semesterId: string, regenerate: boolean) =>
  run(db().rpc('app_generate_tasks', { p_semester_id: semesterId, p_regenerate: regenerate }));

// ---------------------------------------------------------------- tasks ------------
export interface ProjectTasks {
  tasks: TaskRow[];
  submissions: Submission[];
  submissionEvidence: SubmissionEvidence[];
  milestones: Milestone[];
}

export async function getProjectTasks(
  projectId: string,
  semesterId: string,
): Promise<ProjectTasks> {
  const [tasks, submissions, milestones] = await Promise.all([
    run(
      db().from('v_tasks').select('*').eq('project_id', projectId).order('week_no').order('due_at'),
    ),
    run(db().from('submissions').select('*').eq('project_id', projectId).order('version')),
    run(db().from('milestones').select('*').eq('semester_id', semesterId).order('week_no')),
  ]);
  const ids = (submissions ?? []).map((s) => s.id);
  const submissionEvidence = ids.length
    ? await run(db().from('submission_evidence').select('*').in('submission_id', ids))
    : [];
  return {
    tasks: tasks ?? [],
    submissions: submissions ?? [],
    submissionEvidence: submissionEvidence ?? [],
    milestones: milestones ?? [],
  };
}

export const startTask = (taskId: string) => run(db().rpc('app_start_task', { p_task_id: taskId }));

export const submitTask = (taskId: string, progressReport: string, evidence: EvidenceInput[]) =>
  run(
    db().rpc('app_submit_task', {
      p_task_id: taskId,
      p_progress_report: progressReport,
      p_evidence: evidence as unknown as Json,
    }),
  );

export const startReview = (submissionId: string) =>
  run(db().rpc('app_start_review', { p_submission_id: submissionId }));

export const setBlocked = (
  target: 'task' | 'project',
  id: string,
  blocked: boolean,
  reason?: string,
) =>
  run(
    db().rpc('app_set_blocked', {
      p_target: target,
      p_id: id,
      p_blocked: blocked,
      p_reason: reason || undefined,
    }),
  );

// ---------------------------------------------------------------- queue ------------
export async function listReviewQueue(semesterId: string): Promise<QueueItem[]> {
  const rows = await run(
    db()
      .from('v_review_queue')
      .select('*')
      .eq('semester_id', semesterId)
      .order('waiting_since', { ascending: true }),
  );
  return rows ?? [];
}

export type TaskStatus = Enums<'task_status'>;

/** The student's next task that is not yet verified (earliest deadline first). */
export async function getNextTask(projectId: string): Promise<TaskRow | null> {
  const rows = await run(
    db()
      .from('v_tasks')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'verified')
      .order('due_at')
      .limit(1),
  );
  return rows?.[0] ?? null;
}
