import { useState } from 'react';
import { StatusChip } from '@/components/StatusChip';
import { Alert, Button, LoadingState, TextAreaField, TextField } from '@/components/ui';
import { ENUMS } from '@/domain/constants';
import { isEditable, latestVersion } from '@/domain/workspace';
import { newDraftVersion, saveDraft, type DraftSection, type PaperDraft } from '@/lib/final';
import { submitRecord } from '@/lib/research';
import { DRAFT_SECTION_LABELS } from './format';
import { ReviewSection } from './ReviewSection';
import { SaveButtons } from './StageParts';
import { useFinalData } from './useFinalData';
import { useWorkspace } from './workspaceContext';

/** S8: the ten sections of the paper, each a Drive/Docs link, versioned and approved one by one. */
export function WritingStage() {
  const data = useFinalData();
  const [open, setOpen] = useState<DraftSection | null>(null);
  if (data.isPending) return <LoadingState />;
  if (data.error) return <Alert tone="error">{data.error.message}</Alert>;
  const approved = ENUMS.draft_section.filter((s) =>
    data.data.drafts.some((d) => d.section === s && d.status === 'approved'),
  ).length;

  return (
    <div>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Write each section in your Google Drive and link it here. Sections can be drafted early (the
        literature review from week 5) and are approved one by one; S8 is complete when all ten are
        approved. <strong>{approved}</strong> of 10 approved.
      </p>
      <ul className="space-y-2">
        {ENUMS.draft_section.map((section) => {
          const versions = data.data.drafts.filter((d) => d.section === section);
          const latest = latestVersion(versions);
          return (
            <li key={section} className="rounded-md border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                aria-expanded={open === section}
                onClick={() => setOpen(open === section ? null : section)}
                className="flex w-full flex-wrap items-center gap-2 p-2 text-left text-sm"
              >
                <span className="font-medium">{DRAFT_SECTION_LABELS[section]}</span>
                {latest ? (
                  <>
                    <StatusChip family="record_status" value={latest.status} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      v{latest.version}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">Not started</span>
                )}
              </button>
              {open === section && (
                <SectionDetail
                  key={latest ? `${latest.id}:${latest.updated_at}` : 'new'}
                  section={section}
                  versions={versions}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SectionDetail({ section, versions }: { section: DraftSection; versions: PaperDraft[] }) {
  const { ws, viewer, readOnly, busy, act } = useWorkspace();
  const latest = latestVersion(versions);
  const editable = viewer.isStudent && !readOnly && isEditable(latest?.status);
  const [docUrl, setDocUrl] = useState(latest?.doc_url ?? '');
  const [notes, setNotes] = useState(latest?.notes ?? '');
  const projectId = ws.project.id as string;
  const data = () => ({ doc_url: docUrl, notes });

  return (
    <div className="space-y-3 border-t border-slate-200 p-3 text-sm dark:border-slate-700">
      {latest?.doc_url && !editable && (
        <a
          href={latest.doc_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 underline dark:text-blue-300"
        >
          Open version {latest.version}
        </a>
      )}
      {editable && (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <TextField
            label={`${DRAFT_SECTION_LABELS[section]}: document link`}
            placeholder="https://docs.google.com/…"
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
          />
          <TextAreaField
            label="Notes for the reviewer"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <SaveButtons
            onSave={() => act(() => saveDraft(projectId, section, data()), 'Section saved.')}
            onSubmit={() =>
              act(async () => {
                const id = (await saveDraft(projectId, section, data())) as string;
                await submitRecord('draft_section', id);
              }, 'Section submitted for review.')
            }
          />
        </form>
      )}
      {viewer.isStudent && !readOnly && latest?.status === 'approved' && (
        <Button
          variant="secondary"
          busy={busy}
          onClick={() => act(() => newDraftVersion(projectId, section), 'New version started.')}
        >
          Start a new version
        </Button>
      )}
      {versions.length > 1 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Versions:{' '}
          {[...versions]
            .reverse()
            .map((v) => `v${v.version} ${v.status.replace('_', ' ')}`)
            .join(' · ')}
        </p>
      )}
      {latest && (
        <ReviewSection
          targetType="draft_section"
          targetIds={versions.map((v) => v.id)}
          currentId={latest.id}
          awaiting={latest.status === 'submitted'}
          label={DRAFT_SECTION_LABELS[section].toLowerCase()}
        />
      )}
    </div>
  );
}
