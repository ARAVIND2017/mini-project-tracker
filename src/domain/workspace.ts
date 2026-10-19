import { isHod, membershipFor, type ActiveContext } from './context';
import type { StageKey } from './constants';

// UI-only helpers for the project page. They decide which controls to show; the
// database functions enforce the real rules (USER_ROLES_AND_PERMISSIONS.md §4.7).

export interface ViewerProject {
  semester_id: string | null;
  guide_id: string | null;
  student_user_id: string | null;
  roster_status: string | null;
}

export interface Viewer {
  /** The project's own (active) student. */
  isStudent: boolean;
  /** HOD, lead or faculty of the semester: may comment. */
  isFaculty: boolean;
  /** May accept, request changes, reject, verify evidence and resolve corrections. */
  isReviewer: boolean;
  isHod: boolean;
  /** May approve the S4 exception (guide, lead or HOD). */
  canApproveException: boolean;
}

export function viewerFor(
  ctx: ActiveContext,
  project: ViewerProject,
  coReviewerIds: readonly string[],
  authorizedIds: readonly string[],
): Viewer {
  const semesterId = project.semester_id ?? '';
  const role = membershipFor(ctx, semesterId)?.role;
  const hod = isHod(ctx);
  const lead = role === 'lead_faculty';
  const faculty = hod || lead || role === 'faculty';
  const guide = faculty && project.guide_id === ctx.user_id;
  const reviewer =
    hod ||
    lead ||
    (faculty &&
      (guide || coReviewerIds.includes(ctx.user_id) || authorizedIds.includes(ctx.user_id)));
  return {
    isStudent: project.student_user_id === ctx.user_id && project.roster_status === 'active',
    isFaculty: faculty,
    isReviewer: reviewer,
    isHod: hod,
    canApproveException: hod || lead || guide,
  };
}

/** Records the student may still edit (USER_ROLES_AND_PERMISSIONS.md §3). */
export function isEditable(status: string | null | undefined): boolean {
  return status == null || status === 'draft' || status === 'changes_requested';
}

export function latestVersion<T extends { version: number }>(rows: readonly T[]): T | undefined {
  return rows.reduce<T | undefined>(
    (best, r) => (!best || r.version > best.version ? r : best),
    undefined,
  );
}

export function isStageDone(status: string | null | undefined): boolean {
  return status === 'approved' || status === 'exception_approved';
}

/** The stage that opens first on the project page: the earliest S1–S5 stage not done. */
export function firstOpenStage(
  stages: readonly { stage_key: StageKey; status: string }[],
  order: readonly StageKey[],
): StageKey {
  for (const key of order) {
    const stage = stages.find((s) => s.stage_key === key);
    if (!stage || !isStageDone(stage.status)) return key;
  }
  return order[order.length - 1] ?? 'exploration';
}

/** Keeps non-empty, trimmed entries of a list field. */
export function cleanList(values: readonly string[]): string[] {
  return values.map((v) => v.trim()).filter(Boolean);
}
