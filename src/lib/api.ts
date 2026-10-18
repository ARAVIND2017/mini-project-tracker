import { FunctionsHttpError } from '@supabase/supabase-js';
import { myContextSchema, type MyContext } from '@/domain/context';
import type { Enums, Json, Tables } from './database.types';
import { AppError, toAppError } from './errors';
import { requireSupabase } from './supabase';

/** Unwraps a supabase-js { data, error } result, throwing an AppError on failure. */
async function run<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
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
