import { useState } from 'react';
import { StatusChip } from '@/components/StatusChip';
import { Button, SelectField, TextField } from '@/components/ui';
import type { StageKey } from '@/domain/constants';
import type { Enums } from '@/lib/database.types';
import { addEvidence, verifyEvidence, type Evidence, type EvidenceInput } from '@/lib/research';
import { EVIDENCE_LABELS, formatWhen } from './format';
import { useWorkspace } from './workspaceContext';

/** Evidence links for one stage: the student adds them, a reviewer verifies them. */
export function EvidenceSection({
  stageKey,
  categories,
}: {
  stageKey: StageKey;
  categories: Enums<'evidence_category'>[];
}) {
  const { ws, viewer, readOnly, busy, act } = useWorkspace();
  // Evidence attached to an execution attempt or a weekly task is shown there instead.
  const items = ws.evidence.filter((e) => e.stage_key === stageKey && !e.linked_type && !e.task_id);
  const [form, setForm] = useState<EvidenceInput>({
    category: categories[0] ?? 'other',
    url: '',
    description: '',
  });

  return (
    <section aria-label="Evidence links" className="mt-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Evidence links
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No evidence links yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((e) => (
            <EvidenceItem key={e.id} evidence={e} />
          ))}
        </ul>
      )}
      {viewer.isStudent && !readOnly && (
        <form
          aria-label="Add an evidence link"
          className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act(
                () => addEvidence(ws.project.id as string, stageKey, form),
                'Evidence link added.',
              )
            ) {
              setForm({ ...form, url: '', description: '' });
            }
          }}
        >
          <SelectField
            label="Kind"
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as Enums<'evidence_category'> })
            }
          >
            {[...categories, 'other' as const]
              .filter((c, i, all) => all.indexOf(c) === i)
              .map((c) => (
                <option key={c} value={c}>
                  {EVIDENCE_LABELS[c]}
                </option>
              ))}
          </SelectField>
          <TextField
            label="Link (https://…)"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <TextField
            label="What it shows"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Button type="submit" variant="secondary" busy={busy}>
            Add link
          </Button>
        </form>
      )}
    </section>
  );
}

export function EvidenceItem({ evidence: e }: { evidence: Evidence }) {
  const { ws, viewer, readOnly, busy, act } = useWorkspace();
  const [rejecting, setRejecting] = useState<'rejected' | 'inaccessible' | null>(null);
  const [note, setNote] = useState('');
  return (
    <li className="rounded-md border border-slate-200 p-2 text-sm dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {EVIDENCE_LABELS[e.category]}
        </span>
        <a
          href={e.url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-blue-700 underline dark:text-blue-300"
        >
          {e.description}
        </a>
        <StatusChip family="evidence_verification" value={e.verification} />
      </div>
      {e.verification_note && (
        <p className="mt-1 text-xs">
          Note{e.verified_by ? ` from ${ws.names[e.verified_by] ?? 'reviewer'}` : ''}:{' '}
          {e.verification_note}
        </p>
      )}
      {e.verified_at && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Checked {formatWhen(e.verified_at)}
        </p>
      )}
      {viewer.isReviewer && !readOnly && !rejecting && (
        <div className="mt-2 flex flex-wrap gap-2">
          {e.verification !== 'verified' && (
            <Button
              variant="secondary"
              busy={busy}
              onClick={() => act(() => verifyEvidence(e.id, 'verified'), 'Evidence verified.')}
            >
              Verify
            </Button>
          )}
          <Button variant="secondary" onClick={() => setRejecting('inaccessible')}>
            Not accessible
          </Button>
          <Button variant="secondary" onClick={() => setRejecting('rejected')}>
            Reject
          </Button>
        </div>
      )}
      {rejecting && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (await act(() => verifyEvidence(e.id, rejecting, note), 'Evidence status saved.')) {
              setRejecting(null);
              setNote('');
            }
          }}
        >
          <TextField
            className="min-w-64 flex-1"
            label={
              rejecting === 'inaccessible' ? 'What is wrong with the link?' : 'Why is it rejected?'
            }
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
          />
          <Button type="submit" busy={busy}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={() => setRejecting(null)}>
            Cancel
          </Button>
        </form>
      )}
    </li>
  );
}
