import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusChip } from '@/components/StatusChip';
import { profileNames } from '@/lib/api';
import {
  getLatestReview,
  getMyOverview,
  getProjectTimeliness,
  listProjectOutcomes,
} from '@/lib/reports';
import { formatWhen } from '../research/format';

const TARGET_LABELS: Record<string, string> = {
  exploration: 'Exploration (S1)',
  paper: 'Paper (S2)',
  paper_analysis: 'Paper analysis (S3)',
  repository: 'Code execution (S4)',
  objective: 'Objectives (S5)',
  task_submission: 'Weekly task',
  evaluation: 'Evaluation results (S7)',
  draft_section: 'Paper section (S8)',
  final: 'Final submission (S9)',
};

/** The student's dashboard (UI_UX_SPEC S1): progress, latest feedback, timeliness, meetings. */
export function StudentProgress({ projectId, userId }: { projectId: string; userId: string }) {
  const overview = useQuery({
    queryKey: ['my-overview', userId],
    queryFn: () => getMyOverview(userId),
  });
  const review = useQuery({
    queryKey: ['latest-review', projectId],
    queryFn: () => getLatestReview(projectId),
  });
  const reviewer = useQuery({
    queryKey: ['names', review.data?.reviewer_id],
    queryFn: () => profileNames([review.data?.reviewer_id ?? '']),
    enabled: !!review.data,
  });
  const timeliness = useQuery({
    queryKey: ['timeliness', 'project', projectId],
    queryFn: () => getProjectTimeliness(projectId),
  });
  const outcomes = useQuery({
    queryKey: ['outcomes', projectId],
    queryFn: () => listProjectOutcomes(projectId),
  });
  const row = overview.data?.find((p) => p.id === projectId);
  const t = timeliness.data;
  const r = review.data;

  return (
    <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 dark:border-slate-800">
      <section aria-label="Progress">
        <h3 className="mb-1 text-sm font-semibold">Progress</h3>
        <ProgressBar value={row?.progress} breakdown={row?.progress_breakdown} />
        {row && ((row.open_corrections ?? 0) > 0 || (row.overdue_tasks ?? 0) > 0) && (
          <p className="mt-2 text-sm">
            {(row.open_corrections ?? 0) > 0 && (
              <span className="mr-3 text-amber-800 dark:text-amber-300">
                ! {row.open_corrections} correction(s) to address
              </span>
            )}
            {(row.overdue_tasks ?? 0) > 0 && (
              <Link
                to={`/projects/${projectId}?view=tasks`}
                className="text-red-800 underline dark:text-red-300"
              >
                ✕ {row.overdue_tasks} overdue task(s)
              </Link>
            )}
          </p>
        )}
      </section>
      <section aria-label="Latest feedback">
        <h3 className="mb-1 text-sm font-semibold">Latest feedback</h3>
        {!r ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">No reviews yet.</p>
        ) : (
          <div className="text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip family="review_outcome" value={r.outcome} />
              <span>{TARGET_LABELS[r.target_type] ?? r.target_type}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {reviewer.data?.[r.reviewer_id] ?? 'Faculty member'} · {formatWhen(r.created_at)}
            </p>
            {(r.observations || r.comments) && (
              <p className="mt-1 line-clamp-3 whitespace-pre-line">
                {r.observations || r.comments}
              </p>
            )}
          </div>
        )}
      </section>
      <section aria-label="Timeliness">
        <h3 className="mb-1 text-sm font-semibold">Timeliness</h3>
        {!t || !t.tasks_due ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No task deadlines have passed yet.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Tasks due so far</dt>
            <dd className="tabular-nums">{t.tasks_due}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Submitted on time</dt>
            <dd className="tabular-nums">{t.submitted_on_time}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Submitted late</dt>
            <dd className="tabular-nums">
              {t.submitted_late}
              {t.avg_days_late != null && ` (avg. ${t.avg_days_late} d)`}
            </dd>
            <dt className="text-slate-500 dark:text-slate-400">Overdue, not submitted</dt>
            <dd className="tabular-nums">{t.overdue_without_submission}</dd>
          </dl>
        )}
      </section>
      <section aria-label="Meeting outcomes">
        <h3 className="mb-1 text-sm font-semibold">Meeting outcomes</h3>
        {(outcomes.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">None recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(outcomes.data ?? []).slice(0, 3).map((o) => (
              <li key={o.id}>
                <span className="font-medium">{o.meeting?.title}</span>{' '}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatWhen(o.meeting?.held_on)}
                </span>
                <p className="whitespace-pre-line">{o.outcome}</p>
                {o.action_items.length > 0 && (
                  <ul className="list-disc pl-5 text-xs">
                    {o.action_items.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
