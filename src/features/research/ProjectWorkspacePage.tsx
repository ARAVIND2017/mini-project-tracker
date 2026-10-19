import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { StatusChip } from '@/components/StatusChip';
import { Alert, Card, LoadingState, PageHeader } from '@/components/ui';
import { STAGES, type StageKey } from '@/domain/constants';
import { firstOpenStage, viewerFor } from '@/domain/workspace';
import { toAppError } from '@/lib/errors';
import { getProjectWorkspace, type ProjectWorkspace } from '@/lib/research';
import { useActiveContext } from '../auth/authContext';
import { AnalysisStage } from './AnalysisStage';
import { ExplorationStage } from './ExplorationStage';
import { ObjectivesStage } from './ObjectivesStage';
import { PaperStage } from './PaperStage';
import { RepositoryStage } from './RepositoryStage';
import { WeeklyTasks } from './WeeklyTasks';
import { WorkspaceContext, type WorkspaceValue } from './workspaceContext';

/** Stages with screens in this release (Phase 4). S6–S9 follow in Phases 5–6. */
const OPEN_STAGES: readonly StageKey[] = [
  'exploration',
  'paper_selection',
  'paper_analysis',
  'code_execution',
  'objectives',
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
          queryClient.invalidateQueries({ queryKey: ['review-queue'] }),
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
          queryClient.invalidateQueries({ queryKey: ['my-projects'] }),
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
  const statusOf = (key: StageKey) =>
    ws.stages.find((s) => s.stage_key === key)?.status ?? 'not_started';

  const body: Record<string, ReactNode> = {
    exploration: <ExplorationStage key={stageVersionKey(ws, 'exploration')} />,
    paper_selection: <PaperStage key={stageVersionKey(ws, 'paper_selection')} />,
    paper_analysis: <AnalysisStage key={stageVersionKey(ws, 'paper_analysis')} />,
    code_execution: <RepositoryStage key={stageVersionKey(ws, 'code_execution')} />,
    objectives: <ObjectivesStage key={stageVersionKey(ws, 'objectives')} />,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      <PageHeader
        title={ws.project.student_name ?? 'Project'}
        description={
          <>
            {ws.project.title ? (
              <span className="italic">{ws.project.title}</span>
            ) : (
              'No working title yet'
            )}
            {' · '}
            {ws.project.domain_name ?? 'No domain'} · Guide:{' '}
            {ws.project.guide_name ?? 'not assigned'}
            {ws.semester && ` · ${ws.semester.name}`}
          </>
        }
        actions={
          viewer.isFaculty && ws.project.semester_id ? (
            <Link
              to={`/semesters/${ws.project.semester_id}/projects`}
              className="text-sm text-blue-700 underline dark:text-blue-300"
            >
              All projects
            </Link>
          ) : undefined
        }
      />

      <div role="tablist" aria-label="Project views" className="mb-4 flex gap-2">
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
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${v.active ? 'bg-blue-700 text-white dark:bg-blue-600' : 'text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <nav aria-label="Stages" className="mb-6">
        <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {STAGES.map((s) => {
            const open = OPEN_STAGES.includes(s.key);
            const current = s.key === stage;
            const content = (
              <>
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  S{s.no}
                </span>
                <span className="block text-sm font-medium">{s.name}</span>
                <span className="mt-1 block">
                  <StatusChip family="stage_status" value={statusOf(s.key)} />
                </span>
              </>
            );
            return (
              <li key={s.key}>
                {open ? (
                  <button
                    type="button"
                    aria-current={current && !showTasks ? 'step' : undefined}
                    onClick={() => {
                      setMessage(null);
                      setParams({ stage: s.key }, { replace: true });
                    }}
                    className={`h-full w-full rounded-md border p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${current && !showTasks ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200 dark:border-slate-800'}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    className="h-full rounded-md border border-dashed border-slate-200 p-2 opacity-70 dark:border-slate-800"
                    title="This stage opens in a later release"
                  >
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

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
