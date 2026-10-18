import {
  hasAdminPermission,
  isFacultyLevel,
  isHod,
  myContextSchema,
  primaryRoleLabel,
  type ActiveContext,
} from './context';

function ctx(overrides: Partial<ActiveContext> = {}): ActiveContext {
  return {
    active: true,
    user_id: 'u1',
    profile: { full_name: 'Test User', email: 'test@example.test', designation: null },
    system_roles: [],
    memberships: [],
    ...overrides,
  };
}

describe('my context', () => {
  it('parses the RPC payload and rejects unknown roles', () => {
    expect(myContextSchema.safeParse({ active: false }).success).toBe(true);
    expect(myContextSchema.safeParse(ctx()).success).toBe(true);
    expect(
      myContextSchema.safeParse(
        ctx({ system_roles: [{ role: 'superuser' as 'hod', admin_permissions: [] }] }),
      ).success,
    ).toBe(false);
  });

  it('treats the HOD as faculty-level in every semester', () => {
    const hod = ctx({ system_roles: [{ role: 'hod', admin_permissions: [] }] });
    expect(isHod(hod)).toBe(true);
    expect(isFacultyLevel(hod, 'any-semester')).toBe(true);
    expect(hasAdminPermission(hod, 'manage_users')).toBe(true);
    expect(primaryRoleLabel(hod)).toBe('HOD');
  });

  it('gives admins only their delegated permissions', () => {
    const admin = ctx({ system_roles: [{ role: 'admin', admin_permissions: ['manage_config'] }] });
    expect(hasAdminPermission(admin, 'manage_config')).toBe(true);
    expect(hasAdminPermission(admin, 'manage_users')).toBe(false);
  });

  it('scopes faculty roles to their semester', () => {
    const faculty = ctx({
      memberships: [
        {
          membership_id: 'm1',
          semester_id: 's1',
          semester_name: 'S1',
          semester_status: 'active',
          role: 'faculty',
        },
      ],
    });
    expect(isFacultyLevel(faculty, 's1')).toBe(true);
    expect(isFacultyLevel(faculty, 's2')).toBe(false);
    expect(primaryRoleLabel(faculty)).toBe('Faculty');
    expect(primaryRoleLabel(ctx())).toBe('No role yet');
  });
});
