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
import { isStageDone } from '@/domain/workspace';
import { saveEvaluationResult, type EvaluationResult } from '@/lib/final';
import { submitRecord } from '@/lib/research';
import { ReviewSection } from './ReviewSection';
import { useFinalData } from './useFinalData';
import { useWorkspace } from './workspaceContext';

/**
 * S7: test results, kept apart as baseline (the original work, from S4) and proposed
 * (the student's own contribution). Every result has an evidence link (DATA-08). The set
 * is submitted and reviewed together.
 */
export function EvaluationStage() {
  const { ws, viewer, readOnly, busy, act } = useWorkspace();
  const data = useFinalData();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const done = isStageDone(ws.stages.find((s) => s.stage_key === 'evaluation')?.status);

  if (data.isPending) return <LoadingState />;
  if (data.error) return <Alert tone="error">{data.error.message}</Alert>;
  const results = data.data.results;
  const waiting = results.some((r) => r.status === 'submitted');
  const editable = viewer.isStudent && !readOnly && !done && !waiting;
  const projectId = ws.project.id as string;

  return (
    <div>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Record each test with its expected and actual result. <strong>Baseline</strong> results come
        from running the original work (S4); <strong>proposed</strong> results come from your own
        contribution. Every result needs an evidence link; a failed test needs the corrective
        action.
      </p>
      {waiting && viewer.isStudent && (
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          The results are waiting for your guide&apos;s review and are locked.
        </p>
      )}
      {(['baseline', 'proposed'] as const).map((kind) => (
        <section
          key={kind}
          aria-label={kind === 'baseline' ? 'Baseline results' : 'Proposed results'}
          className="mb-4"
        >
          <h3 className="mb-2 text-sm font-semibold">
            {kind === 'baseline' ? 'Baseline (original work)' : 'Proposed (your work)'}
          </h3>
          <ResultTable
            rows={results.filter((r) => r.kind === kind)}
            editable={editable}
            editing={editing}
            onEdit={setEditing}
          />
        </section>
      ))}
      {editable && (
        <div className="flex flex-wrap gap-2">
          {editing === 'new' ? null : (
            <Button variant="secondary" onClick={() => setEditing('new')}>
              Add a result
            </Button>
          )}
          {results.some((r) => r.status === 'draft' || r.status === 'changes_requested') && (
            <Button
              busy={busy}
              onClick={() =>
                act(() => submitRecord('evaluation', projectId), 'Results submitted for review.')
              }
            >
              Submit the results for review
            </Button>
          )}
        </div>
      )}
      {editing === 'new' && <ResultForm onDone={() => setEditing(null)} />}
      {results.length > 0 && (
        <ReviewSection
          targetType="evaluation"
          targetIds={[projectId]}
          currentId={projectId}
          awaiting={waiting}
          label="evaluation results"
        />
      )}
    </div>
  );
}

function ResultTable({
  rows,
  editable,
  editing,
  onEdit,
}: {
  rows: EvaluationResult[];
  editable: boolean;
  editing: string | null;
  onEdit: (id: string | null) => void;
}) {
  const { ws } = useWorkspace();
  if (rows.length === 0)
    return <p className="text-sm text-slate-600 dark:text-slate-300">None yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const evidence = ws.evidence.find((e) => e.id === r.evidence_id);
        return editing === r.id ? (
          <li key={r.id}>
            <ResultForm result={r} onDone={() => onEdit(null)} />
          </li>
        ) : (
          <li
            key={r.id}
            className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.test_case}</span>
              <span
                className={
                  r.passed ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
                }
              >
                {r.passed ? '✓ Passed' : '✕ Failed'}
              </span>
              <StatusChip family="record_status" value={r.status} />
              {editable && (r.status === 'draft' || r.status === 'changes_requested') && (
                <Button variant="secondary" className="ml-auto" onClick={() => onEdit(r.id)}>
                  Edit
                </Button>
              )}
            </div>
            <p className="mt-1">
              Expected: {r.expected} · Actual: {r.actual}
              {r.metric_name && ` · ${r.metric_name} = ${r.metric_value}`}
            </p>
            {r.corrective_action && (
              <p className="mt-1 text-xs">Corrective action: {r.corrective_action}</p>
            )}
            {evidence && (
              <a
                href={evidence.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-blue-700 underline dark:text-blue-300"
              >
                Evidence: {evidence.description}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ResultForm({ result: r, onDone }: { result?: EvaluationResult; onDone: () => void }) {
  const { ws, busy, act } = useWorkspace();
  const [f, setF] = useState({
    kind: r?.kind ?? 'proposed',
    test_case: r?.test_case ?? '',
    expected: r?.expected ?? '',
    actual: r?.actual ?? '',
    metric_name: r?.metric_name ?? '',
    metric_value: r?.metric_value?.toString() ?? '',
    passed: r ? String(r.passed) : 'true',
    corrective_action: r?.corrective_action ?? '',
    evidence_url: '',
    evidence_description: '',
  });
  const set = (key: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [key]: e.target.value });
  return (
    <form
      aria-label={r ? 'Edit result' : 'New result'}
      className="mt-3 space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-800"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await act(
          () =>
            saveEvaluationResult(
              ws.project.id as string,
              { ...f, passed: f.passed === 'true', metric_value: f.metric_value || null },
              r?.id,
            ),
          'Result saved.',
        );
        if (ok) onDone();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Kind" value={f.kind} onChange={set('kind')}>
          <option value="baseline">Baseline (original work)</option>
          <option value="proposed">Proposed (your work)</option>
        </SelectField>
        <SelectField label="Outcome" value={f.passed} onChange={set('passed')}>
          <option value="true">Passed</option>
          <option value="false">Failed</option>
        </SelectField>
      </div>
      <TextField label="Test case" value={f.test_case} onChange={set('test_case')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Expected result" value={f.expected} onChange={set('expected')} />
        <TextField label="Actual result" value={f.actual} onChange={set('actual')} />
        <TextField
          label="Metric (optional)"
          placeholder="e.g. accuracy"
          value={f.metric_name}
          onChange={set('metric_name')}
        />
        <TextField
          label="Metric value"
          inputMode="decimal"
          value={f.metric_value}
          onChange={set('metric_value')}
        />
      </div>
      {f.passed === 'false' && (
        <TextAreaField
          label="Corrective action"
          rows={2}
          value={f.corrective_action}
          onChange={set('corrective_action')}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label={r ? 'New evidence link (optional)' : 'Evidence link'}
          placeholder="https://drive.google.com/…"
          value={f.evidence_url}
          onChange={set('evidence_url')}
        />
        <TextField
          label="What the evidence shows"
          value={f.evidence_description}
          onChange={set('evidence_description')}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" busy={busy}>
          Save result
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
