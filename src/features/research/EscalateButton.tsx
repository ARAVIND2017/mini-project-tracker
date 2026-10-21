import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Button, TextAreaField } from '@/components/ui';
import { escalateToHod } from '@/lib/reports';

/** The lead raises a project with the HOD (UI_UX_SPEC L1). The HOD gets a notification. */
export function EscalateButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const send = useMutation({
    mutationFn: () => escalateToHod(projectId, note),
    onSuccess: () => {
      setOpen(false);
      setNote('');
    },
  });

  if (!open) {
    return (
      <span className="flex flex-col items-end gap-1">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Escalate to HOD
        </Button>
        {send.isSuccess && (
          <span role="status" className="text-xs text-green-800 dark:text-green-300">
            ✓ The HOD has been notified.
          </span>
        )}
      </span>
    );
  }
  return (
    <form
      aria-label="Escalate to HOD"
      className="w-full max-w-md space-y-2 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      {send.error && <Alert tone="error">{send.error.message}</Alert>}
      <TextAreaField
        label="What needs the HOD's attention?"
        hint="At least 10 characters. Recorded in the audit log."
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" busy={send.isPending}>
          Send to HOD
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
