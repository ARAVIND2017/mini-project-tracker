import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StatusChip } from '@/components/StatusChip';
import {
  Alert,
  Button,
  LoadingState,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui';
import { STAGES } from '@/domain/constants';
import { formatInZone, teachingWeek, todayInZone } from '@/domain/semester';
import type { Enums } from '@/lib/database.types';
import type { EvidenceInput } from '@/lib/research';
import {
  getProjectTasks,
  setBlocked,
  startReview,
  startTask,
  submitTask,
  type ProjectTasks,
  type TaskRow,
} from '@/lib/tasks';
import { EvidenceItem } from './EvidenceSection';
import { EVIDENCE_LABELS, formatWhen } from './format';
import { ReviewSection } from './ReviewSection';
import { useWorkspace } from './workspaceContext';

const WAITING = ['submitted', 'resubmitted', 'under_review'];
const stageNo = (key: string | null) => STAGES.find((s) => s.key === key)?.no;

/** The 16-week timeline of the project's tasks, with submission and review for each. */
export function WeeklyTasks({ openSubmissionId }: { openSubmissionId: string | null }) {
  const { ws } = useWorkspace();
  const projectId = ws.project.id as string;
  const tasks = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => getProjectTasks(projectId, ws.project.semester_id as string),
  });
  const fromLink = tasks.data?.submissions.find((s) => s.id === openSubmissionId)?.task_id ?? null;
  const [openTask, setOpenTask] = useState<string | null>(null);
  const selected = openTask ?? fromLink;

  if (tasks.isPending) return <LoadingState />;
  if (tasks.error) return <Alert tone="error">{tasks.error.message}</Alert>;

  const zone = ws.semester?.timezone ?? 'Asia/Kolkata';
  const current = teachingWeek(ws.semester?.start_date ?? null, todayInZone(zone));
  const weeks = [...new Set(tasks.data.tasks.map((t) => t.week_no as number))].sort(
    (a, b) => a - b,
  );
  const counts = {
    verified: tasks.data.tasks.filter((t) => t.status === 'verified').length,
    overdue: tasks.data.tasks.filter((t) => t.is_overdue).length,
    late: tasks.data.submissions.filter((s) => s.is_late).length,
    onTime: tasks.data.submissions.filter((s) => !s.is_late).length,
  };

  if (tasks.data.tasks.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        No weekly tasks yet. Tasks are created from the semester plan when the semester is active
        and has a start date.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span>
          <strong>{counts.verified}</strong> of {tasks.data.tasks.length} verified
        </span>
        <span>
          <strong>{counts.overdue}</strong> overdue
        </span>
        <span>
          Submissions: <strong>{counts.onTime}</strong> on time, <strong>{counts.late}</strong> late
        </span>
        {current > 0 && (
          <span>
            Current week: <strong>{current}</strong>
          </span>
        )}
      </div>
      <ol className="space-y-4">
        {weeks.map((week) => {
          const milestone = tasks.data.milestones.find((m) => m.week_no === week);
          return (
            <li
              key={week}
              aria-label={`Week ${week}`}
              className={`rounded-md border p-3 ${week === current ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-800'}`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">
                  Week {week}
                  {milestone && ` · ${milestone.title}`}
                </h3>
                {week === current && (
                  <span className="text-xs font-medium text-blue-800 dark:text-blue-300">
                    • This week
                  </span>
                )}
                {milestone?.is_gate && milestone.checkpoint && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-300 dark:bg-amber-950 dark:text-amber-200">
                    ! {milestone.checkpoint}
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {tasks.data.tasks
                  .filter((t) => t.week_no === week)
                  .map((t) => (
                    <TaskItem
                      key={t.id}
                      task={t}
                      data={tasks.data}
                      zone={zone}
                      open={selected === t.id}
                      onToggle={() => setOpenTask(selected === t.id ? '' : (t.id as string))}
                    />
                  ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TaskItem({
  task: t,
  data,
  zone,
  open,
  onToggle,
}: {
  task: TaskRow;
  data: ProjectTasks;
  zone: string;
  open: boolean;
  onToggle: () => void;
}) {
  const submissions = data.submissions.filter((s) => s.task_id === t.id);
  return (
    <li className="rounded-md bg-slate-50 dark:bg-slate-800/40">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-2 p-2 text-left text-sm"
      >
        <span className="text-xs text-slate-500 dark:text-slate-400">S{stageNo(t.stage_key)}</span>
        <span className="font-medium">{t.title}</span>
        {t.status && <StatusChip family="task_status" value={t.status} />}
        {t.is_overdue && (
          <span className="text-xs font-medium text-red-800 dark:text-red-300">✕ Overdue</span>
        )}
        {t.blocked && (
          <span className="text-xs font-medium text-red-800 dark:text-red-300">✕ Blocked</span>
        )}
        {(t.outstanding_corrections ?? 0) > 0 && (
          <span className="text-xs text-amber-800 dark:text-amber-300">
            ! {t.outstanding_corrections} correction(s)
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          Due {t.due_at ? formatInZone(t.due_at, zone) : '—'}
          {submissions.length > 0 && ` · ${submissions.length} version(s)`}
        </span>
      </button>
      {open && <TaskDetail task={t} data={data} zone={zone} />}
    </li>
  );
}

function TaskDetail({ task: t, data, zone }: { task: TaskRow; data: ProjectTasks; zone: string }) {
  const { ws, viewer, readOnly, busy, act } = useWorkspace();
  const submissions = data.submissions.filter((s) => s.task_id === t.id);
  const latest = submissions[submissions.length - 1];
  const waiting = WAITING.includes(t.status ?? '');
  const canSubmit = viewer.isStudent && !readOnly && !waiting && t.status !== 'verified';
  const [checked, setChecked] = useState<string[]>([]);
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-4 border-t border-slate-200 p-3 text-sm dark:border-slate-700">
      {t.description && <p>{t.description}</p>}
      <fieldset>
        <legend className="font-medium">Acceptance criteria</legend>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tick them off for yourself; the reviewer decides.
        </p>
        <ul className="mt-1 space-y-1">
          {(t.acceptance_criteria ?? []).map((c) => (
            <li key={c}>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked.includes(c)}
                  onChange={(e) =>
                    setChecked(e.target.checked ? [...checked, c] : checked.filter((x) => x !== c))
                  }
                />
                {c}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {(t.required_evidence ?? []).length > 0 && (
        <p>
          <span className="font-medium">Evidence expected:</span>{' '}
          {(t.required_evidence ?? []).map((e) => EVIDENCE_LABELS[e]).join(', ')}
        </p>
      )}
      {t.blocked && (
        <Alert tone="error">
          Blocked: {t.blocked_reason} {t.blocked_at && `(since ${formatWhen(t.blocked_at)})`}
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {viewer.isStudent && !readOnly && t.status === 'not_started' && (
          <Button
            variant="secondary"
            busy={busy}
            onClick={() => act(() => startTask(t.id as string), 'Task started.')}
          >
            Start this task
          </Button>
        )}
        {viewer.isReviewer &&
          !readOnly &&
          latest &&
          (t.status === 'submitted' || t.status === 'resubmitted') && (
            <Button
              variant="secondary"
              busy={busy}
              onClick={() => act(() => startReview(latest.id), 'Review started.')}
            >
              Start review
            </Button>
          )}
        {(viewer.isStudent || viewer.isReviewer) && !readOnly && !blocking && (
          <Button
            variant="secondary"
            busy={busy}
            onClick={() =>
              t.blocked
                ? act(() => setBlocked('task', t.id as string, false), 'Task unblocked.')
                : setBlocking(true)
            }
          >
            {t.blocked ? 'Mark as unblocked' : 'Mark as blocked'}
          </Button>
        )}
      </div>
      {blocking && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act(
                () => setBlocked('task', t.id as string, true, reason),
                'Task marked as blocked.',
              )
            )
              setBlocking(false);
          }}
        >
          <TextField
            className="min-w-64 flex-1"
            label="What is blocking it?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button type="submit" busy={busy}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={() => setBlocking(false)}>
            Cancel
          </Button>
        </form>
      )}

      {canSubmit && (
        <SubmitForm task={t} resubmission={t.status === 'changes_requested'} zone={zone} />
      )}
      {viewer.isStudent && waiting && (
        <p className="text-slate-600 dark:text-slate-300">
          Submitted. Waiting for your guide's review.
        </p>
      )}

      {submissions.length > 0 && (
        <section aria-label="Submitted versions">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Submitted versions
          </h4>
          <ol className="mt-2 space-y-3">
            {[...submissions].reverse().map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Version {s.version}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatWhen(s.submitted_at)}
                  </span>
                  {s.is_late ? (
                    <span className="text-xs font-medium text-red-800 dark:text-red-300">
                      ✕ Late
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-green-800 dark:text-green-300">
                      ✓ On time
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line">{s.progress_report}</p>
                <ul className="mt-2 space-y-2">
                  {data.submissionEvidence
                    .filter((x) => x.submission_id === s.id)
                    .map((x) => ws.evidence.find((e) => e.id === x.evidence_id))
                    .filter((e) => e !== undefined)
                    .map((e) => (
                      <EvidenceItem key={e.id} evidence={e} />
                    ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}

      {latest && (
        <ReviewSection
          targetType="task_submission"
          targetIds={submissions.map((s) => s.id)}
          currentId={latest.id}
          awaiting={waiting}
          label={`week ${t.week_no} task`}
        />
      )}
    </div>
  );
}

function SubmitForm({
  task: t,
  resubmission,
  zone,
}: {
  task: TaskRow;
  resubmission: boolean;
  zone: string;
}) {
  const { busy, act } = useWorkspace();
  const [report, setReport] = useState('');
  const firstKind: Enums<'evidence_category'> = t.required_evidence?.[0] ?? 'other';
  const [evidence, setEvidence] = useState<EvidenceInput[]>([
    { category: firstKind, url: '', description: '' },
  ]);
  const [openedAt] = useState(() => Date.now());
  const late = t.due_at ? openedAt > Date.parse(t.due_at) : false;
  const kinds = [...new Set([...(t.required_evidence ?? []), 'other' as const])];

  return (
    <form
      aria-label={resubmission ? 'Resubmit the task' : 'Submit the task'}
      className="space-y-3 rounded-md border border-dashed border-slate-300 p-3 dark:border-slate-700"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await act(
          () =>
            submitTask(
              t.id as string,
              report,
              evidence.filter((x) => x.url.trim() || x.description.trim()),
            ),
          resubmission ? 'Task resubmitted.' : 'Task submitted.',
        );
        if (ok) setReport('');
      }}
    >
      <h4 className="font-semibold">
        {resubmission ? 'Resubmit after corrections' : 'Submit this week’s work'}
      </h4>
      {late && (
        <Alert tone="error">
          The deadline ({t.due_at && formatInZone(t.due_at, zone)}) has passed. You can still
          submit; the submission will be recorded as late.
        </Alert>
      )}
      <TextAreaField
        label="Progress report"
        hint={`What you did, what is left and any problems. At least 100 characters (${report.trim().length} so far).`}
        rows={5}
        value={report}
        onChange={(e) => setReport(e.target.value)}
      />
      <fieldset>
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Evidence links
        </legend>
        <div className="mt-1 space-y-2">
          {evidence.map((x, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[11rem_1fr_1fr]">
              <SelectField
                label={`Link ${i + 1} kind`}
                value={x.category}
                onChange={(e) =>
                  setEvidence(
                    evidence.map((y, j) =>
                      j === i
                        ? { ...y, category: e.target.value as Enums<'evidence_category'> }
                        : y,
                    ),
                  )
                }
              >
                {kinds.map((c) => (
                  <option key={c} value={c}>
                    {EVIDENCE_LABELS[c]}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={`Link ${i + 1}`}
                placeholder="https://drive.google.com/…"
                value={x.url}
                onChange={(e) =>
                  setEvidence(evidence.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))
                }
              />
              <TextField
                label={`Link ${i + 1} description`}
                value={x.description}
                onChange={(e) =>
                  setEvidence(
                    evidence.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)),
                  )
                }
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
          onClick={() =>
            setEvidence([...evidence, { category: 'other', url: '', description: '' }])
          }
        >
          + Add a link
        </button>
      </fieldset>
      <Button type="submit" busy={busy}>
        {resubmission ? 'Resubmit' : 'Submit for review'}
      </Button>
    </form>
  );
}
