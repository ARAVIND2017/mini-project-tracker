import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, ListField, TextAreaField } from '@/components/ui';
import { cleanList, isEditable, latestVersion } from '@/domain/workspace';
import { listCriteria } from '@/lib/api';
import { newObjectiveVersion, saveObjective, submitRecord } from '@/lib/research';
import { EvidenceSection } from './EvidenceSection';
import { ReviewSection } from './ReviewSection';
import { LockedNote, RecordStatus, SaveButtons } from './StageParts';
import { useWorkspace } from './workspaceContext';

const TEXT_FIELDS = [
  ['original_limitations', 'Limitations of the original work'],
  ['research_gap', 'Research gap'],
  ['problem_statement', 'Proposed problem statement'],
  ['main_objective', 'Main objective'],
] as const;
const MORE_FIELDS = [
  ['contribution', 'Proposed contribution'],
  ['scope', 'Scope'],
  ['exclusions', 'Exclusions (what is out of scope)'],
] as const;
type TextKey = (typeof TEXT_FIELDS)[number][0] | (typeof MORE_FIELDS)[number][0];

/** S5: research gap and objectives, versioned. Approval is the gate for S6. */
export function ObjectivesStage() {
  const { ws, viewer, readOnly, busy, act } = useWorkspace();
  const latest = latestVersion(ws.objectives);
  const editable = viewer.isStudent && !readOnly && isEditable(latest?.status ?? 'draft');
  const startsNew = latest?.status === 'superseded';
  const [values, setValues] = useState<Record<TextKey, string>>(
    () =>
      Object.fromEntries(
        [...TEXT_FIELDS, ...MORE_FIELDS].map(([k]) => [k, latest?.[k] ?? '']),
      ) as Record<TextKey, string>,
  );
  const [specific, setSpecific] = useState<string[]>(latest?.specific_objectives ?? []);
  const [criteria, setCriteria] = useState<string[]>(latest?.evaluation_criteria ?? []);
  const domainCriteria = useQuery({
    queryKey: ['criteria', ws.project.semester_id],
    queryFn: () => listCriteria(ws.project.semester_id as string),
    enabled: editable,
  });
  const suggestions = (domainCriteria.data ?? []).filter(
    (c) => c.domain_id === ws.project.domain_id && c.is_active && !criteria.includes(c.name),
  );
  const projectId = ws.project.id as string;
  const data = () => ({
    ...values,
    specific_objectives: cleanList(specific),
    evaluation_criteria: cleanList(criteria),
  });
  const canEdit = editable || (viewer.isStudent && !readOnly && startsNew);

  return (
    <div>
      <RecordStatus
        status={latest?.status ?? null}
        submittedAt={latest?.submitted_at}
        decidedAt={latest?.decided_at}
        decidedBy={latest?.decided_by}
      >
        {latest && <span className="text-xs">Version {latest.version}</span>}
      </RecordStatus>
      {viewer.isStudent && !startsNew && <LockedNote status={latest?.status} />}
      {startsNew && viewer.isStudent && (
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          The paper changed, so the earlier objectives were superseded. Saving starts a new version.
        </p>
      )}
      {viewer.isStudent && !readOnly && latest?.status === 'approved' && (
        <div className="mb-4">
          <Button
            variant="secondary"
            busy={busy}
            onClick={() =>
              act(
                () => newObjectiveVersion(projectId),
                'New version started from the approved one.',
              )
            }
          >
            Start a new version
          </Button>
        </div>
      )}
      {!latest && !viewer.isStudent ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">No objectives yet.</p>
      ) : (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          {TEXT_FIELDS.map(([key, label]) => (
            <TextAreaField
              key={key}
              label={label}
              value={values[key]}
              disabled={!canEdit}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          ))}
          <ListField
            label="Specific objectives"
            hint="At least 2, each one measurable."
            values={specific}
            onChange={setSpecific}
            disabled={!canEdit}
            addLabel="Add an objective"
          />
          {MORE_FIELDS.map(([key, label]) => (
            <TextAreaField
              key={key}
              label={label}
              rows={2}
              value={values[key]}
              disabled={!canEdit}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          ))}
          <ListField
            label="Evaluation criteria"
            values={criteria}
            onChange={setCriteria}
            disabled={!canEdit}
            addLabel="Add a criterion"
          />
          {canEdit && suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">From the domain:</span>
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rounded-full px-2 py-0.5 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800"
                  onClick={() => setCriteria([...cleanList(criteria), c.name])}
                >
                  + {c.name}
                </button>
              ))}
            </div>
          )}
          {canEdit && (
            <SaveButtons
              onSave={() => act(() => saveObjective(projectId, data()), 'Objectives saved.')}
              onSubmit={() =>
                act(async () => {
                  const id = (await saveObjective(projectId, data())) as string;
                  await submitRecord('objective', id);
                }, 'Objectives submitted for review.')
              }
            />
          )}
        </form>
      )}
      {ws.objectives.length > 1 && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Versions:{' '}
          {[...ws.objectives]
            .reverse()
            .map((v) => `v${v.version} ${v.status.replace('_', ' ')}`)
            .join(' · ')}
        </p>
      )}
      {latest && (
        <ReviewSection
          targetType="objective"
          targetIds={ws.objectives.map((v) => v.id)}
          currentId={latest.id}
          awaiting={latest.status === 'submitted'}
          label="objectives"
        />
      )}
      <EvidenceSection stageKey="objectives" categories={['objective_document']} />
    </div>
  );
}
