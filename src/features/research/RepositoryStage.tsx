import { useState } from 'react';
import { StatusChip } from '@/components/StatusChip';
import { Button, SelectField, TextAreaField, TextField } from '@/components/ui';
import type { Enums } from '@/lib/database.types';
import {
  approveStageException,
  recordExecutionAttempt,
  saveRepository,
  submitRecord,
  type EvidenceInput,
} from '@/lib/research';
import { EvidenceItem, EvidenceSection } from './EvidenceSection';
import { EVIDENCE_LABELS, formatWhen } from './format';
import { ReviewSection } from './ReviewSection';
import { SaveButtons } from './StageParts';
import { useWorkspace } from './workspaceContext';

const FIELDS = [
  ['repo_url', 'Repository link', 'https://github.com/…'],
  ['owner', 'Owner', ''],
  ['name', 'Repository name', ''],
  ['commit_ref', 'Commit or release used (recommended)', ''],
  ['language', 'Language', ''],
  ['framework', 'Framework', ''],
] as const;
const LONG_FIELDS = [
  ['dataset_requirements', 'Dataset requirements'],
  ['environment', 'Environment and dependencies'],
  ['setup_instructions', 'Setup instructions'],
] as const;
type Key = (typeof FIELDS)[number][0] | (typeof LONG_FIELDS)[number][0];

const OUTCOMES: Record<Enums<'attempt_outcome'>, string> = {
  success: 'It ran successfully',
  failed: 'It failed',
  blocked: 'Blocked by a dependency or dataset',
};
const ATTEMPT_EVIDENCE: Enums<'evidence_category'>[] = [
  'execution_log',
  'execution_screenshot',
  'result_file',
  'other',
];

/** S4: the original code's repository, execution attempts and verification. */
export function RepositoryStage() {
  const { ws, viewer, readOnly, act } = useWorkspace();
  const stage = ws.stages.find((s) => s.stage_key === 'code_execution');
  const paper = ws.papers.find((p) => p.is_selected);
  const repo = ws.repositories.find((r) => r.is_current);
  const locked = repo?.status === 'verification_pending' || repo?.status === 'verified';
  const exception = stage?.status === 'exception_approved';
  const editable = viewer.isStudent && !readOnly && !locked && !exception;
  const [values, setValues] = useState<Record<Key, string>>(
    () =>
      Object.fromEntries(
        [...FIELDS, ...LONG_FIELDS].map(([k]) => [k, (repo?.[k] as string | null) ?? '']),
      ) as Record<Key, string>,
  );
  const attempts = ws.attempts.filter((a) => a.repository_id === repo?.id).reverse();

  return (
    <div>
      {exception && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-900 ring-1 ring-inset ring-green-200 dark:bg-green-950 dark:text-green-200 dark:ring-green-900">
          ✓ Exception approved
          {stage?.approved_by && ws.names[stage.approved_by]
            ? ` by ${ws.names[stage.approved_by]}`
            : ''}
          : {stage?.exception_reason}. The method is reimplemented from the paper and tracked in S6.
        </div>
      )}
      {!paper && !exception && (
        <p className="text-sm text-slate-600 dark:text-slate-300">Select a paper in S2 first.</p>
      )}
      {repo && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <StatusChip family="execution_status" value={repo.status} />
          {repo.submitted_at && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Sent for verification {formatWhen(repo.submitted_at)}
            </span>
          )}
        </div>
      )}
      {paper && (repo || viewer.isStudent) && !exception && (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([key, label, placeholder]) => (
              <TextField
                key={key}
                label={label}
                placeholder={placeholder || undefined}
                value={values[key]}
                disabled={!editable}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              />
            ))}
          </div>
          {LONG_FIELDS.map(([key, label]) => (
            <TextAreaField
              key={key}
              label={label}
              value={values[key]}
              disabled={!editable}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          ))}
          {editable && (
            <SaveButtons
              onSave={() =>
                act(() => saveRepository(ws.project.id as string, values), 'Repository saved.')
              }
              onSubmit={
                repo
                  ? () =>
                      act(async () => {
                        await saveRepository(ws.project.id as string, values);
                        await submitRecord('repository', repo.id);
                      }, 'Sent to your guide for verification.')
                  : undefined
              }
              submitLabel="Save and ask for verification"
            />
          )}
          {editable && repo && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verification needs at least one successful attempt with evidence.
            </p>
          )}
        </form>
      )}

      {repo && (
        <section aria-label="Execution attempts" className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Execution attempts
          </h3>
          {editable && <AttemptForm repositoryId={repo.id} />}
          {attempts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              No attempts recorded yet.
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {attempts.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-medium ${a.outcome === 'success' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}
                    >
                      {a.outcome === 'success' ? '✓' : '✕'} {OUTCOMES[a.outcome]}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatWhen(a.attempted_at)}
                    </span>
                  </div>
                  {a.errors && (
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs dark:bg-slate-800">
                      {a.errors}
                    </pre>
                  )}
                  {a.debugging_notes && <p className="mt-2">Debugging: {a.debugging_notes}</p>}
                  {a.notes && <p className="mt-1">{a.notes}</p>}
                  <ul className="mt-2 space-y-2">
                    {ws.evidence
                      .filter((e) => e.linked_type === 'execution_attempt' && e.linked_id === a.id)
                      .map((e) => (
                        <EvidenceItem key={e.id} evidence={e} />
                      ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {viewer.canApproveException &&
        !readOnly &&
        stage &&
        stage.status !== 'approved' &&
        !exception && <ExceptionForm />}

      {repo && (
        <ReviewSection
          targetType="repository"
          targetIds={ws.repositories.map((r) => r.id)}
          currentId={repo.id}
          awaiting={repo.status === 'verification_pending'}
          label="code execution"
        />
      )}
      <EvidenceSection
        stageKey="code_execution"
        categories={['github_repository', 'execution_screenshot']}
      />
    </div>
  );
}

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function AttemptForm({ repositoryId }: { repositoryId: string }) {
  const { busy, act } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [attemptedAt, setAttemptedAt] = useState(nowLocal);
  const [outcome, setOutcome] = useState<Enums<'attempt_outcome'>>('success');
  const [errors, setErrors] = useState('');
  const [debugging, setDebugging] = useState('');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<EvidenceInput[]>([
    { category: 'execution_log', url: '', description: '' },
  ]);

  if (!open)
    return (
      <div className="mt-2">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Record an attempt
        </Button>
      </div>
    );

  return (
    <form
      aria-label="Record an execution attempt"
      className="mt-3 space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-800"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await act(
          () =>
            recordExecutionAttempt({
              repositoryId,
              attemptedAt: new Date(attemptedAt).toISOString(),
              outcome,
              errors,
              debuggingNotes: debugging,
              notes,
              evidence: evidence.filter((x) => x.url.trim() || x.description.trim()),
            }),
          'Attempt recorded.',
        );
        if (ok) setOpen(false);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="When"
          type="datetime-local"
          value={attemptedAt}
          onChange={(e) => setAttemptedAt(e.target.value)}
        />
        <SelectField
          label="Outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as Enums<'attempt_outcome'>)}
        >
          {Object.entries(OUTCOMES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>
      {outcome !== 'success' && (
        <TextAreaField
          label="Errors encountered"
          hint="Paste the error messages (at least 10 characters)."
          value={errors}
          onChange={(e) => setErrors(e.target.value)}
        />
      )}
      <TextAreaField
        label="Debugging notes"
        rows={2}
        value={debugging}
        onChange={(e) => setDebugging(e.target.value)}
      />
      <TextAreaField
        label="Other notes"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <fieldset>
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Evidence (logs, screenshots, result files)
        </legend>
        <div className="mt-1 space-y-2">
          {evidence.map((x, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[11rem_1fr_1fr]">
              <SelectField
                label={`Evidence ${i + 1} kind`}
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
                {ATTEMPT_EVIDENCE.map((c) => (
                  <option key={c} value={c}>
                    {EVIDENCE_LABELS[c]}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={`Evidence ${i + 1} link`}
                placeholder="https://…"
                value={x.url}
                onChange={(e) =>
                  setEvidence(evidence.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))
                }
              />
              <TextField
                label={`Evidence ${i + 1} description`}
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
            setEvidence([
              ...evidence,
              { category: 'execution_screenshot', url: '', description: '' },
            ])
          }
        >
          + Add evidence
        </button>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" busy={busy}>
          Save attempt
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ExceptionForm() {
  const { ws, busy, act } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <div className="mt-6 text-sm">
      {!open ? (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Approve an exception (no usable public code)
        </Button>
      ) : (
        <form
          aria-label="Approve an exception for S4"
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act(
                () => approveStageException(ws.project.id as string, reason),
                'Exception approved for S4.',
              )
            )
              setOpen(false);
          }}
        >
          <TextAreaField
            label="Reason (at least 20 characters)"
            hint="The student will reimplement the method from the paper; that work is tracked in S6."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" busy={busy}>
              Approve exception
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
