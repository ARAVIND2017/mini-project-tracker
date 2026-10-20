import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StatusChip } from '@/components/StatusChip';
import {
  Alert,
  Button,
  ListField,
  LoadingState,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui';
import { cleanList, isStageDone } from '@/domain/workspace';
import { profileNames } from '@/lib/api';
import type { Enums } from '@/lib/database.types';
import {
  recordSignoff,
  setDeliverable,
  verifyDeliverable,
  type Deliverable,
  type FinalData,
} from '@/lib/final';
import { submitRecord } from '@/lib/research';
import { DELIVERABLE_LABELS, formatWhen } from './format';
import { ReviewSection } from './ReviewSection';
import { useActiveContext } from '../auth/authContext';
import { useFinalData } from './useFinalData';
import { useWorkspace } from './workspaceContext';

const DUPLICATE_LABELS: Record<string, string> = {
  paper_doi: 'Same paper DOI as another project',
  paper_title: 'Same paper title as another project',
  repository_url: 'Same code repository as another project',
  project_title: 'Same project title as another project',
};

/** S9: the final checklist, the sign-off summary for the panel, and the panel's decisions. */
export function FinalStage() {
  const { ws, viewer, readOnly, busy, act } = useWorkspace();
  const ctx = useActiveContext();
  const data = useFinalData();
  const panelIds = data.data?.panel?.memberIds ?? [];
  const names = useQuery({
    queryKey: ['names', ...panelIds],
    queryFn: () => profileNames(panelIds),
    enabled: panelIds.length > 0,
  });

  if (data.isPending) return <LoadingState />;
  if (data.error) return <Alert tone="error">{data.error.message}</Alert>;

  const d = data.data;
  const status = ws.stages.find((s) => s.stage_key === 'final')?.status ?? 'not_started';
  const locked = status === 'awaiting_approval' || status === 'approved';
  const isPanelMember = panelIds.includes(ctx.user_id);
  const canVerify = (viewer.isReviewer || isPanelMember) && !readOnly;
  const projectId = ws.project.id as string;
  const verified = d.deliverables.filter((x) => x.verification === 'verified').length;
  const outstanding = ws.corrections.filter(
    (c) => c.status === 'open' || c.status === 'addressed',
  ).length;
  const s7 = isStageDone(ws.stages.find((s) => s.stage_key === 'evaluation')?.status);
  const s8 = isStageDone(ws.stages.find((s) => s.stage_key === 'paper_writing')?.status);

  return (
    <div className="space-y-6">
      {ws.project.is_completed && (
        <Alert tone="success">✓ The panel signed off. This project is complete.</Alert>
      )}

      <section aria-label="Final checklist">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Final checklist · {verified} of {d.deliverables.length} verified
        </h3>
        <ul className="space-y-2">
          {d.deliverables
            .slice()
            .sort((a, b) => order(a.item) - order(b.item))
            .map((x) => (
              <DeliverableRow
                key={x.id}
                deliverable={x}
                editable={viewer.isStudent && !readOnly && !locked}
                canVerify={canVerify}
              />
            ))}
        </ul>
        {viewer.isStudent && !readOnly && !locked && (
          <div className="mt-3">
            <Button
              busy={busy}
              onClick={() =>
                act(() => submitRecord('final', projectId), 'Submitted for the panel sign-off.')
              }
            >
              Submit for final sign-off
            </Button>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Needs S7 and S8 approved, every checklist item added, and a panel assigned by the HOD.
            </p>
          </div>
        )}
        {viewer.isStudent && status === 'awaiting_approval' && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Submitted. The panel is reviewing your project.
          </p>
        )}
      </section>

      <SignoffSummary
        data={d}
        names={names.data ?? {}}
        s7={s7}
        s8={s8}
        outstanding={outstanding}
        verified={verified}
      />

      {isPanelMember && !readOnly && status === 'awaiting_approval' && <SignoffForm />}

      <ReviewSection
        targetType="final"
        targetIds={[projectId]}
        currentId={projectId}
        awaiting={status === 'awaiting_approval'}
        label="final submission"
        commentOnly
        extraResolver={isPanelMember}
      />
    </div>
  );
}

const ITEMS: Enums<'deliverable_item'>[] = [
  'final_paper',
  'project_report',
  'source_repository',
  'source_zip',
  'readme',
  'dataset_references',
  'presentation',
  'demo_evidence',
];
const order = (item: Enums<'deliverable_item'>) => ITEMS.indexOf(item);

function DeliverableRow({
  deliverable: x,
  editable,
  canVerify,
}: {
  deliverable: Deliverable;
  editable: boolean;
  canVerify: boolean;
}) {
  const { ws, busy, act } = useWorkspace();
  const evidence = ws.evidence.find((e) => e.id === x.evidence_id);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [rejecting, setRejecting] = useState<'rejected' | 'inaccessible' | null>(null);
  const [note, setNote] = useState('');
  const label = DELIVERABLE_LABELS[x.item];

  return (
    <li className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{label}</span>
        {evidence ? (
          <StatusChip family="evidence_verification" value={x.verification} />
        ) : (
          <span className="text-xs text-amber-800 dark:text-amber-300">! Not added yet</span>
        )}
        {evidence && (
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline dark:text-blue-300"
          >
            {evidence.description}
          </a>
        )}
      </div>
      {x.verification_note && <p className="mt-1 text-xs">Note: {x.verification_note}</p>}
      {x.verified_at && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Checked {formatWhen(x.verified_at)}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {editable && !editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {evidence ? 'Replace link' : 'Add link'}
          </Button>
        )}
        {canVerify && evidence && !rejecting && (
          <>
            {x.verification !== 'verified' && (
              <Button
                variant="secondary"
                busy={busy}
                onClick={() => act(() => verifyDeliverable(x.id, 'verified'), `${label} verified.`)}
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
          </>
        )}
      </div>
      {editing && (
        <form
          aria-label={`Change: ${label}`}
          className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act(
                () => setDeliverable(ws.project.id as string, x.item, url, description),
                `${label} saved.`,
              )
            ) {
              setEditing(false);
              setUrl('');
              setDescription('');
            }
          }}
        >
          <TextField
            label={`${label} link`}
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <TextField
            label={`${label} description`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button type="submit" busy={busy}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      )}
      {rejecting && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await act(() => verifyDeliverable(x.id, rejecting, note), 'Checklist item updated.')
            )
              setRejecting(null);
          }}
        >
          <TextField
            className="min-w-64 flex-1"
            label="What is wrong?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
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

function SignoffSummary({
  data: d,
  names,
  s7,
  s8,
  outstanding,
  verified,
}: {
  data: FinalData;
  names: Record<string, string>;
  s7: boolean;
  s8: boolean;
  outstanding: number;
  verified: number;
}) {
  const t = d.timeliness;
  const check = (ok: boolean, text: string) => (
    <li className={ok ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}>
      {ok ? '✓' : '✕'} {text}
    </li>
  );
  return (
    <section
      aria-label="Sign-off summary"
      className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"
    >
      <h3 className="mb-2 font-semibold">Sign-off summary</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <h4 className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            Preconditions
          </h4>
          <ul className="mt-1 space-y-1">
            {check(s7, 'S7 evaluation approved')}
            {check(s8, 'S8 paper approved')}
            {check(
              verified === d.deliverables.length,
              `Checklist verified (${verified}/${d.deliverables.length})`,
            )}
            {check(outstanding === 0, `${outstanding} correction(s) open or addressed`)}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            Timeliness
          </h4>
          {t ? (
            <ul className="mt-1 space-y-1">
              <li>Tasks due so far: {t.tasks_due}</li>
              <li>Submitted on time: {t.submitted_on_time}</li>
              <li>
                Submitted late: {t.submitted_late}
                {t.avg_days_late != null && ` (avg ${t.avg_days_late} days)`}
              </li>
              <li>Overdue without a submission: {t.overdue_without_submission}</li>
              <li>Review cycles per task: {t.avg_review_cycles ?? '—'}</li>
            </ul>
          ) : (
            <p className="mt-1">No tasks yet.</p>
          )}
        </div>
        <div>
          <h4 className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            Uniqueness
          </h4>
          {d.duplicates.length === 0 ? (
            <p className="mt-1 text-green-800 dark:text-green-300">
              ✓ No shared paper, repository or title found
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {d.duplicates.map((w) => (
                <li key={`${w.kind}-${w.value}`} className="text-amber-800 dark:text-amber-300">
                  ! {DUPLICATE_LABELS[w.kind ?? ''] ?? w.kind}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <h4 className="mt-4 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
        Panel {d.panel ? `· ${d.panel.panel.name}` : ''}
      </h4>
      {!d.panel ? (
        <p className="mt-1">The HOD has not assigned a panel yet.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {d.panel.memberIds.map((id) => {
            const s = d.signoffs.find((x) => x.panel_member_id === id);
            return (
              <li key={id}>
                <span className="font-medium">{names[id] ?? 'Panel member'}</span>:{' '}
                {s ? (
                  <>
                    {s.decision === 'approve' ? '✓ Approved' : '! Changes required'} ·{' '}
                    {formatWhen(s.updated_at)} · “{s.originality_remark}”
                  </>
                ) : (
                  'no decision yet'
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SignoffForm() {
  const { ws, busy, act } = useWorkspace();
  const [decision, setDecision] = useState<Enums<'signoff_decision'>>('approve');
  const [remark, setRemark] = useState('');
  const [comments, setComments] = useState('');
  const [corrections, setCorrections] = useState<string[]>(['']);
  return (
    <form
      aria-label="Panel sign-off"
      className="space-y-3 rounded-md border border-dashed border-slate-300 p-3 dark:border-slate-700"
      onSubmit={async (e) => {
        e.preventDefault();
        await act(
          () =>
            recordSignoff({
              projectId: ws.project.id as string,
              decision,
              originalityRemark: remark,
              comments,
              corrections: decision === 'changes_required' ? cleanList(corrections) : [],
            }),
          'Sign-off recorded.',
        );
      }}
    >
      <h4 className="font-semibold">Your sign-off</h4>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        The panel decides; the system only checks that the preconditions are met.
      </p>
      <SelectField
        label="Decision"
        value={decision}
        onChange={(e) => setDecision(e.target.value as Enums<'signoff_decision'>)}
      >
        <option value="approve">Approve</option>
        <option value="changes_required">Changes required</option>
      </SelectField>
      <TextAreaField
        label="Originality remark"
        hint="Required: how original is the work compared with the paper it builds on?"
        rows={2}
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
      />
      <TextAreaField
        label="Comments"
        rows={2}
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      />
      {decision === 'changes_required' && (
        <ListField
          label="Corrections"
          values={corrections}
          onChange={setCorrections}
          addLabel="Add a correction"
        />
      )}
      <Button type="submit" busy={busy}>
        Record sign-off
      </Button>
    </form>
  );
}
