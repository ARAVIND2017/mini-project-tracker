import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Alert, Button, Card, LoadingState, PageHeader } from '@/components/ui';
import { listNotifications, markNotificationsRead, type Notification } from '@/lib/reports';
import { formatWhen } from '../research/format';

const TYPE_LABELS: Record<string, string> = {
  submission: 'Submission',
  review: 'Review',
  correction: 'Correction',
  approval: 'Approval',
  assignment: 'Assignment',
  deadline: 'Deadline',
  signoff: 'Sign-off',
  escalation: 'Escalation',
  meeting: 'Meeting',
};

/** The inbox: newest first, unread highlighted (FUN-18). */
export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => listNotifications(),
  });
  const mark = useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (list.isPending) return <LoadingState />;
  if (list.error) return <Alert tone="error">{list.error.message}</Alert>;
  const unread = list.data.filter((n) => !n.read_at);
  const rows = unreadOnly ? unread : list.data;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Submissions, reviews, corrections, decisions, meetings and deadlines that concern you."
        actions={
          <Button
            variant="secondary"
            busy={mark.isPending}
            disabled={unread.length === 0}
            onClick={() => mark.mutate(undefined)}
          >
            Mark all as read
          </Button>
        }
      />
      {mark.error && (
        <div className="mb-3">
          <Alert tone="error">{mark.error.message}</Alert>
        </div>
      )}
      <Card>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          Unread only ({unread.length})
        </label>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {unreadOnly ? 'Nothing unread.' : 'No notifications yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((n) => (
              <NotificationItem key={n.id} n={n} onOpen={() => !n.read_at && mark.mutate([n.id])} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function NotificationItem({ n, onOpen }: { n: Notification; onOpen: () => void }) {
  const unread = !n.read_at;
  return (
    <li
      className={`flex flex-wrap items-start justify-between gap-2 py-3 ${unread ? '' : 'opacity-75'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {unread && (
            <span className="rounded-full bg-blue-700 px-2 py-0.5 font-semibold text-white dark:bg-blue-600">
              New
            </span>
          )}
          <span>{TYPE_LABELS[n.type] ?? n.type}</span>
          <span>{formatWhen(n.created_at)}</span>
        </div>
        <p className={`mt-1 text-sm ${unread ? 'font-medium' : ''}`}>
          {n.link ? (
            <Link
              to={n.link}
              onClick={onOpen}
              className="text-blue-800 underline-offset-2 hover:underline dark:text-blue-200"
            >
              {n.title}
            </Link>
          ) : (
            n.title
          )}
        </p>
        {n.body && (
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
            {n.body}
          </p>
        )}
      </div>
      {unread && (
        <button
          type="button"
          onClick={onOpen}
          className="text-xs text-slate-600 underline dark:text-slate-300"
        >
          Mark as read<span className="sr-only">: {n.title}</span>
        </button>
      )}
    </li>
  );
}
