// admin-users — account administration that needs the service-role key (TRD ADR-003).
//
// The service-role key is used ONLY for Supabase Auth admin calls (invite, ban).
// Every database change runs through the caller's own JWT, so the database
// re-checks permissions (RLS + RPC) and records the caller in the audit log.
//
// POST { action: 'invite_faculty', email, full_name, semester_id, role, designation?, redirect_to? }
// POST { action: 'resend_invite', user_id, redirect_to? }
// POST { action: 'deactivate_user' | 'reactivate_user', user_id, reason }
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ErrorCode = 'VALIDATION' | 'FORBIDDEN' | 'NOT_FOUND' | 'ALREADY_EXISTS' | 'INTERNAL';

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(
  body: Record<string, unknown>,
  key: string,
  opts: { min?: number; max?: number } = {},
): string {
  const value = body[key];
  const { min = 1, max = 200 } = opts;
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new HttpError(400, 'VALIDATION', `${key} is required (${min}–${max} characters)`);
  }
  return value.trim();
}

function uuid(body: Record<string, unknown>, key: string): string {
  const value = str(body, key);
  if (!UUID.test(value)) throw new HttpError(400, 'VALIDATION', `${key} must be a UUID`);
  return value;
}

function optionalRedirect(body: Record<string, unknown>): string | undefined {
  const value = body.redirect_to;
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^https?:\/\//.test(value)) {
    throw new HttpError(400, 'VALIDATION', 'redirect_to must be a URL');
  }
  // Supabase Auth only honours URLs on the project's redirect allow-list.
  return value;
}

/** Maps a database RPC error ("CODE: message") to an HTTP error. */
function rpcError(error: { message: string }): HttpError {
  const match = /^([A-Z_]+): (.*)$/s.exec(error.message);
  const code = match?.[1] ?? '';
  const message = match?.[2] ?? 'The request could not be completed';
  if (code === 'FORBIDDEN') return new HttpError(403, 'FORBIDDEN', message);
  if (code === 'NOT_FOUND') return new HttpError(404, 'NOT_FOUND', message);
  if (code) return new HttpError(400, 'VALIDATION', message);
  console.error('rpc error', error.message);
  return new HttpError(500, 'INTERNAL', 'The request could not be completed');
}

interface Caller {
  id: string;
  isHod: boolean;
  canManageUsers: boolean;
  db: SupabaseClient; // acts as the caller (RLS applies)
}

async function authenticate(req: Request, admin: SupabaseClient): Promise<Caller> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'FORBIDDEN', 'Sign in first');

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'FORBIDDEN', 'Sign in first');

  const db = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: context, error: contextError } = await db.rpc('app_my_context');
  if (contextError) throw rpcError(contextError);
  if (!context?.active) throw new HttpError(403, 'FORBIDDEN', 'Your account is not active');

  const roles = (context.system_roles ?? []) as { role: string; admin_permissions: string[] }[];
  const isHod = roles.some((r) => r.role === 'hod');
  const canManageUsers =
    isHod || roles.some((r) => r.role === 'admin' && r.admin_permissions.includes('manage_users'));
  if (!canManageUsers) {
    throw new HttpError(403, 'FORBIDDEN', 'Only the HOD can manage accounts');
  }
  return { id: data.user.id, isHod, canManageUsers, db };
}

async function inviteFaculty(body: Record<string, unknown>, caller: Caller, admin: SupabaseClient) {
  const email = str(body, 'email', { max: 254 }).toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(400, 'VALIDATION', 'email is not valid');
  const fullName = str(body, 'full_name', { max: 120 });
  const semesterId = uuid(body, 'semester_id');
  const role = body.role;
  if (role !== 'faculty' && role !== 'lead_faculty') {
    throw new HttpError(400, 'VALIDATION', "role must be 'faculty' or 'lead_faculty'");
  }
  if (role === 'lead_faculty' && !caller.isHod) {
    throw new HttpError(403, 'FORBIDDEN', 'Only the HOD can appoint the lead faculty');
  }
  const designation =
    typeof body.designation === 'string' && body.designation.trim()
      ? body.designation.trim().slice(0, 80)
      : undefined;

  // Check the semester is visible to the caller before creating any account.
  const { data: semester, error: semesterError } = await caller.db
    .from('semesters')
    .select('id, status')
    .eq('id', semesterId)
    .maybeSingle();
  if (semesterError) throw rpcError(semesterError);
  if (!semester) throw new HttpError(404, 'NOT_FOUND', 'Semester not found');
  if (semester.status === 'closed')
    throw new HttpError(400, 'VALIDATION', 'A closed semester cannot be changed');

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, designation },
    redirectTo: optionalRedirect(body),
  });
  if (inviteError) {
    if (/already been registered|already exists/i.test(inviteError.message)) {
      throw new HttpError(409, 'ALREADY_EXISTS', 'An account with this email already exists');
    }
    console.error('invite error', inviteError.message);
    throw new HttpError(500, 'INTERNAL', 'The invitation could not be sent');
  }

  const userId = invited.user.id;
  const { error: membershipError } = await caller.db.rpc('app_set_membership', {
    p_semester_id: semesterId,
    p_user_id: userId,
    p_role: role,
    p_is_active: true,
  });
  if (membershipError) {
    // Do not leave an orphaned account behind if the membership was refused.
    await admin.auth.admin.deleteUser(userId);
    throw rpcError(membershipError);
  }
  return { ok: true, user_id: userId };
}

async function resendInvite(body: Record<string, unknown>, caller: Caller, admin: SupabaseClient) {
  const userId = uuid(body, 'user_id');
  // RLS: the caller must be able to see this profile.
  const { data: profile, error } = await caller.db
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw rpcError(error);
  if (!profile) throw new HttpError(404, 'NOT_FOUND', 'User not found');

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  if (authUser?.user?.last_sign_in_at) {
    throw new HttpError(400, 'VALIDATION', 'This user has already accepted the invitation');
  }
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(profile.email, {
    redirectTo: optionalRedirect(body),
  });
  if (inviteError) {
    console.error('resend error', inviteError.message);
    throw new HttpError(500, 'INTERNAL', 'The invitation could not be sent');
  }
  return { ok: true, user_id: userId };
}

async function setActive(
  body: Record<string, unknown>,
  caller: Caller,
  admin: SupabaseClient,
  active: boolean,
) {
  const userId = uuid(body, 'user_id');
  const reason = str(body, 'reason', { min: 5, max: 500 });
  // Database first: it enforces every rule (not yourself, last HOD, HOD-only targets).
  const { error } = await caller.db.rpc('app_set_user_active', {
    p_user_id: userId,
    p_is_active: active,
    p_reason: reason,
  });
  if (error) throw rpcError(error);

  // ~100 years: a ban blocks sign-in and token refresh until lifted.
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : '876000h',
  });
  if (banError) {
    console.error('ban error', banError.message);
    throw new HttpError(
      500,
      'INTERNAL',
      'The account flag changed, but sign-in could not be updated. Try again.',
    );
  }
  return { ok: true, user_id: userId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { code: 'VALIDATION', message: 'Use POST' });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const caller = await authenticate(req, admin);
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, 'VALIDATION', 'Body must be JSON');
    }
    switch (body.action) {
      case 'invite_faculty':
        return json(200, await inviteFaculty(body, caller, admin));
      case 'resend_invite':
        return json(200, await resendInvite(body, caller, admin));
      case 'deactivate_user':
        return json(200, await setActive(body, caller, admin, false));
      case 'reactivate_user':
        return json(200, await setActive(body, caller, admin, true));
      default:
        throw new HttpError(400, 'VALIDATION', 'Unknown action');
    }
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { code: err.code, message: err.message });
    console.error('unexpected error', err);
    return json(500, { code: 'INTERNAL', message: 'The request could not be completed' });
  }
});
