import { FunctionsHttpError } from '@supabase/supabase-js';
import { myContextSchema, type MyContext } from '@/domain/context';
import type { Enums, Json, Tables, Views } from './database.types';
import { AppError, toAppError } from './errors';
import { requireSupabase } from './supabase';

/** Unwraps a supabase-js { data, error } result, throwing an AppError on failure. */
export async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  let result: { data: T; error: unknown };
  try {
    result = await promise;
  } catch (err) {
    throw toAppError(err);
  }
  if (result.error) throw toAppError(result.error);
  return result.data;
}

// ---------------------------------------------------------------- context ----------
export async function fetchMyContext(): Promise<MyContext> {
  const data = await run(requireSupabase().rpc('app_my_context'));
  const parsed = myContextSchema.safeParse(data);
  if (!parsed.success) throw new AppError('UNKNOWN', 'Your account details could not be loaded.');
  return parsed.data;
}

// ---------------------------------------------------------------- semesters --------
export type Semester = Tables<'semesters'>;

export async function listSemesters(): Promise<Semester[]> {
  const rows = await run(
    requireSupabase().from('semesters').select('*').order('created_at', { ascending: false }),
  );
  return rows ?? [];
}

export async function getSemester(id: string): Promise<Semester> {
  const row = await run(requireSupabase().from('semesters').select('*').eq('id', id).maybeSingle());
  if (!row) throw new AppError('NOT_FOUND', 'Semester not found, or you do not have access to it.');
  return row;
}

export function createSemester(
  name: string,
  academicYear: string | null,
  settings: Record<string, unknown>,
) {
  return run(
    requireSupabase().rpc('app_create_semester', {
      p_name: name,
      p_academic_year: academicYear ?? undefined,
      p_settings: settings as Json,
    }),
  );
}

export function updateSemester(id: string, settings: Record<string, unknown>) {
  return run(
    requireSupabase().rpc('app_update_semester', {
      p_semester_id: id,
      p_settings: settings as Json,
    }),
  );
}

export function activateSemester(id: string) {
  return run(requireSupabase().rpc('app_activate_semester', { p_semester_id: id }));
}

export function closeSemester(id: string) {
  return run(requireSupabase().rpc('app_close_semester', { p_semester_id: id }));
}

export interface CopyResult {
  domains_added: number;
  criteria_added: number;
  milestones: number;
  templates: number;
  templates_switched_off: number;
}

/** Copies domains, criteria, milestones and task templates into a draft semester (not people). */
export async function copySemesterConfig(fromId: string, toId: string): Promise<CopyResult> {
  const data = await run(
    requireSupabase().rpc('app_copy_semester_config', {
      p_from_semester: fromId,
      p_to_semester: toId,
    }),
  );
  return data as unknown as CopyResult;
}

// ---------------------------------------------------------------- people -----------
export interface Member {
  id: string;
  role: Enums<'semester_role'>;
  is_active: boolean;
  reports_to: string | null;
  user_id: string;
  profile: {
    full_name: string;
    email: string;
    designation: string | null;
    is_active: boolean;
  } | null;
}

export async function listMembers(semesterId: string): Promise<Member[]> {
  const rows = await run(
    requireSupabase()
      .from('memberships')
      .select(
        'id, role, is_active, reports_to, user_id, profile:profiles!memberships_user_id_fkey(full_name, email, designation, is_active)',
      )
      .eq('semester_id', semesterId)
      .order('created_at'),
  );
  return rows ?? [];
}

export function setLead(semesterId: string, userId: string) {
  return run(
    requireSupabase().rpc('app_set_lead', { p_semester_id: semesterId, p_user_id: userId }),
  );
}

export function setMembership(
  semesterId: string,
  userId: string,
  role: Enums<'semester_role'>,
  isActive: boolean,
) {
  return run(
    requireSupabase().rpc('app_set_membership', {
      p_semester_id: semesterId,
      p_user_id: userId,
      p_role: role,
      p_is_active: isActive,
    }),
  );
}

// ---------------------------------------------------------------- admin-users -------
type AdminUsersRequest =
  | {
      action: 'invite_faculty';
      email: string;
      full_name: string;
      semester_id: string;
      role: 'faculty' | 'lead_faculty';
      designation?: string;
      redirect_to?: string;
    }
  | { action: 'invite_student'; student_id: string; redirect_to?: string }
  | { action: 'resend_invite'; user_id: string; redirect_to?: string }
  | { action: 'deactivate_user' | 'reactivate_user'; user_id: string; reason: string };

/** Where invite and password-reset links land (must be on the Supabase redirect allow-list). */
export function authRedirectUrl(): string {
  return `${window.location.origin}/auth/set-password`;
}

async function callAdminUsers(body: AdminUsersRequest): Promise<{ ok: true; user_id: string }> {
  const { data, error } = await requireSupabase().functions.invoke('admin-users', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload: unknown = await error.context.json().catch(() => null);
      throw toAppError(payload ?? error);
    }
    throw toAppError(error);
  }
  return data as { ok: true; user_id: string };
}

export function inviteFaculty(input: {
  email: string;
  fullName: string;
  designation?: string;
  semesterId: string;
  role: 'faculty' | 'lead_faculty';
}) {
  return callAdminUsers({
    action: 'invite_faculty',
    email: input.email,
    full_name: input.fullName,
    designation: input.designation || undefined,
    semester_id: input.semesterId,
    role: input.role,
    redirect_to: authRedirectUrl(),
  });
}

export function resendInvite(userId: string) {
  return callAdminUsers({
    action: 'resend_invite',
    user_id: userId,
    redirect_to: authRedirectUrl(),
  });
}

export function setUserActive(userId: string, active: boolean, reason: string) {
  return callAdminUsers({
    action: active ? 'reactivate_user' : 'deactivate_user',
    user_id: userId,
    reason,
  });
}

// ---------------------------------------------------------------- domains ----------
export type Domain = Tables<'domains'>;
export type Criterion = Tables<'evaluation_criteria'>;

export async function listDomains(semesterId: string): Promise<Domain[]> {
  const rows = await run(
    requireSupabase().from('domains').select('*').eq('semester_id', semesterId).order('name'),
  );
  return rows ?? [];
}

export async function listCriteria(semesterId: string): Promise<Criterion[]> {
  const rows = await run(
    requireSupabase()
      .from('evaluation_criteria')
      .select('*, domains!inner(semester_id)')
      .eq('domains.semester_id', semesterId)
      .order('sort_order'),
  );
  return (rows ?? []).map(({ domains: _d, ...c }) => c as Criterion);
}

export function upsertDomain(input: {
  semesterId: string;
  name: string;
  description?: string;
  isActive?: boolean;
  domainId?: string;
}) {
  return run(
    requireSupabase().rpc('app_upsert_domain', {
      p_semester_id: input.semesterId,
      p_name: input.name,
      p_description: input.description ?? undefined,
      p_is_active: input.isActive ?? true,
      p_domain_id: input.domainId ?? undefined,
    }),
  );
}

export function upsertCriterion(input: {
  domainId: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  criterionId?: string;
}) {
  return run(
    requireSupabase().rpc('app_upsert_criterion', {
      p_domain_id: input.domainId,
      p_name: input.name,
      p_description: input.description ?? undefined,
      p_sort_order: input.sortOrder ?? 0,
      p_is_active: input.isActive ?? true,
      p_criterion_id: input.criterionId ?? undefined,
    }),
  );
}

// ---------------------------------------------------------------- expertise --------
export type Expertise = Tables<'faculty_expertise'>;

export async function listExpertise(semesterId: string): Promise<Expertise[]> {
  const rows = await run(
    requireSupabase()
      .from('faculty_expertise')
      .select('*')
      .eq('semester_id', semesterId)
      .eq('is_active', true),
  );
  return rows ?? [];
}

export function setExpertise(semesterId: string, domainIds: string[], userId?: string) {
  return run(
    requireSupabase().rpc('app_set_expertise', {
      p_semester_id: semesterId,
      p_domain_ids: domainIds,
      p_user_id: userId ?? undefined,
    }),
  );
}

// ---------------------------------------------------------------- roster -----------
export type Student = Tables<'students'>;

export async function listStudents(semesterId: string): Promise<Student[]> {
  const rows = await run(
    requireSupabase().from('students').select('*').eq('semester_id', semesterId).order('slot_no'),
  );
  return rows ?? [];
}

export interface ImportReport {
  dry_run: boolean;
  ok: boolean;
  counts: { create: number; update: number; unchanged: number };
  errors: { row: number; slot_no?: number; message: string }[];
  rows: {
    row: number;
    slot_no: number;
    action: 'create' | 'update' | 'unchanged';
    filled: boolean;
    full_name: string | null;
    institution_id: string | null;
    email: string | null;
    domain_name: string | null;
  }[];
  filled_after: number;
  capacity: number;
}

export async function importRoster(
  semesterId: string,
  rows: unknown[],
  dryRun: boolean,
): Promise<ImportReport> {
  const data = await run(
    requireSupabase().rpc('app_import_roster', {
      p_semester_id: semesterId,
      p_rows: rows as Json,
      p_dry_run: dryRun,
    }),
  );
  return data as unknown as ImportReport;
}

export function updateStudent(
  studentId: string,
  patch: Partial<Pick<Student, 'institution_id' | 'full_name' | 'email' | 'drive_folder_url'>>,
) {
  return run(
    requireSupabase().rpc('app_update_student', {
      p_student_id: studentId,
      p_patch: patch as Json,
    }),
  );
}

export function addEmptySlots(semesterId: string, upToSlot: number) {
  return run(
    requireSupabase().rpc('app_add_empty_slots', {
      p_semester_id: semesterId,
      p_up_to_slot: upToSlot,
    }),
  );
}

export function withdrawStudent(studentId: string, reason: string) {
  return run(
    requireSupabase().rpc('app_withdraw_student', { p_student_id: studentId, p_reason: reason }),
  );
}

export function setMyDriveFolder(studentId: string, url: string) {
  return run(
    requireSupabase().rpc('app_set_my_drive_folder', { p_student_id: studentId, p_url: url }),
  );
}

export function inviteStudent(studentId: string) {
  return callAdminUsers({
    action: 'invite_student',
    student_id: studentId,
    redirect_to: authRedirectUrl(),
  });
}

// ---------------------------------------------------------------- projects ---------
export type ProjectRow = Views<'v_projects'>;

export async function listProjects(semesterId: string): Promise<ProjectRow[]> {
  const rows = await run(
    requireSupabase().from('v_projects').select('*').eq('semester_id', semesterId).order('slot_no'),
  );
  return rows ?? [];
}

/** The signed-in student's own projects (RLS returns only theirs). */
export async function listMyProjects(userId: string): Promise<ProjectRow[]> {
  const rows = await run(
    requireSupabase()
      .from('v_projects')
      .select('*')
      .eq('student_user_id', userId)
      .order('updated_at', {
        ascending: false,
      }),
  );
  return rows ?? [];
}

export function setProjectDomain(projectId: string, domainId: string | null) {
  return run(
    requireSupabase().rpc('app_set_project_domain', {
      p_project_id: projectId,
      p_domain_id: domainId,
    }),
  );
}

export function setProjectTitle(projectId: string, title: string) {
  return run(
    requireSupabase().rpc('app_set_project_title', { p_project_id: projectId, p_title: title }),
  );
}

export function assignGuide(projectId: string, facultyId: string | null, note?: string) {
  return run(
    requireSupabase().rpc('app_assign_guide', {
      p_project_id: projectId,
      p_faculty_id: facultyId as string,
      p_note: note ?? undefined,
    }),
  );
}

export function removeCoReviewer(projectId: string, facultyId: string, note?: string) {
  return run(
    requireSupabase().rpc('app_remove_co_reviewer', {
      p_project_id: projectId,
      p_faculty_id: facultyId,
      p_note: note ?? undefined,
    }),
  );
}

// ---------------------------------------------------------------- assignments ------
export type AssignmentRequest = Tables<'assignment_requests'>;
export type ReviewAuthorization = Tables<'review_authorizations'>;

export async function listAssignmentRequests(semesterId: string): Promise<AssignmentRequest[]> {
  const rows = await run(
    requireSupabase()
      .from('assignment_requests')
      .select('*, projects!inner(semester_id)')
      .eq('projects.semester_id', semesterId)
      .order('created_at', { ascending: false }),
  );
  return (rows ?? []).map(({ projects: _p, ...r }) => r as AssignmentRequest);
}

export function requestAssignment(
  projectId: string,
  type: Enums<'assignment_type'>,
  facultyId: string,
  reason: string,
) {
  return run(
    requireSupabase().rpc('app_request_assignment', {
      p_project_id: projectId,
      p_type: type,
      p_faculty_id: facultyId,
      p_reason: reason,
    }),
  );
}

export function cancelAssignmentRequest(requestId: string) {
  return run(requireSupabase().rpc('app_cancel_assignment_request', { p_request_id: requestId }));
}

export function decideAssignmentRequest(requestId: string, approve: boolean, note?: string) {
  return run(
    requireSupabase().rpc('app_decide_assignment_request', {
      p_request_id: requestId,
      p_approve: approve,
      p_note: note ?? undefined,
    }),
  );
}

export async function listReviewAuthorizations(semesterId: string): Promise<ReviewAuthorization[]> {
  const rows = await run(
    requireSupabase()
      .from('review_authorizations')
      .select('*, projects!inner(semester_id)')
      .eq('projects.semester_id', semesterId)
      .order('created_at', { ascending: false }),
  );
  return (rows ?? []).map(({ projects: _p, ...r }) => r as ReviewAuthorization);
}

export function grantReviewAuthorization(
  projectId: string,
  facultyId: string,
  validUntil?: string,
  note?: string,
) {
  return run(
    requireSupabase().rpc('app_grant_review_authorization', {
      p_project_id: projectId,
      p_faculty_id: facultyId,
      p_valid_until: validUntil ?? undefined,
      p_note: note ?? undefined,
    }),
  );
}

export function revokeReviewAuthorization(authorizationId: string) {
  return run(
    requireSupabase().rpc('app_revoke_review_authorization', {
      p_authorization_id: authorizationId,
    }),
  );
}

// ---------------------------------------------------------------- names ------------
/** Names for profile ids the caller is allowed to see (RLS filters the rest). */
export async function profileNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const rows = await run(
    requireSupabase().from('profiles').select('id, full_name').in('id', unique),
  );
  return Object.fromEntries((rows ?? []).map((p) => [p.id, p.full_name]));
}

/** The signed-in student's own roster entries (RLS returns only theirs). */
export async function listMyRosterEntries(
  userId: string,
): Promise<Pick<Student, 'id' | 'drive_folder_url' | 'semester_id'>[]> {
  const rows = await run(
    requireSupabase()
      .from('students')
      .select('id, drive_folder_url, semester_id')
      .eq('user_id', userId),
  );
  return rows ?? [];
}
