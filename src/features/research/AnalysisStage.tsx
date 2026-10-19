import { useState } from 'react';
import { Button, TextAreaField } from '@/components/ui';
import { isEditable, latestVersion } from '@/domain/workspace';
import { newAnalysisVersion, saveAnalysis, submitRecord } from '@/lib/research';
import { EvidenceSection } from './EvidenceSection';
import { ReviewSection } from './ReviewSection';
import { LockedNote, RecordStatus, SaveButtons } from './StageParts';
import { useWorkspace } from './workspaceContext';

const FIELDS = [
  ['problem_addressed', 'Problem addressed'],
  ['research_objectives', 'Research objectives'],
  ['methodology', 'Methodology'],
  ['datasets', 'Datasets'],
  ['tools', 'Tools'],
  ['algorithms', 'Algorithms and models'],
  ['reported_results', 'Reported results and metrics'],
  ['limitations', 'Limitations'],
  ['research_gaps', 'Research gaps'],
  ['own_understanding', 'Own understanding (at least 150 characters, in your own words)'],
] as const;

type FieldKey = (typeof FIELDS)[number][0];

/** S3: structured analysis of the selected paper, with versions. */
export function AnalysisStage() {
  const { ws, viewer, readOnly, busy, act } = useWorkspace();
  const paper = ws.papers.find((p) => p.is_selected);
  const versions = ws.analyses.filter((a) => a.paper_id === paper?.id);
  const latest = latestVersion(versions);
  const editable = viewer.isStudent && !readOnly && isEditable(latest?.status);
  const [values, setValues] = useState<Record<FieldKey, string>>(
    () =>
      Object.fromEntries(FIELDS.map(([k]) => [k, latest?.[k] ?? ''])) as Record<FieldKey, string>,
  );

  if (!paper) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Select a paper in S2 first. The analysis is written for the selected paper.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm">
        Paper: <span className="font-medium">{paper.title}</span>
      </p>
      <RecordStatus
        status={latest?.status ?? null}
        submittedAt={latest?.submitted_at}
        decidedAt={latest?.decided_at}
        decidedBy={latest?.decided_by}
      >
        {latest && <span className="text-xs">Version {latest.version}</span>}
      </RecordStatus>
      {viewer.isStudent && <LockedNote status={latest?.status} />}
      {viewer.isStudent && !readOnly && latest?.status === 'approved' && (
        <div className="mb-4">
          <Button
            variant="secondary"
            busy={busy}
            onClick={() =>
              act(() => newAnalysisVersion(paper.id), 'New version started from the approved one.')
            }
          >
            Start a new version
          </Button>
        </div>
      )}
      {!latest && !viewer.isStudent ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">No analysis yet.</p>
      ) : (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          {FIELDS.map(([key, label]) => (
            <TextAreaField
              key={key}
              label={label}
              rows={key === 'own_understanding' ? 5 : 3}
              value={values[key]}
              disabled={!editable}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          ))}
          {editable && (
            <SaveButtons
              onSave={() => act(() => saveAnalysis(paper.id, values), 'Analysis saved.')}
              onSubmit={() =>
                act(async () => {
                  const id = (await saveAnalysis(paper.id, values)) as string;
                  await submitRecord('paper_analysis', id);
                }, 'Analysis submitted for review.')
              }
            />
          )}
        </form>
      )}
      {versions.length > 1 && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Versions:{' '}
          {[...versions]
            .reverse()
            .map((v) => `v${v.version} ${v.status.replace('_', ' ')}`)
            .join(' · ')}
        </p>
      )}
      {latest && (
        <ReviewSection
          targetType="paper_analysis"
          targetIds={versions.map((v) => v.id)}
          currentId={latest.id}
          awaiting={latest.status === 'submitted'}
          label="paper analysis"
        />
      )}
      <EvidenceSection stageKey="paper_analysis" categories={['paper_analysis']} />
    </div>
  );
}
