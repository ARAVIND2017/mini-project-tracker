import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { ProgressBar } from '@/components/ProgressBar';
import { Alert, Card, LoadingState } from '@/components/ui';
import { STAGES } from '@/domain/constants';
import { isHod, membershipFor } from '@/domain/context';
import {
  averageProgress,
  countable,
  domainStageMatrix,
  FLAGS,
  flagCounts,
  heatLevel,
  projectsLink,
  stageFunnel,
  type Flag,
} from '@/domain/dashboard';
import { itemLink, waitedFor } from '@/domain/queue';
import {
  listOverview,
  listTaskFlags,
  listTimeliness,
  listWorkload,
  type OverviewRow,
} from '@/lib/reports';
import { listReviewQueue } from '@/lib/tasks';
import { useActiveContext } from '../auth/authContext';
import { formatWhen } from '../research/format';
import { OVERVIEW_COLUMNS, TIMELINESS_COLUMNS } from './exportColumns';

const HEAT = [
  '',
  'bg-blue-50 dark:bg-blue-950',
  'bg-blue-100 dark:bg-blue-900',
  'bg-blue-200 dark:bg-blue-800',
  'bg-blue-300 dark:bg-blue-700',
];

/**
 * The semester dashboard (UI_UX_SPEC H1 / L1 / F1). The HOD and the lead see the whole
 * semester; other faculty see their own students and queue. Every number links to the
 * filtered list behind it (UI-02).
 */
export function SemesterDashboard({ semesterId }: { semesterId: string }) {
  const ctx = useActiveContext();
  const overall =
    isHod(ctx) ||
    ctx.system_roles.some((r) => r.role === 'admin') ||
    membershipFor(ctx, semesterId)?.role === 'lead_faculty';
  const overview = useQuery({
    queryKey: ['overview', semesterId],
    queryFn: () => listOverview(semesterId),
  });

  if (overview.isPending) return <LoadingState label="Loading the dashboard…" />;
  if (overview.error) return <Alert tone="error">{overview.error.message}</Alert>;
  return overall ? (
    <OverallDashboard semesterId={semesterId} rows={overview.data} />
  ) : (
    <FacultyDashboard semesterId={semesterId} rows={overview.data} userId={ctx.user_id} />
  );
}

function KpiTile({
  to,
  value,
  label,
  tone,
}: {
  to: string;
  value: ReactNode;
  label: string;
  tone?: 'warn';
}) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
    >
      <span
        className={`block text-2xl font-semibold tabular-nums ${tone === 'warn' ? 'text-amber-800 dark:text-amber-300' : ''}`}
      >
        {value}
      </span>
      <span className="block text-sm text-slate-600 dark:text-slate-300">{label}</span>
    </Link>
  );
}

const KPI_FLAGS: Flag[] = [
  'no_guide',
  'overdue',
  'blocked',
  'awaiting',
  'corrections',
  'completed',
];

function OverallDashboard({ semesterId, rows: all }: { semesterId: string; rows: OverviewRow[] }) {
  const [now] = useState(() => Date.now());
  const rows = countable(all);
  const counts = flagCounts(rows);
  const funnel = stageFunnel(rows);
  const maxStage = Math.max(1, ...funnel.map((s) => s.count));
  const matrix = domainStageMatrix(rows);
  const maxCell = Math.max(0, ...matrix.flatMap((d) => d.cells));
  const gateOk = rows.filter((p) => {
    const s = (p.stage_statuses as Record<string, string> | null)?.objectives;
    return s === 'approved' || s === 'exception_approved';
  }).length;
  const workload = useQuery({
    queryKey: ['workload', semesterId],
    queryFn: () => listWorkload(semesterId),
  });
  const flags = useQuery({
    queryKey: ['task-flags', semesterId],
    queryFn: () => listTaskFlags(semesterId),
  });
  const timeliness = useQuery({
    queryKey: ['timeliness', semesterId],
    queryFn: () => listTimeliness(semesterId),
  });
  const byId = new Map(all.map((p) => [p.id, p]));
  const oldCorrections = rows
    .filter((p) => p.oldest_open_correction)
    .sort(
      (a, b) =>
        Date.parse(a.oldest_open_correction ?? '') - Date.parse(b.oldest_open_correction ?? ''),
    )
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile to={projectsLink(semesterId)} value={rows.length} label="Projects" />
        <KpiTile
          to={projectsLink(semesterId)}
          value={averageProgress(rows) == null ? '—' : `${averageProgress(rows)}%`}
          label="Average progress"
        />
        {KPI_FLAGS.map((f) => (
          <KpiTile
            key={f}
            to={projectsLink(semesterId, { flag: f })}
            value={counts[f]}
            label={FLAGS[f]}
            tone={counts[f] > 0 && f !== 'completed' ? 'warn' : undefined}
          />
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Stage funnel">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Where each project is now (its first stage not yet approved). Objectives gate (S5):{' '}
            <strong>{gateOk}</strong> of {rows.length} approved.
          </p>
          <ul className="space-y-1.5">
            {funnel.map((s) => (
              <li key={s.key}>
                <Link
                  to={projectsLink(semesterId, { stage: s.key })}
                  className="grid grid-cols-[minmax(0,11rem)_1fr_2rem] items-center gap-2 text-sm hover:underline"
                >
                  <span className="truncate">{s.label}</span>
                  <span className="h-3 rounded bg-slate-100 dark:bg-slate-800">
                    <span
                      className="block h-3 rounded bg-blue-700 dark:bg-blue-400"
                      style={{ width: `${(s.count / maxStage) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums">{s.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Needs attention">
          <h3 className="text-sm font-semibold">Overdue and blocked tasks</h3>
          {flags.isPending ? (
            <LoadingState />
          ) : (flags.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">None.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {(flags.data ?? []).slice(0, 8).map((t) => (
                <li key={t.task_id}>
                  <Link
                    to={`/projects/${t.project_id}?view=tasks`}
                    className="text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                  >
                    {t.student_name ?? `Slot ${t.slot_no}`}
                  </Link>{' '}
                  · week {t.week_no}: {t.title} ·{' '}
                  <span className="text-red-800 dark:text-red-300">
                    {t.blocked ? '✕ blocked' : `✕ ${t.days_overdue} d overdue`}
                  </span>
                </li>
              ))}
              {(flags.data ?? []).length > 8 && (
                <li>
                  <Link
                    to={projectsLink(semesterId, { flag: 'overdue' })}
                    className="text-blue-700 underline dark:text-blue-300"
                  >
                    All {(flags.data ?? []).length} flagged tasks →
                  </Link>
                </li>
              )}
            </ul>
          )}
          <h3 className="mt-4 text-sm font-semibold">Oldest open corrections</h3>
          {oldCorrections.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">None.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {oldCorrections.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}`}
                    className="text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                  >
                    {p.student_name ?? `Slot ${p.slot_no}`}
                  </Link>{' '}
                  · {p.open_corrections} open · oldest {waitedFor(p.oldest_open_correction, now)}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Domains × stages">
        <div className="-mx-4 overflow-x-auto">
          <table className="min-w-full text-center text-sm">
            <caption className="sr-only">Number of projects in each domain at each stage</caption>
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Domain
                </th>
                {STAGES.map((s) => (
                  <th key={s.key} scope="col" className="px-2 py-2 font-medium" title={s.name}>
                    S{s.no}
                  </th>
                ))}
                <th scope="col" className="px-2 py-2 font-medium">
                  Done
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((d) => (
                <tr key={d.id} className="border-t border-slate-200 dark:border-slate-800">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">
                    {d.name}
                  </th>
                  {d.cells.map((n, i) => {
                    const stage = STAGES[i];
                    return (
                      <td
                        key={stage?.key}
                        className={`px-2 py-1.5 tabular-nums ${HEAT[heatLevel(n, maxCell)]}`}
                      >
                        {n > 0 && stage ? (
                          <Link
                            to={projectsLink(semesterId, { domain: d.id, stage: stage.key })}
                            className="underline-offset-2 hover:underline"
                            aria-label={`${n} in ${d.name} at S${stage.no}`}
                          >
                            {n}
                          </Link>
                        ) : (
                          <span className="text-slate-400">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 tabular-nums">
                    {d.complete || <span className="text-slate-400">·</span>}
                  </td>
                  <td className="px-3 py-1.5 font-medium tabular-nums">
                    <Link
                      to={projectsLink(semesterId, { domain: d.id })}
                      className="underline-offset-2 hover:underline"
                    >
                      {d.total}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Faculty workload">
        {workload.isPending ? (
          <LoadingState />
        ) : workload.error ? (
          <Alert tone="error">{workload.error.message}</Alert>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Faculty</th>
                  <th className="px-4 py-2 text-right font-medium">Guides</th>
                  <th className="px-4 py-2 text-right font-medium">Co-reviews</th>
                  <th className="px-4 py-2 text-right font-medium">Waiting for review</th>
                  <th className="px-4 py-2 font-medium">Oldest wait</th>
                  <th className="px-4 py-2 text-right font-medium">Corrections to verify</th>
                  <th className="px-4 py-2 text-right font-medium">Avg. turnaround</th>
                  <th className="px-4 py-2 text-right font-medium">Reviews (7 days)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(workload.data ?? []).map((w) => (
                  <tr key={w.user_id}>
                    <td className="px-4 py-2">
                      {w.full_name}
                      <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                        {w.role === 'hod' ? 'HOD' : w.role === 'lead_faculty' ? 'Lead' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <Link
                        to={projectsLink(semesterId, { guide: w.user_id ?? '' })}
                        className="underline-offset-2 hover:underline"
                      >
                        {w.guided_projects}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{w.co_reviewed_projects}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{w.pending_reviews}</td>
                    <td className="px-4 py-2">{waitedFor(w.oldest_waiting_since, now)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{w.corrections_to_verify}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {w.avg_turnaround_hours == null
                        ? '—'
                        : w.avg_turnaround_hours >= 24
                          ? `${(w.avg_turnaround_hours / 24).toFixed(1)} d`
                          : `${w.avg_turnaround_hours} h`}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{w.reviews_last_7_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Reports">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          CSV files for spreadsheets. The review queue and the audit log have their own exports.
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton
            rows={all}
            columns={OVERVIEW_COLUMNS}
            name="project-overview"
            label="Project overview (CSV)"
          />
          <ExportCsvButton
            rows={(timeliness.data ?? []).map((t) => ({ ...t, project: byId.get(t.project_id) }))}
            columns={TIMELINESS_COLUMNS}
            name="timeliness"
            label="Timeliness (CSV)"
          />
        </div>
      </Card>
    </div>
  );
}

function FacultyDashboard({
  semesterId,
  rows,
  userId,
}: {
  semesterId: string;
  rows: OverviewRow[];
  userId: string;
}) {
  const [now] = useState(() => Date.now());
  const mine = countable(rows).filter((p) => p.guide_id === userId);
  const queue = useQuery({
    queryKey: ['review-queue', semesterId],
    queryFn: () => listReviewQueue(semesterId),
  });
  const myQueue = (queue.data ?? []).filter((i) => (i.reviewer_ids ?? []).includes(userId));
  const counts = flagCounts(mine);

  return (
    <div className="space-y-6">
      <section aria-label="My review queue" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          to={`/semesters/${semesterId}/review-queue`}
          value={queue.isPending ? '…' : myQueue.filter((i) => i.item_type === 'submission').length}
          label="Task submissions to review"
        />
        <KpiTile
          to={`/semesters/${semesterId}/review-queue`}
          value={queue.isPending ? '…' : myQueue.filter((i) => i.item_type === 'record').length}
          label="Stage records to review"
        />
        <KpiTile
          to={`/semesters/${semesterId}/review-queue`}
          value={queue.isPending ? '…' : myQueue.filter((i) => i.item_type === 'correction').length}
          label="Corrections to verify"
        />
        <KpiTile
          to={projectsLink(semesterId, { guide: userId, flag: 'overdue' })}
          value={counts.overdue}
          label="My students with overdue tasks"
          tone={counts.overdue > 0 ? 'warn' : undefined}
        />
      </section>
      {myQueue.length > 0 && (
        <Card title="Oldest waiting">
          <ul className="space-y-1 text-sm">
            {[...myQueue]
              .sort((a, b) => Date.parse(a.waiting_since ?? '') - Date.parse(b.waiting_since ?? ''))
              .slice(0, 5)
              .map((i) => (
                <li key={`${i.item_type}-${i.item_id}`}>
                  <Link
                    to={itemLink(i)}
                    className="text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                  >
                    {i.student_name ?? `Slot ${i.slot_no}`}: {i.title}
                  </Link>{' '}
                  · waiting {waitedFor(i.waiting_since, now)}
                </li>
              ))}
          </ul>
        </Card>
      )}
      <Card
        title="My students"
        actions={
          <Link
            to={projectsLink(semesterId, { guide: userId })}
            className="text-sm text-blue-700 underline dark:text-blue-300"
          >
            Open as a list
          </Link>
        }
      >
        {mine.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You do not guide any project in this semester yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {mine.map((p) => {
              const stage = STAGES.find((s) => s.key === p.current_stage);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
                >
                  <span>
                    <Link
                      to={`/projects/${p.id}`}
                      className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                    >
                      {p.student_name ?? `Slot ${p.slot_no}`}
                    </Link>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {stage ? `S${stage.no} ${stage.name}` : 'All stages complete'} · last activity{' '}
                      {formatWhen(p.last_activity)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3">
                    {(p.awaiting_review ?? 0) > 0 && (
                      <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        ! {p.awaiting_review} waiting for review
                      </span>
                    )}
                    {(p.overdue_tasks ?? 0) > 0 && (
                      <span className="text-xs font-medium text-red-800 dark:text-red-300">
                        ✕ {p.overdue_tasks} overdue
                      </span>
                    )}
                    <ProgressBar value={p.progress} compact />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
