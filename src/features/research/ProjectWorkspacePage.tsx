import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { JourneyTimeline } from '@/components/JourneyTimeline';
import { Alert, Card, LoadingState, PageHeader } from '@/components/ui';
import { STAGES, type StageKey } from '@/domain/constants';
import { membershipFor } from '@/domain/context';
import { firstOpenStage, viewerFor } from '@/domain/workspace';
import { toAppError } from '@/lib/errors';
import { getProjectWorkspace, type ProjectWorkspace } from '@/lib/research';
import { useActiveContext } from '../auth/authContext';
import { AnalysisStage } from './AnalysisStage';
import { EscalateButton } from './EscalateButton';
import { EvaluationStage } from './EvaluationStage';
import { ExplorationStage } from './ExplorationStage';
import { FinalStage } from './FinalStage';
import { ImplementationStage } from './ImplementationStage';
import { ObjectivesStage } from './ObjectivesStage';
import { PaperStage } from './PaperStage';
import { RepositoryStage } from './RepositoryStage';
import { WeeklyTasks } from './WeeklyTasks';
import { WritingStage } from './WritingStage';
import { WorkspaceContext, type WorkspaceValue } from './workspaceContext';

/** Every stage has its screen (S1–S5 since Phase 4, S6–S9 since Phase 6). */
const OPEN_STAGES: readonly StageKey[] = [
  'exploration',
  'paper_selection',
  'paper_analysis',
  'code_execution',
  'objectives',
  'implementation',
  'evaluation',
  'paper_writing',
  'final',
];

// Remounting a stage when its records change resets the form to the saved values.
function stageVersionKey(ws: ProjectWorkspace, key: StageKey): string {
  const stamp = (rows: { id: string; updated_at?: string; created_at?: string }[]) =>
    rows.map((r) => `${r.id}:${r.updated_at ?? r.created_at}`).join('|');
  switch (key) {
    case 'exploration':
      return ws.exploration ? stamp([ws.exploration]) : 'none';
    case 'paper_selection':
      return stamp(ws.papers);
    case 'paper_analysis':
      return stamp(ws.analyses) + stamp(ws.papers.filter((p) => p.is_selected));
    case 'code_execution':
      return stamp(ws.repositories);
    default:
      return stamp(ws.objectives);
  }
}

export function ProjectWorkspacePage() {
  const { projectId = '' } = useParams();
  const ctx = useActiveContext();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const workspace = useQuery({
    queryKey: ['workspace', projectId],
    queryFn: () => getProjectWorkspace(projectId),
  });

  const act = useCallback<WorkspaceValue['act']>(
    async (fn, success) => {
      setMessage(null);
      setBusy(true);
      try {
        await fn();
        setMessage({ tone: 'success', text: success });
        return true;
      } catch (err) {
        setMessage({ tone: 'error', text: toAppError(err).message });
        return false;
      } finally {
        setBusy(false);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['workspace', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['final', projectId] }),
          queryClient.invalidateQueries({ queryKey: ['review-queue'] }),
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
          queryClient.invalidateQueries({ queryKey: ['my-projects'] }),
          queryClient.invalidateQueries({ queryKey: ['overview'] }),
          queryClient.invalidateQueries({ queryKey: ['my-overview'] }),
          queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        ]);
      }
    },
    [projectId, queryClient],
  );

  const value = useMemo<WorkspaceValue | null>(() => {
    const ws = workspace.data;
    if (!ws) return null;
    return {
      ws,
      viewer: viewerFor(
        ctx,
        {
          semester_id: ws.project.semester_id,
          guide_id: ws.project.guide_id,
          student_user_id: ws.project.student_user_id,
          roster_status: ws.project.roster_status,
        },
        ws.coReviewerIds,
        ws.authorizedIds,
      ),
      readOnly: ws.semester?.status === 'closed',
      busy,
      act,
    };
  }, [workspace.data, ctx, busy, act]);

  if (workspace.isPending) return <LoadingState />;
  if (workspace.error || !value) {
    return (
      <div className="space-y-4">
        <PageHeader title="Project" />
        <Alert tone="error">
          {workspace.error?.message ?? 'Project not found, or you do not have access to it.'}
        </Alert>
        <Link to="/" className="text-sm text-blue-700 underline dark:text-blue-300">
          Back to home
        </Link>
      </div>
    );
  }

  const { ws, viewer } = value;
  const showTasks = params.get('view') === 'tasks';
  const requested = params.get('stage') as StageKey | null;
  const stage =
    requested && OPEN_STAGES.includes(requested)
      ? requested
      : firstOpenStage(ws.stages, OPEN_STAGES);
  const stageDef = STAGES.find((s) => s.key === stage);

  const body: Record<string, ReactNode> = {
    exploration: <ExplorationStage key={stageVersionKey(ws, 'exploration')} />,
    paper_selection: <PaperStage key={stageVersionKey(ws, 'paper_selection')} />,
    paper_analysis: <AnalysisStage key={stageVersionKey(ws, 'paper_analysis')} />,
    code_execution: <RepositoryStage key={stageVersionKey(ws, 'code_execution')} />,
    objectives: <ObjectivesStage key={stageVersionKey(ws, 'objectives')} />,
    implementation: <ImplementationStage />,
    evaluation: <EvaluationStage />,
    paper_writing: <WritingStage />,
    final: <FinalStage />,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      <section
        aria-label="Project summary"
        className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {ws.semester && (
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {ws.semester.name}
              </p>
            )}
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
              {ws.project.student_name ?? 'Project'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-700 dark:text-slate-200">
              {ws.project.title ? (
                <span className="italic">{ws.project.title}</span>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">No working title yet</span>
              )}
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-slate-500 dark:text-slate-400">Domain</dt>
                <dd className="font-medium">{ws.project.domain_name ?? 'No domain'}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-slate-500 dark:text-slate-400">Guide</dt>
                <dd className="font-medium">{ws.project.guide_name ?? 'not assigned'}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-slate-500 dark:text-slate-400">Stages approved</dt>
                <dd className="font-medium tabular-nums">
                  {
                    ws.stages.filter(
                      (x) => x.status === 'approved' || x.status === 'exception_approved',
                    ).length
                  }{' '}
                  of 9
                </dd>
              </div>
              {ws.stages.some((x) => x.status === 'awaiting_approval') && (
                <div className="flex gap-1.5">
                  <dt className="text-slate-500 dark:text-slate-400">Waiting for review</dt>
                  <dd className="font-medium tabular-nums text-amber-800 dark:text-amber-300">
                    {ws.stages.filter((x) => x.status === 'awaiting_approval').length}
                  </dd>
                </div>
              )}
              {ws.stages.some((x) => x.status === 'changes_requested') && (
                <div className="flex gap-1.5">
                  <dt className="text-slate-500 dark:text-slate-400">Changes requested</dt>
                  <dd className="font-medium tabular-nums text-amber-800 dark:text-amber-300">
                    {ws.stages.filter((x) => x.status === 'changes_requested').length}
                  </dd>
                </div>
              )}
            </dl>
          </div>
          {viewer.isFaculty && ws.project.semester_id && (
            <span className="flex flex-wrap items-start justify-end gap-3">
              {membershipFor(ctx, ws.project.semester_id)?.role === 'lead_faculty' &&
                ws.semester?.status === 'active' && <EscalateButton projectId={projectId} />}
              <Link
                to={`/semesters/${ws.project.semester_id}/projects`}
                className="pt-2 text-sm text-blue-700 underline dark:text-blue-300"
              >
                All projects
              </Link>
            </span>
          )}
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <JourneyTimeline
            label="Stages"
            stages={ws.stages.map((x) => ({ key: x.stage_key as StageKey, status: x.status }))}
            current={showTasks ? null : stage}
            isOpen={(key) => OPEN_STAGES.includes(key)}
            onSelect={(key) => {
              setMessage(null);
              setParams({ stage: key }, { replace: true });
            }}
          />
        </div>
      </section>

      <div
        role="tablist"
        aria-label="Project views"
        className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
      >
        {[
          { key: 'stages', label: 'Research stages', active: !showTasks },
          { key: 'tasks', label: 'Weekly tasks', active: showTasks },
        ].map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={v.active}
            onClick={() => {
              setMessage(null);
              setParams(v.key === 'tasks' ? { view: 'tasks' } : {}, { replace: true });
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${v.active ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      {value.readOnly && (
        <div className="mb-4">
          <Alert>This semester is closed. The project is read-only.</Alert>
        </div>
      )}

      {showTasks ? (
        <Card title="Weekly tasks">
          <WeeklyTasks openSubmissionId={params.get('submission')} />
        </Card>
      ) : (
        <Card title={stageDef ? `S${stageDef.no} · ${stageDef.name}` : undefined}>
          {body[stage]}
        </Card>
      )}
    </WorkspaceContext.Provider>
  );
}
