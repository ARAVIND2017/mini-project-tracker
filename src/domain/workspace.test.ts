import { cleanList, firstOpenStage, isEditable, latestVersion, viewerFor } from './workspace';
import type { ActiveContext } from './context';

const ctx = (
  userId: string,
  opts: { hod?: boolean; role?: 'lead_faculty' | 'faculty' | 'student' } = {},
) =>
  ({
    active: true,
    user_id: userId,
    profile: { full_name: 'Test', email: 't@example.test', designation: null },
    system_roles: opts.hod ? [{ role: 'hod', admin_permissions: [] }] : [],
    memberships: opts.role
      ? [
          {
            membership_id: 'm',
            semester_id: 'sem',
            semester_name: 'S',
            semester_status: 'active',
            role: opts.role,
          },
        ]
      : [],
  }) as ActiveContext;

const project = {
  semester_id: 'sem',
  guide_id: 'guide',
  student_user_id: 'stud',
  roster_status: 'active',
};

describe('viewerFor', () => {
  it('recognises the project student', () => {
    const v = viewerFor(ctx('stud', { role: 'student' }), project, [], []);
    expect(v).toMatchObject({ isStudent: true, isFaculty: false, isReviewer: false });
  });

  it('treats a withdrawn student as read-only', () => {
    const v = viewerFor(
      ctx('stud', { role: 'student' }),
      { ...project, roster_status: 'withdrawn' },
      [],
      [],
    );
    expect(v.isStudent).toBe(false);
  });

  it('gives the guide reviewer and exception rights', () => {
    const v = viewerFor(ctx('guide', { role: 'faculty' }), project, [], []);
    expect(v).toMatchObject({ isReviewer: true, canApproveException: true });
  });

  it('lets unassigned faculty only comment', () => {
    const v = viewerFor(ctx('other', { role: 'faculty' }), project, [], []);
    expect(v).toMatchObject({ isFaculty: true, isReviewer: false, canApproveException: false });
  });

  it('counts co-reviewers and authorized faculty as reviewers, without exception rights', () => {
    expect(viewerFor(ctx('co', { role: 'faculty' }), project, ['co'], []).isReviewer).toBe(true);
    const auth = viewerFor(ctx('auth', { role: 'faculty' }), project, [], ['auth']);
    expect(auth).toMatchObject({ isReviewer: true, canApproveException: false });
  });

  it('gives the lead and the HOD every reviewer right', () => {
    expect(viewerFor(ctx('lead', { role: 'lead_faculty' }), project, [], []).isReviewer).toBe(true);
    expect(viewerFor(ctx('hod', { hod: true }), project, [], [])).toMatchObject({
      isReviewer: true,
      isHod: true,
    });
  });
});

describe('workspace helpers', () => {
  it('allows edits only for draft or changes requested', () => {
    expect(isEditable(undefined)).toBe(true);
    expect(isEditable('draft')).toBe(true);
    expect(isEditable('changes_requested')).toBe(true);
    expect(isEditable('submitted')).toBe(false);
    expect(isEditable('approved')).toBe(false);
  });

  it('finds the latest version', () => {
    expect(latestVersion([{ version: 1 }, { version: 3 }, { version: 2 }])?.version).toBe(3);
    expect(latestVersion([])).toBeUndefined();
  });

  it('opens the first stage that is not done', () => {
    const order = ['exploration', 'paper_selection', 'paper_analysis'] as const;
    expect(
      firstOpenStage(
        [
          { stage_key: 'exploration', status: 'approved' },
          { stage_key: 'paper_selection', status: 'in_progress' },
        ],
        order,
      ),
    ).toBe('paper_selection');
    expect(
      firstOpenStage(
        order.map((k) => ({ stage_key: k, status: 'approved' })),
        order,
      ),
    ).toBe('paper_analysis');
  });

  it('cleans list fields', () => {
    expect(cleanList([' a ', '', '  ', 'b'])).toEqual(['a', 'b']);
  });
});
