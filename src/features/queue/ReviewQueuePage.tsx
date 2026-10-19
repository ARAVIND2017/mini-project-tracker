import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, Card, LoadingState, SelectField } from '@/components/ui';
import { STAGES } from '@/domain/constants';
import { isHod, membershipFor } from '@/domain/context';
import { itemLink, waitedFor } from '@/domain/queue';
import { listReviewQueue } from '@/lib/tasks';
import { useActiveContext } from '../auth/authContext';
import { SemesterNav } from '../semesters/SemesterNav';
import { StaffOnly } from '../semesters/StaffOnly';

const TYPES = [
  { value: '', label: 'Everything' },
  { value: 'submission', label: 'Weekly task submissions' },
  { value: 'record', label: 'Stage records (papers, analyses, …)' },
  { value: 'correction', label: 'Corrections to verify' },
];

export function ReviewQueuePage() {
  return (
    <StaffOnly>
      <QueueContent />
    </StaffOnly>
  );
}

function QueueContent() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const everything = isHod(ctx) || membershipFor(ctx, semesterId)?.role === 'lead_faculty';
  const [scope, setScope] = useState<'mine' | 'all'>(everything ? 'all' : 'mine');
  const [type, setType] = useState('');
  const [now] = useState(() => Date.now());
  const queue = useQuery({
    queryKey: ['review-queue', semesterId],
    queryFn: () => listReviewQueue(semesterId),
  });

  if (queue.isPending) {
    return (
      <>
        <SemesterNav />
        <LoadingState />
      </>
    );
  }
  if (queue.error) return <Alert tone="error">{queue.error.message}</Alert>;

  const rows = queue.data.filter(
    (i) =>
      (scope === 'all' || (i.reviewer_ids ?? []).includes(ctx.user_id)) &&
      (!type || i.item_type === type),
  );

  return (
    <div>
      <SemesterNav />
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Everything waiting for a reviewer, oldest first. "Mine" lists projects you guide, co-review
        or are authorized to review
        {everything ? '; as lead or HOD you can review every project.' : '.'}
      </p>
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div role="tablist" aria-label="Whose items" className="flex gap-2">
            {(['mine', 'all'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={scope === s}
                onClick={() => setScope(s)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${scope === s ? 'bg-blue-700 text-white dark:bg-blue-600' : 'ring-1 ring-inset ring-slate-300 dark:ring-slate-700'}`}
              >
                {s === 'mine' ? 'Mine' : 'All projects'}
              </button>
            ))}
          </div>
          <SelectField label="Show" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectField>
          <span className="pb-2 text-sm">
            <strong>{rows.length}</strong> waiting
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Nothing is waiting for review.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Waiting</th>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Guide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map((i) => {
                  const stage = STAGES.find((s) => s.key === i.stage_key);
                  return (
                    <tr key={`${i.item_type}-${i.item_id}`}>
                      <td className="px-4 py-2 align-top whitespace-nowrap">
                        {waitedFor(i.waiting_since, now)}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Slot {i.slot_no} ·{' '}
                        </span>
                        {i.student_name}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Link
                          to={itemLink(i)}
                          className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                        >
                          {i.title}
                        </Link>
                        {i.item_type === 'submission' && (
                          <span className="ml-2 text-xs">
                            v{i.version}
                            {i.is_late ? ' · ✕ late' : ' · on time'}
                            {i.item_status === 'under_review' && ' · under review'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top">{stage ? `S${stage.no}` : '—'}</td>
                      <td className="px-4 py-2 align-top">{i.guide_name ?? '! Unassigned'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
