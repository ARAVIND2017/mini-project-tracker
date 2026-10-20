import { useState } from 'react';
import { StatusChip } from '@/components/StatusChip';
import { Button, ListField, SelectField, TextAreaField } from '@/components/ui';
import { cleanList } from '@/domain/workspace';
import {
  addressCorrection,
  recordReview,
  resolveCorrection,
  type Correction,
  type ReviewOutcome,
  type ReviewTarget,
} from '@/lib/research';
import { formatWhen } from './format';
import { useWorkspace } from './workspaceContext';

const OUTCOME_LABELS: Record<ReviewOutcome, string> = {
  accepted: 'Accept',
  changes_requested: 'Request changes',
  rejected: 'Reject',
  comment_only: 'Comment only (no decision)',
};

/**
 * Reviews and corrections for one record (or several versions of it), and the review
 * form for faculty. `awaiting` is true while the record waits for a decision.
 */
export function ReviewSection({
  targetType,
  targetIds,
  currentId,
  awaiting,
  label,
  commentOnly = false,
  extraResolver = false,
}: {
  /** Also lets this viewer verify, reopen or waive corrections (panel members on S9). */
  extraResolver?: boolean;
  /** Decisions are made elsewhere (the S9 sign-off); faculty can only comment here. */
  commentOnly?: boolean;
  targetType: ReviewTarget;
  /** Every version the thread should show (e.g. all analysis versions). */
  targetIds: string[];
  /** The version a new review applies to. */
  currentId: string | null;
  awaiting: boolean;
  label: string;
}) {
  const { ws, viewer, readOnly } = useWorkspace();
  const reviews = ws.reviews.filter(
    (r) => r.target_type === targetType && targetIds.includes(r.target_id),
  );
  const outstanding = ws.corrections.filter(
    (c) =>
      currentId && c.target_id === currentId && (c.status === 'open' || c.status === 'addressed'),
  ).length;

  return (
    <section aria-label={`Reviews of the ${label}`} className="mt-6 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Reviews and corrections
      </h3>
      {reviews.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">No reviews yet.</p>
      ) : (
        <ol className="space-y-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip family="review_outcome" value={r.outcome} />
                <span className="font-medium">{ws.names[r.reviewer_id] ?? 'Faculty member'}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatWhen(r.created_at)}
                </span>
              </div>
              {r.observations && <p className="mt-2 whitespace-pre-line">{r.observations}</p>}
              {r.comments && (
                <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-slate-300">
                  {r.comments}
                </p>
              )}
              {ws.corrections.some((c) => c.review_id === r.id) && (
                <ul className="mt-3 space-y-2">
                  {ws.corrections
                    .filter((c) => c.review_id === r.id)
                    .map((c) => (
                      <CorrectionItem
                        key={c.id}
                        correction={c}
                        canResolve={viewer.isReviewer || extraResolver}
                      />
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
      {viewer.isFaculty && !readOnly && currentId && (
        <ReviewForm
          targetType={targetType}
          targetId={currentId}
          canDecide={viewer.isReviewer && awaiting && !commentOnly}
          isReviewer={viewer.isReviewer}
          outstanding={outstanding}
          label={label}
        />
      )}
    </section>
  );
}

function CorrectionItem({
  correction: c,
  canResolve,
}: {
  correction: Correction;
  canResolve: boolean;
}) {
  const { ws, viewer, readOnly, busy, act } = useWorkspace();
  const [mode, setMode] = useState<'address' | 'reopen' | 'waive' | null>(null);
  const [text, setText] = useState('');

  const submit = async () => {
    const ok =
      mode === 'address'
        ? await act(() => addressCorrection(c.id, text), 'Correction marked as addressed.')
        : mode === 'reopen'
          ? await act(() => resolveCorrection(c.id, 'reopen', text), 'Correction reopened.')
          : await act(() => resolveCorrection(c.id, 'waive', text), 'Correction waived.');
    if (ok) {
      setMode(null);
      setText('');
    }
  };

  return (
    <li className="rounded-md bg-slate-50 p-2 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p>
          <span className="sr-only">Correction: </span>
          {c.description}
        </p>
        <StatusChip family="correction_status" value={c.status} />
      </div>
      {c.student_response && (
        <p className="mt-1 text-xs">
          <span className="font-medium">Student response:</span> {c.student_response}
        </p>
      )}
      {c.resolution_note && (
        <p className="mt-1 text-xs">
          <span className="font-medium">
            Note{c.resolved_by ? ` from ${ws.names[c.resolved_by] ?? 'reviewer'}` : ''}:
          </span>{' '}
          {c.resolution_note}
        </p>
      )}
      {!readOnly && mode === null && (
        <div className="mt-2 flex flex-wrap gap-2">
          {viewer.isStudent && c.status === 'open' && (
            <Button variant="secondary" onClick={() => setMode('address')}>
              Mark as addressed
            </Button>
          )}
          {canResolve && c.status === 'addressed' && (
            <>
              <Button
                variant="secondary"
                busy={busy}
                onClick={() => act(() => resolveCorrection(c.id, 'verify'), 'Correction verified.')}
              >
                Verify
              </Button>
              <Button variant="secondary" onClick={() => setMode('reopen')}>
                Reopen
              </Button>
            </>
          )}
          {canResolve && (c.status === 'open' || c.status === 'addressed') && (
            <Button variant="secondary" onClick={() => setMode('waive')}>
              Waive
            </Button>
          )}
        </div>
      )}
      {mode && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <TextAreaField
            label={
              mode === 'address'
                ? 'What did you change?'
                : mode === 'reopen'
                  ? 'Why is it not resolved yet?'
                  : 'Why is this correction waived?'
            }
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" busy={busy}>
              {mode === 'address' ? 'Save response' : mode === 'reopen' ? 'Reopen' : 'Waive'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function ReviewForm({
  targetType,
  targetId,
  canDecide,
  outstanding,
  label,
  isReviewer,
}: {
  targetType: ReviewTarget;
  targetId: string;
  canDecide: boolean;
  isReviewer: boolean;
  outstanding: number;
  label: string;
}) {
  const { busy, act } = useWorkspace();
  const outcomes: ReviewOutcome[] = canDecide
    ? ['accepted', 'changes_requested', 'rejected', 'comment_only']
    : ['comment_only'];
  const [outcome, setOutcome] = useState<ReviewOutcome>(outcomes[0] ?? 'comment_only');
  const [observations, setObservations] = useState('');
  const [comments, setComments] = useState('');
  const [corrections, setCorrections] = useState<string[]>(['']);
  const effective = outcomes.includes(outcome) ? outcome : 'comment_only';
  const needsCorrections = effective === 'changes_requested' || effective === 'rejected';

  return (
    <form
      aria-label={`Review the ${label}`}
      className="space-y-3 rounded-md border border-dashed border-slate-300 p-3 dark:border-slate-700"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await act(
          () =>
            recordReview({
              targetType,
              targetId,
              outcome: effective,
              observations,
              comments,
              corrections: needsCorrections ? cleanList(corrections) : [],
            }),
          effective === 'comment_only' ? 'Comment saved.' : 'Review recorded.',
        );
        if (ok) {
          setObservations('');
          setComments('');
          setCorrections(['']);
        }
      }}
    >
      <h4 className="text-sm font-semibold">
        {canDecide ? `Review the ${label}` : `Comment on the ${label}`}
      </h4>
      {!canDecide && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isReviewer
            ? 'Nothing is waiting for your decision right now. You can add a comment.'
            : 'Decisions are recorded by a reviewer of this project while the work is waiting for review. You can add a comment.'}
        </p>
      )}
      {canDecide && outstanding > 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          ! {outstanding} correction(s) still need to be verified or waived before you can accept.
        </p>
      )}
      {canDecide && (
        <SelectField
          label="Outcome"
          value={effective}
          onChange={(e) => setOutcome(e.target.value as ReviewOutcome)}
        >
          {outcomes.map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABELS[o]}
            </option>
          ))}
        </SelectField>
      )}
      <TextAreaField
        label="Observations"
        hint={effective === 'rejected' ? 'Required: the reason for rejecting.' : undefined}
        value={observations}
        onChange={(e) => setObservations(e.target.value)}
      />
      <TextAreaField
        label="Comments"
        rows={2}
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      />
      {needsCorrections && (
        <ListField
          label="Corrections"
          hint="Each correction is tracked until it is verified or waived."
          values={corrections}
          onChange={setCorrections}
          addLabel="Add a correction"
        />
      )}
      <Button type="submit" busy={busy}>
        {effective === 'comment_only' ? 'Save comment' : 'Record review'}
      </Button>
    </form>
  );
}
