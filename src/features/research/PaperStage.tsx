import { useState } from 'react';
import { StatusChip } from '@/components/StatusChip';
import { Button, ListField, SelectField, TextAreaField, TextField } from '@/components/ui';
import { cleanList } from '@/domain/workspace';
import {
  overrideRule,
  savePaper,
  selectPaper,
  submitRecord,
  withdrawPaper,
  type Paper,
} from '@/lib/research';
import { EvidenceSection } from './EvidenceSection';
import { ReviewSection } from './ReviewSection';
import { useWorkspace } from './workspaceContext';

const AVAILABILITY = {
  unknown: 'Not known yet',
  available: 'Public code available',
  not_available: 'No public code',
} as const;

/** S2: candidate papers, the selected paper, its review and the duplicate check. */
export function PaperStage() {
  const { ws, viewer, readOnly } = useWorkspace();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const visible = ws.papers.filter((p) => p.status !== 'withdrawn');
  const withdrawn = ws.papers.filter((p) => p.status === 'withdrawn');
  const selected = ws.papers.find((p) => p.is_selected);
  const editingPaper = ws.papers.find((p) => p.id === editing);

  return (
    <div>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Record candidate papers, select one and submit it. Papers from{' '}
        {ws.semester?.target_paper_year ?? 'the target year'} are preferred; an older paper needs a
        short justification of why it is foundational. An approved paper can be changed until the
        end of week {ws.semester?.paper_change_cutoff_week ?? 4} (after that, only by the HOD).
      </p>

      {visible.length === 0 && !editing && (
        <p className="text-sm text-slate-600 dark:text-slate-300">No candidate papers yet.</p>
      )}
      <ul className="space-y-3">
        {visible.map((p) =>
          editing === p.id ? (
            <li key={p.id}>
              <PaperForm paper={editingPaper} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <PaperCard key={p.id} paper={p} onEdit={() => setEditing(p.id)} />
          ),
        )}
      </ul>

      {viewer.isStudent && !readOnly && editing === 'new' && (
        <div className="mt-3">
          <PaperForm onDone={() => setEditing(null)} />
        </div>
      )}
      {viewer.isStudent && !readOnly && editing === null && (
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setEditing('new')}>
            Add a candidate paper
          </Button>
        </div>
      )}

      {withdrawn.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-slate-600 dark:text-slate-300">
            {withdrawn.length} withdrawn paper(s)
          </summary>
          <ul className="mt-2 list-disc pl-5">
            {withdrawn.map((p) => (
              <li key={p.id}>
                {p.title}
                {p.withdrawn_reason && ` — ${p.withdrawn_reason}`}
              </li>
            ))}
          </ul>
        </details>
      )}

      {viewer.isHod && !readOnly && selected && selected.status !== 'approved' && (
        <DuplicateOverride paper={selected} />
      )}

      {selected && (
        <ReviewSection
          targetType="paper"
          targetIds={ws.papers.map((p) => p.id)}
          currentId={selected.id}
          awaiting={selected.status === 'submitted'}
          label="selected paper"
        />
      )}
      <EvidenceSection stageKey="paper_selection" categories={['research_paper_pdf']} />
    </div>
  );
}

function PaperCard({ paper: p, onEdit }: { paper: Paper; onEdit: () => void }) {
  const { viewer, readOnly, busy, act } = useWorkspace();
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState('');
  const canWithdraw =
    !readOnly &&
    ((p.status === 'candidate' && (viewer.isStudent || viewer.isReviewer)) ||
      (p.status === 'approved' && viewer.isReviewer));

  return (
    <li
      className={`rounded-md border p-3 text-sm ${p.is_selected ? 'border-blue-400 dark:border-blue-700' : 'border-slate-200 dark:border-slate-800'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{p.title}</h3>
        <StatusChip family="paper_status" value={p.status} />
        {p.is_selected && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-300 dark:bg-blue-950 dark:text-blue-200">
            ★ Selected
          </span>
        )}
      </div>
      <p className="mt-1 text-slate-600 dark:text-slate-300">
        {[p.authors.join(', '), p.venue, p.pub_year].filter(Boolean).join(' · ') ||
          'Details not filled in yet'}
      </p>
      <p className="mt-1 flex flex-wrap gap-3 text-xs">
        {p.doi && (
          <a
            className="text-blue-700 underline dark:text-blue-300"
            href={`https://doi.org/${p.doi}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            DOI {p.doi}
          </a>
        )}
        {p.url && (
          <a
            className="text-blue-700 underline dark:text-blue-300"
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Publisher page
          </a>
        )}
        {p.pdf_drive_url && (
          <a
            className="text-blue-700 underline dark:text-blue-300"
            href={p.pdf_drive_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            PDF (Drive)
          </a>
        )}
        <span>{AVAILABILITY[p.code_availability]}</span>
      </p>
      {p.relevance_note && <p className="mt-2">{p.relevance_note}</p>}
      {p.foundational_justification && (
        <p className="mt-1 text-xs">
          <span className="font-medium">Foundational:</span> {p.foundational_justification}
        </p>
      )}
      {p.duplicate_override_reason && (
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          ! HOD allowed a duplicate: {p.duplicate_override_reason}
        </p>
      )}

      {!readOnly && !withdrawing && (
        <div className="mt-3 flex flex-wrap gap-2">
          {viewer.isStudent && p.status === 'candidate' && (
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )}
          {viewer.isStudent && p.status === 'candidate' && !p.is_selected && (
            <Button
              variant="secondary"
              busy={busy}
              onClick={() => act(() => selectPaper(p.id), 'Paper selected.')}
            >
              Select this paper
            </Button>
          )}
          {viewer.isStudent && p.status === 'candidate' && p.is_selected && (
            <Button
              busy={busy}
              onClick={() => act(() => submitRecord('paper', p.id), 'Paper submitted for review.')}
            >
              Submit for review
            </Button>
          )}
          {canWithdraw && (
            <Button variant="secondary" onClick={() => setWithdrawing(true)}>
              Withdraw
            </Button>
          )}
        </div>
      )}
      {withdrawing && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act(() => withdrawPaper(p.id, reason), 'Paper withdrawn.'))
              setWithdrawing(false);
          }}
        >
          <TextField
            className="min-w-64 flex-1"
            label={p.status === 'approved' ? 'Reason (required)' : 'Reason (optional)'}
            hint={
              p.status === 'approved'
                ? 'The analysis, repository and objectives built on this paper are reopened.'
                : undefined
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button type="submit" variant="danger" busy={busy}>
            Withdraw paper
          </Button>
          <Button type="button" variant="secondary" onClick={() => setWithdrawing(false)}>
            Cancel
          </Button>
        </form>
      )}
    </li>
  );
}

function PaperForm({ paper, onDone }: { paper?: Paper; onDone: () => void }) {
  const { ws, act } = useWorkspace();
  const [f, setF] = useState({
    title: paper?.title ?? '',
    pub_year: paper?.pub_year?.toString() ?? '',
    venue: paper?.venue ?? '',
    doi: paper?.doi ?? '',
    url: paper?.url ?? '',
    pdf_drive_url: paper?.pdf_drive_url ?? '',
    abstract: paper?.abstract ?? '',
    research_problem: paper?.research_problem ?? '',
    relevance_note: paper?.relevance_note ?? '',
    code_availability: paper?.code_availability ?? 'unknown',
    foundational_justification: paper?.foundational_justification ?? '',
  });
  const [authors, setAuthors] = useState<string[]>(paper?.authors ?? []);
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [key]: e.target.value });
  const oldPaper =
    f.pub_year !== '' && ws.semester && Number(f.pub_year) !== ws.semester.target_paper_year;

  return (
    <form
      aria-label={paper ? 'Edit paper' : 'New candidate paper'}
      className="space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-800"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await act(
          () =>
            savePaper(ws.project.id as string, { ...f, authors: cleanList(authors) }, paper?.id),
          'Paper saved.',
        );
        if (ok) onDone();
      }}
    >
      <TextField label="Title" value={f.title} onChange={set('title')} required />
      <ListField label="Authors" values={authors} onChange={setAuthors} addLabel="Add an author" />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label="Publication year"
          inputMode="numeric"
          value={f.pub_year}
          onChange={set('pub_year')}
        />
        <TextField
          className="sm:col-span-2"
          label="Venue (journal or conference)"
          value={f.venue}
          onChange={set('venue')}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="DOI" placeholder="10.1234/abcd" value={f.doi} onChange={set('doi')} />
        <TextField
          label="Publisher link"
          placeholder="https://…"
          value={f.url}
          onChange={set('url')}
        />
      </div>
      <TextField
        label="PDF link in your Google Drive"
        placeholder="https://drive.google.com/…"
        value={f.pdf_drive_url}
        onChange={set('pdf_drive_url')}
      />
      <TextAreaField label="Abstract" value={f.abstract} onChange={set('abstract')} />
      <TextAreaField
        label="Research problem of the paper"
        value={f.research_problem}
        onChange={set('research_problem')}
      />
      <TextAreaField
        label="Relevance to the project domain"
        hint="At least 50 characters."
        value={f.relevance_note}
        onChange={set('relevance_note')}
      />
      <SelectField
        label="Code availability"
        value={f.code_availability}
        onChange={set('code_availability')}
      >
        {Object.entries(AVAILABILITY).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      {(oldPaper || f.foundational_justification) && (
        <TextAreaField
          label="Foundational justification"
          hint={`Required because the paper is not from ${ws.semester?.target_paper_year}. At least 30 characters.`}
          value={f.foundational_justification}
          onChange={set('foundational_justification')}
        />
      )}
      <div className="flex gap-2">
        <Button type="submit">Save paper</Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DuplicateOverride({ paper }: { paper: Paper }) {
  const { ws, busy, act } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (paper.duplicate_override_reason) return null;
  return (
    <div className="mt-4 text-sm">
      {!open ? (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          HOD: allow this paper even if another project has it
        </Button>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act(
                () => overrideRule(ws.project.id as string, 'duplicate_paper', reason),
                'Duplicate check overridden for this paper.',
              )
            )
              setOpen(false);
          }}
        >
          <TextField
            className="min-w-64 flex-1"
            label="Reason for the override (logged)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button type="submit" busy={busy}>
            Allow
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}
