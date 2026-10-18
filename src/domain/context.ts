import { z } from 'zod';
import { ENUMS } from './constants';

/** Shape returned by the app_my_context() RPC. Parsed, never trusted blindly. */
const membershipSchema = z.object({
  membership_id: z.string(),
  semester_id: z.string(),
  semester_name: z.string(),
  semester_status: z.enum(ENUMS.semester_status),
  role: z.enum(ENUMS.semester_role),
});

const systemRoleSchema = z.object({
  role: z.enum(ENUMS.system_role),
  admin_permissions: z.array(z.string()),
});

export const myContextSchema = z.discriminatedUnion('active', [
  z.object({ active: z.literal(false), user_id: z.string().optional() }),
  z.object({
    active: z.literal(true),
    user_id: z.string(),
    profile: z.object({
      full_name: z.string(),
      email: z.string(),
      designation: z.string().nullable(),
    }),
    system_roles: z.array(systemRoleSchema),
    memberships: z.array(membershipSchema),
  }),
]);

export type MyContext = z.infer<typeof myContextSchema>;
export type ActiveContext = Extract<MyContext, { active: true }>;
export type ContextMembership = z.infer<typeof membershipSchema>;
export type AdminPermission = 'manage_users' | 'manage_config' | 'manage_roster';

// UI-only helpers: they decide what to show. The database enforces the real rules.
export function isHod(ctx: ActiveContext): boolean {
  return ctx.system_roles.some((r) => r.role === 'hod');
}

export function hasAdminPermission(ctx: ActiveContext, permission: AdminPermission): boolean {
  return (
    isHod(ctx) ||
    ctx.system_roles.some((r) => r.role === 'admin' && r.admin_permissions.includes(permission))
  );
}

export function membershipFor(
  ctx: ActiveContext,
  semesterId: string,
): ContextMembership | undefined {
  return ctx.memberships.find((m) => m.semester_id === semesterId);
}

export function isFacultyLevel(ctx: ActiveContext, semesterId: string): boolean {
  const role = membershipFor(ctx, semesterId)?.role;
  return isHod(ctx) || role === 'lead_faculty' || role === 'faculty';
}

/** A short label for the header, e.g. "HOD" or "Lead faculty". */
export function primaryRoleLabel(ctx: ActiveContext): string {
  if (isHod(ctx)) return 'HOD';
  if (ctx.system_roles.some((r) => r.role === 'admin')) return 'Administrator';
  const roles = new Set(ctx.memberships.map((m) => m.role));
  if (roles.has('lead_faculty')) return 'Lead faculty';
  if (roles.has('faculty')) return 'Faculty';
  if (roles.has('student')) return 'Student';
  return 'No role yet';
}

export const ROLE_LABELS: Record<(typeof ENUMS.semester_role)[number], string> = {
  lead_faculty: 'Lead faculty',
  faculty: 'Faculty',
  student: 'Student',
};
