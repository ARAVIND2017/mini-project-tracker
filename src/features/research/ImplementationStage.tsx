import { useState } from 'react';
import { Link } from 'react-router';
import {
  Alert,
  Button,
  ListField,
  LoadingState,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui';
import { ENUMS } from '@/domain/constants';
import { cleanList, isStageDone } from '@/domain/workspace';
import type { Enums } from '@/lib/database.types';
import { saveImplementationItem, type ImplementationItem } from '@/lib/final';
import { EvidenceSection } from './EvidenceSection';
import { IMPLEMENTATION_TYPE_LABELS, ITEM_STATUS_LABELS } from './format';
import { useFinalData } from './useFinalData';
import { useWorkspace } from './workspaceContext';

/** S6: planned and completed work items with commit links. The stage completes when its weekly tasks are verified. */
export function ImplementationStage() {
  const { ws, viewer, readOnly } = useWorkspace();
  const data = useFinalData();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const stage = ws.stages.find((s) => s.stage_key === 'implementation');
  // The HOD's override also opens S6; the database decides, this only explains.
  const objectivesDone = isStageDone(ws.stages.find((s) => s.stage_key === 'objectives')?.status);
  const editable = viewer.isStudent && !readOnly && !isStageDone(stage?.status);

  if (data.isPending) return <LoadingState />;
  if (data.error) return <Alert tone="error">{data.error.message}</Alert>;
  const items = data.data.items;
  const planned = items.filter((i) => i.is_planned);
  const done = items.filter((i) => i.status === 'done').length;

  return (
    <div>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        List the work you plan and record what is done, with commit links. S6 is approved when all
        its{' '}
        <Link
          to={`/projects/${ws.project.id}?view=tasks`}
          className="text-blue-700 underline dark:text-blue-300"
        >
          weekly tasks
        </Link>{' '}
        (weeks 7–10) are verified.
      </p>
      {!objectivesDone && (
        <div className="mb-4">
          <Alert>
            Work for S6 can be recorded once the objectives (S5) are approved, or after an HOD
            override.
          </Alert>
        </div>
      )}
      <p className="mb-3 text-sm">
        <strong>{done}</strong> of {items.filter((i) => i.status !== 'dropped').length} items done ·{' '}
        <strong>{planned.length}</strong> planned at the start
      </p>
      {items.length === 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-300">No items yet.</p>
      )}
      <ul className="space-y-2">
        {items.map((i) =>
          editing === i.id ? (
            <li key={i.id}>
              <ItemForm item={i} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li
              key={i.id}
              className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`font-medium ${i.status === 'dropped' ? 'line-through' : ''}`}>
                  {i.title}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {IMPLEMENTATION_TYPE_LABELS[i.type]} · {i.is_planned ? 'planned' : 'added later'}{' '}
                  · {ITEM_STATUS_LABELS[i.status]}
                </span>
                {editable && (
                  <Button variant="secondary" className="ml-auto" onClick={() => setEditing(i.id)}>
                    Edit
                  </Button>
                )}
              </div>
              {i.notes && <p className="mt-1">{i.notes}</p>}
              {i.commit_links.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-3 text-xs">
                  {i.commit_links.map((l, n) => (
                    <a
                      key={l}
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 underline dark:text-blue-300"
                    >
                      Commit {n + 1}
                    </a>
                  ))}
                </p>
              )}
            </li>
          ),
        )}
      </ul>
      {editable && (
        <div className="mt-3">
          {editing === 'new' ? (
            <ItemForm onDone={() => setEditing(null)} />
          ) : (
            <Button variant="secondary" onClick={() => setEditing('new')}>
              Add an item
            </Button>
          )}
        </div>
      )}
      <EvidenceSection stageKey="implementation" categories={['implementation_evidence']} />
    </div>
  );
}

function ItemForm({ item, onDone }: { item?: ImplementationItem; onDone: () => void }) {
  const { ws, busy, act } = useWorkspace();
  const [f, setF] = useState({
    title: item?.title ?? '',
    type: (item?.type ?? 'feature') as Enums<'implementation_type'>,
    status: (item?.status ?? 'planned') as Enums<'item_status'>,
    is_planned: item?.is_planned ?? true,
    notes: item?.notes ?? '',
  });
  const [links, setLinks] = useState<string[]>(item?.commit_links ?? []);
  return (
    <form
      aria-label={item ? `Edit ${item.title}` : 'New implementation item'}
      className="space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-800"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await act(
          () =>
            saveImplementationItem(
              ws.project.id as string,
              { ...f, commit_links: cleanList(links) },
              item?.id,
            ),
          'Item saved.',
        );
        if (ok) onDone();
      }}
    >
      <TextField
        label="What is the work?"
        value={f.title}
        onChange={(e) => setF({ ...f, title: e.target.value })}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Type"
          value={f.type}
          onChange={(e) => setF({ ...f, type: e.target.value as Enums<'implementation_type'> })}
        >
          {ENUMS.implementation_type.map((t) => (
            <option key={t} value={t}>
              {IMPLEMENTATION_TYPE_LABELS[t]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Status"
          value={f.status}
          onChange={(e) => setF({ ...f, status: e.target.value as Enums<'item_status'> })}
        >
          {ENUMS.item_status.map((s) => (
            <option key={s} value={s}>
              {ITEM_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={f.is_planned}
            onChange={(e) => setF({ ...f, is_planned: e.target.checked })}
          />
          Part of the original plan
        </label>
      </div>
      <ListField
        label="Commit links"
        values={links}
        onChange={setLinks}
        addLabel="Add a commit link"
        placeholder="https://github.com/…/commit/…"
      />
      <TextAreaField
        label="Notes"
        hint={f.status === 'dropped' ? 'Required: why the item was dropped.' : undefined}
        rows={2}
        value={f.notes}
        onChange={(e) => setF({ ...f, notes: e.target.value })}
      />
      <div className="flex gap-2">
        <Button type="submit" busy={busy}>
          Save item
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
