import type { Enums, Json, Tables } from './database.types';
import { AppError } from './errors';
import { profileNames, run, type ProjectRow } from './api';
import { requireSupabase } from './supabase';

// Phase 4: research stages S1–S5. Every change goes through a workflow function;
// the tables are read-only for the browser.

export type StageRow = Tables<'project_stages'>;
export type Exploration = Tables<'research_explorations'>;
export type Paper = Tables<'papers'>;
export type Analysis = Tables<'paper_analyses'>;
export type Repository = Tables<'code_repositories'>;
export type Attempt = Tables<'execution_attempts'>;
export type ObjectiveVersion = Tables<'objective_versions'>;
export type Evidence = Tables<'evidence'>;
export type Review = Tables<'reviews'>;
export type Correction = Tables<'corrections'>;
export type ReviewTarget = Enums<'review_target'>;
export type ReviewOutcome = Enums<'review_outcome'>;

export type WorkspaceSemester = Pick<
  Tables<'semesters'>,
  | 'id'
  | 'name'
  | 'status'
  | 'target_paper_year'
  | 'paper_change_cutoff_week'
  | 'start_date'
  | 'timezone'
  | 'week_count'
>;

export interface ProjectWorkspace {
  project: ProjectRow;
  semester: WorkspaceSemester | null;
  stages: StageRow[];
  exploration: Exploration | null;
  papers: Paper[];
  analyses: Analysis[];
  repositories: Repository[];
  attempts: Attempt[];
  objectives: ObjectiveVersion[];
  evidence: Evidence[];
  reviews: Review[];
  corrections: Correction[];
  /** Active co-reviewers and review authorizations (empty for students). */
  coReviewerIds: string[];
  authorizedIds: string[];
  names: Record<string, string>;
}

/** Everything the project page shows, in one round of parallel reads (RLS-filtered). */
export async function getProjectWorkspace(projectId: string): Promise<ProjectWorkspace> {
  const db = requireSupabase();
  const project = await run(db.from('v_projects').select('*').eq('id', projectId).maybeSingle());
  if (!project)
    throw new AppError('NOT_FOUND', 'Project not found, or you do not have access to it.');

  const [
    semester,
    stages,
    exploration,
    papers,
    analyses,
    repositories,
    attempts,
    objectives,
    evidence,
    reviews,
    corrections,
    coReviewers,
    authorizations,
  ] = await Promise.all([
    run(
      db
        .from('semesters')
        .select(
          'id, name, status, target_paper_year, paper_change_cutoff_week, start_date, timezone, week_count',
        )
        .eq('id', project.semester_id as string)
        .maybeSingle(),
    ),
    run(db.from('project_stages').select('*').eq('project_id', projectId)),
    run(db.from('research_explorations').select('*').eq('project_id', projectId).maybeSingle()),
    run(db.from('papers').select('*').eq('project_id', projectId).order('created_at')),
    run(db.from('paper_analyses').select('*').eq('project_id', projectId).order('version')),
    run(db.from('code_repositories').select('*').eq('project_id', projectId).order('created_at')),
    run(
      db.from('execution_attempts').select('*').eq('project_id', projectId).order('attempted_at'),
    ),
    run(db.from('objective_versions').select('*').eq('project_id', projectId).order('version')),
    run(db.from('evidence').select('*').eq('project_id', projectId).order('created_at')),
    run(db.from('reviews').select('*').eq('project_id', projectId).order('created_at')),
    run(db.from('corrections').select('*').eq('project_id', projectId).order('created_at')),
    run(
      db
        .from('project_reviewers')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('is_active', true),
    ),
    run(
      db
        .from('review_authorizations')
        .select('faculty_id, valid_until')
        .eq('project_id', projectId)
        .is('revoked_at', null),
    ),
  ]);

  const now = Date.now();
  const authorizedIds = (authorizations ?? [])
    .filter((a) => !a.valid_until || Date.parse(a.valid_until) > now)
    .map((a) => a.faculty_id);
  const names = await profileNames([
    ...(reviews ?? []).map((r) => r.reviewer_id),
    ...(corrections ?? []).flatMap((c) => (c.resolved_by ? [c.resolved_by] : [])),
    ...(evidence ?? []).flatMap((e) => (e.verified_by ? [e.verified_by] : [])),
    ...(stages ?? []).flatMap((s) => (s.approved_by ? [s.approved_by] : [])),
  ]);

  return {
    project,
    semester: semester ?? null,
    stages: stages ?? [],
    exploration: exploration ?? null,
    papers: papers ?? [],
    analyses: analyses ?? [],
    repositories: repositories ?? [],
    attempts: attempts ?? [],
    objectives: objectives ?? [],
    evidence: evidence ?? [],
    reviews: reviews ?? [],
    corrections: corrections ?? [],
    coReviewerIds: (coReviewers ?? []).map((r) => r.user_id),
    authorizedIds,
    names,
  };
}

// ---------------------------------------------------------------- student ----------
const db = () => requireSupabase();

export const saveExploration = (projectId: string, data: Record<string, unknown>) =>
  run(db().rpc('app_save_exploration', { p_project_id: projectId, p_data: data as Json }));

export const savePaper = (projectId: string, data: Record<string, unknown>, paperId?: string) =>
  run(
    db().rpc('app_save_paper', {
      p_project_id: projectId,
      p_data: data as Json,
      p_paper_id: paperId ?? undefined,
    }),
  );

export const selectPaper = (paperId: string) =>
  run(db().rpc('app_select_paper', { p_paper_id: paperId }));

export const withdrawPaper = (paperId: string, reason?: string) =>
  run(db().rpc('app_withdraw_paper', { p_paper_id: paperId, p_reason: reason ?? undefined }));

export const saveAnalysis = (paperId: string, data: Record<string, unknown>) =>
  run(db().rpc('app_save_analysis', { p_paper_id: paperId, p_data: data as Json }));

export const newAnalysisVersion = (paperId: string) =>
  run(db().rpc('app_new_analysis_version', { p_paper_id: paperId }));

export const saveRepository = (projectId: string, data: Record<string, unknown>) =>
  run(db().rpc('app_save_repository', { p_project_id: projectId, p_data: data as Json }));

export interface EvidenceInput {
  category: Enums<'evidence_category'>;
  url: string;
  description: string;
}

export const recordExecutionAttempt = (input: {
  repositoryId: string;
  attemptedAt: string;
  outcome: Enums<'attempt_outcome'>;
  errors?: string;
  debuggingNotes?: string;
  notes?: string;
  evidence: EvidenceInput[];
}) =>
  run(
    db().rpc('app_record_execution_attempt', {
      p_repository_id: input.repositoryId,
      p_attempted_at: input.attemptedAt,
      p_outcome: input.outcome,
      p_errors: input.errors || undefined,
      p_debugging_notes: input.debuggingNotes || undefined,
      p_notes: input.notes || undefined,
      p_evidence: input.evidence as unknown as Json,
    }),
  );

export const saveObjective = (projectId: string, data: Record<string, unknown>) =>
  run(db().rpc('app_save_objective', { p_project_id: projectId, p_data: data as Json }));

export const newObjectiveVersion = (projectId: string) =>
  run(db().rpc('app_new_objective_version', { p_project_id: projectId }));

export const addEvidence = (
  projectId: string,
  stageKey: Enums<'stage_key'>,
  input: EvidenceInput,
) =>
  run(
    db().rpc('app_add_evidence', {
      p_project_id: projectId,
      p_stage_key: stageKey,
      p_category: input.category,
      p_url: input.url,
      p_description: input.description,
    }),
  );

export const submitRecord = (targetType: ReviewTarget, targetId: string) =>
  run(db().rpc('app_submit_record', { p_target_type: targetType, p_target_id: targetId }));

export const addressCorrection = (correctionId: string, response: string) =>
  run(db().rpc('app_address_correction', { p_correction_id: correctionId, p_response: response }));

// ---------------------------------------------------------------- faculty ----------
export const recordReview = (input: {
  targetType: ReviewTarget;
  targetId: string;
  outcome: ReviewOutcome;
  observations?: string;
  comments?: string;
  corrections?: string[];
}) =>
  run(
    db().rpc('app_record_review', {
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_outcome: input.outcome,
      p_observations: input.observations || undefined,
      p_comments: input.comments || undefined,
      p_corrections: input.corrections ?? [],
    }),
  );

export const resolveCorrection = (
  correctionId: string,
  action: 'verify' | 'reopen' | 'waive',
  note?: string,
) =>
  run(
    db().rpc('app_resolve_correction', {
      p_correction_id: correctionId,
      p_action: action,
      p_note: note || undefined,
    }),
  );

export const verifyEvidence = (
  evidenceId: string,
  verification: Exclude<Enums<'evidence_verification'>, 'unverified'>,
  note?: string,
) =>
  run(
    db().rpc('app_verify_evidence', {
      p_evidence_id: evidenceId,
      p_verification: verification,
      p_note: note || undefined,
    }),
  );

export const approveStageException = (projectId: string, reason: string) =>
  run(
    db().rpc('app_approve_stage_exception', {
      p_project_id: projectId,
      p_stage_key: 'code_execution',
      p_reason: reason,
    }),
  );

export const overrideRule = (
  projectId: string,
  kind: 'duplicate_paper' | 'objective_gate',
  reason: string,
) => run(db().rpc('app_override', { p_project_id: projectId, p_kind: kind, p_reason: reason }));
