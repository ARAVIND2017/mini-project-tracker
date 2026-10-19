import { useState } from 'react';
import { ListField, TextAreaField, TextField } from '@/components/ui';
import { cleanList, isEditable } from '@/domain/workspace';
import { saveExploration, submitRecord } from '@/lib/research';
import { EvidenceSection } from './EvidenceSection';
import { ReviewSection } from './ReviewSection';
import { LockedNote, RecordStatus, SaveButtons } from './StageParts';
import { useWorkspace } from './workspaceContext';

interface Source {
  name: string;
  url: string;
}

function readSources(value: unknown): Source[] {
  if (!Array.isArray(value)) return [];
  return value.map((s) => ({
    name: typeof s?.name === 'string' ? s.name : '',
    url: typeof s?.url === 'string' ? s.url : '',
  }));
}

/** S1: candidate topics, keywords, sources searched and a proposed research problem. */
export function ExplorationStage() {
  const { ws, viewer, readOnly, act } = useWorkspace();
  const record = ws.exploration;
  const editable = viewer.isStudent && !readOnly && isEditable(record?.status);
  const [topics, setTopics] = useState<string[]>(record?.candidate_topics ?? []);
  const [keywords, setKeywords] = useState<string[]>(record?.keywords ?? []);
  const [sources, setSources] = useState<Source[]>(readSources(record?.sources));
  const [problem, setProblem] = useState(record?.proposed_problem ?? '');
  const projectId = ws.project.id as string;

  const data = () => ({
    candidate_topics: cleanList(topics),
    keywords: cleanList(keywords),
    sources: sources.filter((s) => s.name.trim() || s.url.trim()),
    proposed_problem: problem,
  });
  const rows = sources.length ? sources : [{ name: '', url: '' }];

  return (
    <div>
      <RecordStatus
        status={record?.status ?? null}
        submittedAt={record?.submitted_at}
        decidedAt={record?.decided_at}
        decidedBy={record?.decided_by}
      />
      {viewer.isStudent && <LockedNote status={record?.status} />}
      {!record && !viewer.isStudent ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The student has not started the exploration yet.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <ListField
            label="Candidate topics"
            values={topics}
            onChange={setTopics}
            disabled={!editable}
            addLabel="Add a topic"
          />
          <ListField
            label="Research keywords"
            hint="At least 3."
            values={keywords}
            onChange={setKeywords}
            disabled={!editable}
            addLabel="Add a keyword"
          />
          <fieldset>
            <legend className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Sources searched
            </legend>
            <div className="mt-1 space-y-2">
              {rows.map((s, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  <TextField
                    label={`Source ${i + 1} name`}
                    placeholder="e.g. a digital library"
                    value={s.name}
                    disabled={!editable}
                    onChange={(e) =>
                      setSources(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                    }
                  />
                  <TextField
                    label={`Source ${i + 1} link`}
                    placeholder="https://…"
                    value={s.url}
                    disabled={!editable}
                    onChange={(e) =>
                      setSources(rows.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)))
                    }
                  />
                </div>
              ))}
            </div>
            {editable && (
              <button
                type="button"
                className="mt-2 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
                onClick={() => setSources([...rows, { name: '', url: '' }])}
              >
                + Add a source
              </button>
            )}
          </fieldset>
          <TextAreaField
            label="Proposed research problem"
            hint="At least 50 characters, in your own words."
            rows={4}
            value={problem}
            disabled={!editable}
            onChange={(e) => setProblem(e.target.value)}
          />
          {editable && (
            <SaveButtons
              onSave={() => act(() => saveExploration(projectId, data()), 'Exploration saved.')}
              onSubmit={() =>
                act(async () => {
                  const id = (await saveExploration(projectId, data())) as string;
                  await submitRecord('exploration', id);
                }, 'Exploration submitted for review.')
              }
            />
          )}
        </form>
      )}
      {record && (
        <ReviewSection
          targetType="exploration"
          targetIds={[record.id]}
          currentId={record.id}
          awaiting={record.status === 'submitted'}
          label="exploration"
        />
      )}
      <EvidenceSection stageKey="exploration" categories={['other']} />
    </div>
  );
}
