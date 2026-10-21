import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Alert,
  Button,
  Card,
  ListField,
  LoadingState,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui';
import { isFacultyLevel } from '@/domain/context';
import { cleanList } from '@/domain/workspace';
import { getSemester, listMembers, profileNames } from '@/lib/api';
import { listMeetings, listOverview, recordMeeting, type MeetingWithDetails } from '@/lib/reports';
import { useActiveContext } from '../auth/authContext';
import { formatWhen } from '../research/format';
import { SemesterNav } from '../semesters/SemesterNav';
import { StaffOnly } from '../semesters/StaffOnly';

/** Review meetings (UI_UX_SPEC M1): who attended and the outcome for each project discussed. */
export function MeetingsPage() {
  return (
    <StaffOnly>
      <MeetingsContent />
    </StaffOnly>
  );
}

function MeetingsContent() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const meetings = useQuery({
    queryKey: ['meetings', semesterId],
    queryFn: () => listMeetings(semesterId),
  });
  const projects = useQuery({
    queryKey: ['overview', semesterId],
    queryFn: () => listOverview(semesterId),
  });
  const recorders = useQuery({
    queryKey: ['names', (meetings.data ?? []).map((m) => m.recorded_by).join(',')],
    queryFn: () => profileNames([...new Set((meetings.data ?? []).map((m) => m.recorded_by))]),
    enabled: !!meetings.data?.length,
  });
  const members = useQuery({
    queryKey: ['members', semesterId],
    queryFn: () => listMembers(semesterId),
  });
  const [adding, setAdding] = useState(false);
  const canRecord = isFacultyLevel(ctx, semesterId) && semester.data?.status === 'active';

  if (meetings.isPending || projects.isPending) {
    return (
      <>
        <SemesterNav />
        <LoadingState />
      </>
    );
  }
  if (meetings.error) return <Alert tone="error">{meetings.error.message}</Alert>;

  const memberNames: Record<string, string> = Object.fromEntries(
    (members.data ?? []).map((m) => [m.user_id, m.profile?.full_name ?? 'Member']),
  );
  const studentOf: Record<string, string> = Object.fromEntries(
    (projects.data ?? []).map((p) => [p.id ?? '', p.student_name ?? `Slot ${p.slot_no}`]),
  );

  return (
    <div>
      <SemesterNav />
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        A record of review meetings. Each student sees only the outcome for their own project.
        Meetings cannot be edited once recorded.
      </p>
      {canRecord && !adding && (
        <Button className="mb-4" onClick={() => setAdding(true)}>
          Record a meeting
        </Button>
      )}
      {adding && (
        <div className="mb-6">
          <MeetingForm
            semesterId={semesterId}
            projects={(projects.data ?? []).filter((p) => p.roster_status !== 'withdrawn')}
            members={(members.data ?? []).filter((m) => m.is_active)}
            onDone={() => setAdding(false)}
          />
        </div>
      )}
      {meetings.data.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">No meetings recorded yet.</p>
        </Card>
      ) : (
        <ol className="space-y-4">
          {meetings.data.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              recordedBy={
                recorders.data?.[m.recorded_by] ?? memberNames[m.recorded_by] ?? 'Faculty member'
              }
              memberNames={memberNames}
              studentOf={studentOf}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function MeetingCard({
  meeting: m,
  recordedBy,
  memberNames,
  studentOf,
}: {
  meeting: MeetingWithDetails;
  recordedBy: string;
  memberNames: Record<string, string>;
  studentOf: Record<string, string>;
}) {
  return (
    <li>
      <Card
        title={m.title}
        actions={
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {formatWhen(m.held_on)}
          </span>
        }
      >
        <p className="text-xs text-slate-500 dark:text-slate-400">Recorded by {recordedBy}</p>
        {m.notes && <p className="mt-2 whitespace-pre-line text-sm">{m.notes}</p>}
        {m.attendees.length > 0 && (
          <p className="mt-2 text-sm">
            <span className="font-medium">Attended:</span>{' '}
            {m.attendees.map((a) => memberNames[a.user_id] ?? 'Member').join(', ')}
          </p>
        )}
        {m.outcomes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {m.outcomes.map((o) => (
              <li key={o.id} className="rounded-md bg-slate-50 p-2 text-sm dark:bg-slate-800/50">
                <Link
                  to={`/projects/${o.project_id}`}
                  className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                >
                  {studentOf[o.project_id] ?? 'Project'}
                </Link>
                <p className="mt-1 whitespace-pre-line">{o.outcome}</p>
                {o.action_items.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {o.action_items.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </li>
  );
}

interface OutcomeDraft {
  key: number;
  projectId: string;
  outcome: string;
  actions: string[];
}

function MeetingForm({
  semesterId,
  projects,
  members,
  onDone,
}: {
  semesterId: string;
  projects: {
    id: string | null;
    student_name: string | null;
    slot_no: number | null;
    student_user_id: string | null;
  }[];
  members: { user_id: string; role: string; profile: { full_name: string } | null }[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [heldOn, setHeldOn] = useState('');
  const [notes, setNotes] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeDraft[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const save = useMutation({
    mutationFn: () =>
      recordMeeting({
        semesterId,
        heldOn: new Date(heldOn).toISOString(),
        title,
        notes,
        attendeeIds: attendees,
        outcomes: outcomes
          .filter((o) => o.projectId)
          .map((o) => ({
            project_id: o.projectId,
            outcome: o.outcome,
            action_items: cleanList(o.actions),
          })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meetings', semesterId] });
      onDone();
    },
  });
  const update = (key: number, patch: Partial<OutcomeDraft>) =>
    setOutcomes((list) => list.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const faculty = members.filter((m) => m.role !== 'student');
  const students = members.filter((m) => m.role === 'student');

  return (
    <Card title="Record a meeting">
      <form
        aria-label="Record a meeting"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!heldOn) return;
          save.mutate();
        }}
      >
        {save.error && <Alert tone="error">{save.error.message}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Title"
            value={title}
            required
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label="Held on"
            type="datetime-local"
            required
            value={heldOn}
            onChange={(e) => setHeldOn(e.target.value)}
          />
        </div>
        <TextAreaField
          label="Notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <fieldset>
          <legend className="text-sm font-medium">Attended</legend>
          <div className="mt-1 grid gap-1 text-sm sm:grid-cols-3">
            {[...faculty, ...students].map((m) => (
              <label key={m.user_id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={attendees.includes(m.user_id)}
                  onChange={(e) =>
                    setAttendees((a) =>
                      e.target.checked ? [...a, m.user_id] : a.filter((x) => x !== m.user_id),
                    )
                  }
                />
                {m.profile?.full_name ?? 'Member'}
                {m.role === 'student' && <span className="text-xs text-slate-500">(student)</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Outcomes by project</legend>
          {outcomes.map((o, i) => (
            <div
              key={o.key}
              className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-800"
            >
              <SelectField
                label={`Project for outcome ${i + 1}`}
                value={o.projectId}
                onChange={(e) => update(o.key, { projectId: e.target.value })}
              >
                <option value="">Choose a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id ?? ''}>
                    {p.student_name ?? `Slot ${p.slot_no} (no name yet)`}
                  </option>
                ))}
              </SelectField>
              <TextAreaField
                label={`Outcome ${i + 1}`}
                rows={2}
                value={o.outcome}
                onChange={(e) => update(o.key, { outcome: e.target.value })}
              />
              <ListField
                label={`Action items for outcome ${i + 1}`}
                values={o.actions}
                onChange={(actions) => update(o.key, { actions })}
                addLabel="Add an action item"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOutcomes((list) => list.filter((x) => x.key !== o.key))}
              >
                Remove outcome {i + 1}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOutcomes((list) => [
                ...list,
                { key: nextKey, projectId: '', outcome: '', actions: [''] },
              ]);
              setNextKey((k) => k + 1);
            }}
          >
            Add a project outcome
          </Button>
        </fieldset>
        <div className="flex gap-2">
          <Button type="submit" busy={save.isPending}>
            Save meeting
          </Button>
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
