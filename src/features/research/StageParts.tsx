import type { ReactNode } from 'react';
import { StatusChip } from '@/components/StatusChip';
import { Button } from '@/components/ui';
import type { Enums } from '@/lib/database.types';
import { formatWhen } from './format';
import { useWorkspace } from './workspaceContext';

/** Heading for a stage record: its status and when it was submitted or decided. */
export function RecordStatus({
  status,
  submittedAt,
  decidedAt,
  decidedBy,
  children,
}: {
  status: Enums<'record_status'> | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  decidedBy?: string | null;
  children?: ReactNode;
}) {
  const { ws } = useWorkspace();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      {status ? (
        <StatusChip family="record_status" value={status} />
      ) : (
        <span className="text-slate-500 dark:text-slate-400">Not started</span>
      )}
      {submittedAt && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Submitted {formatWhen(submittedAt)}
        </span>
      )}
      {decidedAt && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          · Decided {formatWhen(decidedAt)}
          {decidedBy && ws.names[decidedBy] ? ` by ${ws.names[decidedBy]}` : ''}
        </span>
      )}
      {children}
    </div>
  );
}

/** Save / Save and submit buttons for the student's editable record. */
export function SaveButtons({
  onSave,
  onSubmit,
  submitLabel = 'Save and submit for review',
}: {
  onSave: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
}) {
  const { busy } = useWorkspace();
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" busy={busy} onClick={onSave}>
        Save draft
      </Button>
      {onSubmit && (
        <Button type="button" busy={busy} onClick={onSubmit}>
          {submitLabel}
        </Button>
      )}
    </div>
  );
}

export function LockedNote({ status }: { status: string | null | undefined }) {
  if (status === 'submitted' || status === 'verification_pending')
    return (
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Locked while it is waiting for review.
      </p>
    );
  if (status === 'approved' || status === 'verified')
    return (
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Approved. It can no longer be edited.
      </p>
    );
  return null;
}
