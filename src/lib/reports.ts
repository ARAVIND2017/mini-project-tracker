import type { Enums, Json, Tables, Views } from './database.types';
import { run } from './api';
import { requireSupabase } from './supabase';

// ---------------------------------------------------------------- dashboards -------
export type OverviewRow = Views<'v_project_overview'>;
export type WorkloadRow = Views<'v_faculty_workload'>;
export type TaskFlagRow = Views<'v_task_flags'>;
export type TimelinessRow = Views<'v_timeliness'>;

export async function listOverview(semesterId: string): Promise<OverviewRow[]> {
  const rows = await run(
    requireSupabase()
      .from('v_project_overview')
      .select('*')
      .eq('semester_id', semesterId)
      .order('slot_no'),
  );
  return rows ?? [];
}

export async function getMyOverview(userId: string): Promise<OverviewRow[]> {
  const rows = await run(
    requireSupabase().from('v_project_overview').select('*').eq('student_user_id', userId),
  );
  return rows ?? [];
}

/** Lead, HOD and admins only (the view returns nothing to anyone else). */
export async function listWorkload(semesterId: string): Promise<WorkloadRow[]> {
  const rows = await run(
    requireSupabase()
      .from('v_faculty_workload')
      .select('*')
      .eq('semester_id', semesterId)
      .order('full_name'),
  );
  return rows ?? [];
}

export async function listTaskFlags(semesterId: string): Promise<TaskFlagRow[]> {
  const rows = await run(
    requireSupabase()
      .from('v_task_flags')
      .select('*')
      .eq('semester_id', semesterId)
      .order('due_at'),
  );
  return rows ?? [];
}

export async function listTimeliness(semesterId: string): Promise<TimelinessRow[]> {
  const rows = await run(
    requireSupabase().from('v_timeliness').select('*').eq('semester_id', semesterId),
  );
  return rows ?? [];
}

export async function getProjectTimeliness(projectId: string): Promise<TimelinessRow | null> {
  return run(
    requireSupabase().from('v_timeliness').select('*').eq('project_id', projectId).maybeSingle(),
  );
}

export interface LatestReview {
  id: string;
  target_type: string;
  outcome: Enums<'review_outcome'>;
  observations: string | null;
  comments: string | null;
  created_at: string;
  reviewer_id: string;
}

export async function getLatestReview(projectId: string): Promise<LatestReview | null> {
  return run(
    requireSupabase()
      .from('reviews')
      .select('id, target_type, outcome, observations, comments, created_at, reviewer_id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

export function escalateToHod(projectId: string, note: string) {
  return run(
    requireSupabase().rpc('app_escalate_to_hod', { p_project_id: projectId, p_note: note }),
  );
}

// ---------------------------------------------------------------- notifications ----
export type Notification = Tables<'notifications'>;

export async function listNotifications(limit = 100): Promise<Notification[]> {
  const rows = await run(
    requireSupabase()
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
  );
  return rows ?? [];
}

export async function countUnread(): Promise<number> {
  const { count, error } = await requireSupabase()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** Marks the given notifications (or all of them) as read; returns how many changed. */
export function markNotificationsRead(ids?: string[]) {
  return run(requireSupabase().rpc('app_mark_notifications_read', { p_ids: ids }));
}

/** Adds 48-hour deadline reminders for the caller's open tasks (each task once). */
export function refreshMyReminders() {
  return run(requireSupabase().rpc('app_refresh_my_reminders'));
}

// ---------------------------------------------------------------- meetings ---------
export type Meeting = Tables<'review_meetings'>;
export type MeetingOutcome = Tables<'meeting_outcomes'>;
export type MeetingAttendee = Tables<'meeting_attendees'>;

export interface MeetingWithDetails extends Meeting {
  outcomes: MeetingOutcome[];
  attendees: MeetingAttendee[];
}

export async function listMeetings(semesterId: string): Promise<MeetingWithDetails[]> {
  const rows = await run(
    requireSupabase()
      .from('review_meetings')
      .select('*, outcomes:meeting_outcomes(*), attendees:meeting_attendees(*)')
      .eq('semester_id', semesterId)
      .order('held_on', { ascending: false }),
  );
  return (rows ?? []) as MeetingWithDetails[];
}

export interface MeetingInput {
  semesterId: string;
  heldOn: string;
  title: string;
  notes: string;
  attendeeIds: string[];
  outcomes: { project_id: string; outcome: string; action_items: string[] }[];
}

export function recordMeeting(input: MeetingInput) {
  return run(
    requireSupabase().rpc('app_record_meeting', {
      p_semester_id: input.semesterId,
      p_held_on: input.heldOn,
      p_title: input.title,
      p_notes: input.notes,
      p_attendee_ids: input.attendeeIds,
      p_outcomes: input.outcomes as unknown as Json,
    }),
  );
}

// ---------------------------------------------------------------- audit ------------
export type AuditEntry = Tables<'audit_log'>;

export interface AuditFilter {
  semesterId: string;
  action?: string;
  projectId?: string;
  limit?: number;
}

/** HOD and admins see everything; the lead sees entries about their semester's projects. */
export async function listAudit(f: AuditFilter): Promise<AuditEntry[]> {
  let q = requireSupabase()
    .from('audit_log')
    .select('*')
    .eq('semester_id', f.semesterId)
    .order('created_at', { ascending: false })
    .limit(f.limit ?? 500);
  if (f.action) q = q.like('action', `${f.action}%`);
  if (f.projectId) q = q.eq('project_id', f.projectId);
  const rows = await run(q);
  return rows ?? [];
}

export interface ProjectOutcome extends MeetingOutcome {
  meeting: Pick<Meeting, 'title' | 'held_on'> | null;
}

/** Meeting outcomes for one project (a student sees only their own). */
export async function listProjectOutcomes(projectId: string): Promise<ProjectOutcome[]> {
  const rows = await run(
    requireSupabase()
      .from('meeting_outcomes')
      .select('*, meeting:review_meetings(title, held_on)')
      .eq('project_id', projectId),
  );
  return ((rows ?? []) as ProjectOutcome[]).sort(
    (a, b) => Date.parse(b.meeting?.held_on ?? '') - Date.parse(a.meeting?.held_on ?? ''),
  );
}
