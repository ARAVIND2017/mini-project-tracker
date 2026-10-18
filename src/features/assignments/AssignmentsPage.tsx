import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { Alert, Button, Card, LoadingState, SelectField, TextField } from '@/components/ui';
import { isHod, membershipFor } from '@/domain/context';
import {
  cancelAssignmentRequest,
  decideAssignmentRequest,
  getSemester,
  grantReviewAuthorization,
  listAssignmentRequests,
  listDomains,
  listExpertise,
  listProjects,
  listReviewAuthorizations,
  requestAssignment,
  revokeReviewAuthorization,
  setExpertise,
  type ProjectRow,
} from '@/lib/api';
import type { Enums } from '@/lib/database.types';
import { useActiveContext } from '../auth/authContext';
import { useFacultyOptions } from '../projects/useFacultyOptions';
import { SemesterNav } from '../semesters/SemesterNav';
import { useProfileNames } from '../semesters/useSemesterNames';

const TYPE_LABEL: Record<Enums<'assignment_type'>, string> = {
  guide: 'Guide',
  co_reviewer: 'Co-reviewer',
};
const STATUS_LABEL: Record<Enums<'request_status'>, string> = {
  pending: '◐ Waiting for the HOD',
  approved: '✓ Approved',
  rejected: '✕ Rejected',
  cancelled: '○ Cancelled',
};

function askReason(prompt: string): string | null {
  const value = window.prompt(prompt);
  if (value === null) return null;
  return value.trim();
}

export function AssignmentsPage() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const hod = isHod(ctx);
  const lead = membershipFor(ctx, semesterId)?.role === 'lead_faculty';
  const queryClient = useQueryClient();

  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const domains = useQuery({
    queryKey: ['domains', semesterId],
    queryFn: () => listDomains(semesterId),
  });
  const expertise = useQuery({
    queryKey: ['expertise', semesterId],
    queryFn: () => listExpertise(semesterId),
  });
  const projects = useQuery({
    queryKey: ['projects', semesterId],
    queryFn: () => listProjects(semesterId),
  });
  const requests = useQuery({
    queryKey: ['requests', semesterId],
    queryFn: () => listAssignmentRequests(semesterId),
  });
  const authorizations = useQuery({
    queryKey: ['authorizations', semesterId],
    queryFn: () => listReviewAuthorizations(semesterId),
  });
  const faculty = useFacultyOptions(semesterId, ctx);
  const closed = semester.data?.status === 'closed';

  const nameOf = useProfileNames([
    ...(requests.data ?? []).flatMap((r) => [r.faculty_id, r.requested_by, r.decided_by]),
    ...(authorizations.data ?? []).flatMap((a) => [a.faculty_id, a.granted_by]),
  ]);

  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const action = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () =>
      Promise.all(
        ['requests', 'projects', 'authorizations', 'expertise'].map((k) =>
          queryClient.invalidateQueries({ queryKey: [k, semesterId] }),
        ),
      ),
    onError: (err) => setMessage({ tone: 'error', text: err.message }),
  });
  const run = (fn: () => Promise<unknown>, success: string, after?: () => void) => {
    setMessage(null);
    action.mutate(fn, {
      onSuccess: () => {
        setMessage({ tone: 'success', text: success });
        after?.();
      },
    });
  };

  if (projects.isPending || requests.isPending || domains.isPending || expertise.isPending) {
    return (
      <>
        <SemesterNav />
        <LoadingState />
      </>
    );
  }
  const loadError = projects.error ?? requests.error ?? domains.error ?? expertise.error;
  if (loadError) return <Alert tone="error">{loadError.message}</Alert>;

  const projectList = projects.data ?? [];
  const requestList = requests.data ?? [];
  const projectLabel = (id: string) => {
    const p = projectList.find((x) => x.id === id);
    return p ? `Slot ${p.slot_no} · ${p.student_name}` : 'Project';
  };
  const myDomainIds = (expertise.data ?? [])
    .filter((e) => e.user_id === ctx.user_id)
    .map((e) => e.domain_id);
  const activeDomains = (domains.data ?? []).filter((d) => d.is_active);
  const myProjects = projectList.filter(
    (p) => p.domain_id && myDomainIds.includes(p.domain_id) && p.roster_status !== 'withdrawn',
  );
  const pending = requestList.filter((r) => r.status === 'pending');
  const decided = requestList.filter((r) => r.status !== 'pending');
  const myPendingFor = (projectId: string, type: Enums<'assignment_type'>) =>
    pending.some(
      (r) => r.project_id === projectId && r.faculty_id === ctx.user_id && r.type === type,
    );

  return (
    <div className="space-y-6">
      <SemesterNav />
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {closed && <Alert>This semester is closed; assignments can no longer change.</Alert>}

      {!closed && (
        <ExpertiseCard
          domains={activeDomains}
          selected={myDomainIds}
          busy={action.isPending}
          onSave={(ids) =>
            run(() => setExpertise(semesterId, ids), 'Your domains of expertise are saved.')
          }
        />
      )}

      {!closed && (
        <Card title="Projects in your domains">
          {myDomainIds.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Choose your domains of expertise above to see matching projects.
            </p>
          ) : myProjects.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No projects in your domains yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {myProjects.map((p) => (
                <ProjectRequestRow
                  key={p.id}
                  project={p}
                  me={ctx.user_id}
                  busy={action.isPending}
                  guidePending={myPendingFor(p.id as string, 'guide')}
                  coPending={myPendingFor(p.id as string, 'co_reviewer')}
                  onRequest={(type) => {
                    const reason = askReason(
                      `Why do you want to be the ${TYPE_LABEL[type].toLowerCase()} for ${p.student_name}? (at least 5 characters)`,
                    );
                    if (reason === null) return;
                    run(
                      () => requestAssignment(p.id as string, type, ctx.user_id, reason),
                      'Request sent to the HOD.',
                    );
                  }}
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      {(lead || hod) && !closed && (
        <ProposeCard
          projects={projectList.filter((p) => p.roster_status !== 'withdrawn')}
          faculty={faculty.options}
          busy={action.isPending}
          onPropose={(projectId, type, facultyId, reason) =>
            run(
              () => requestAssignment(projectId, type, facultyId, reason),
              'Proposal sent to the HOD.',
            )
          }
        />
      )}

      <Card title={`Requests waiting for the HOD (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">Nothing waiting.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="text-sm">
                  <div className="font-medium">
                    {TYPE_LABEL[r.type]}: {nameOf(r.faculty_id)} → {projectLabel(r.project_id)}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">“{r.reason}”</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Requested by {nameOf(r.requested_by)} on{' '}
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                {!closed && (
                  <div className="flex gap-2">
                    {hod && (
                      <>
                        <Button
                          disabled={action.isPending}
                          onClick={() => {
                            const note = askReason('Note for the record (optional):');
                            if (note === null) return;
                            run(
                              () => decideAssignmentRequest(r.id, true, note),
                              'Request approved.',
                            );
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={action.isPending}
                          onClick={() => {
                            const note = askReason('Why is this request rejected?');
                            if (note === null) return;
                            run(
                              () => decideAssignmentRequest(r.id, false, note),
                              'Request rejected.',
                            );
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {(r.requested_by === ctx.user_id || hod) && (
                      <Button
                        variant="secondary"
                        disabled={action.isPending}
                        onClick={() =>
                          window.confirm('Cancel this request?') &&
                          run(() => cancelAssignmentRequest(r.id), 'Request cancelled.')
                        }
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(lead || hod) && (
        <AuthorizationsCard
          projects={projectList}
          faculty={faculty.options}
          authorizations={authorizations.data ?? []}
          nameOf={nameOf}
          projectLabel={projectLabel}
          closed={closed}
          busy={action.isPending}
          onGrant={(projectId, facultyId, until, note) =>
            run(
              () =>
                grantReviewAuthorization(
                  projectId,
                  facultyId,
                  until ? new Date(`${until}T23:59:59`).toISOString() : undefined,
                  note,
                ),
              'Review authorization granted.',
            )
          }
          onRevoke={(id) =>
            window.confirm('Revoke this authorization?') &&
            run(() => revokeReviewAuthorization(id), 'Authorization revoked.')
          }
        />
      )}

      <Card title="Decided requests">
        {decided.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">None yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Request</th>
                  <th className="px-4 py-2 font-medium">Requested by</th>
                  <th className="px-4 py-2 font-medium">Result</th>
                  <th className="px-4 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {decided.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      {TYPE_LABEL[r.type]}: {nameOf(r.faculty_id)} → {projectLabel(r.project_id)}
                    </td>
                    <td className="px-4 py-2">{nameOf(r.requested_by)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {STATUS_LABEL[r.status]}
                      {r.decided_at && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {nameOf(r.decided_by)}, {new Date(r.decided_at).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">{r.decision_note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ExpertiseCard({
  domains,
  selected,
  busy,
  onSave,
}: {
  domains: { id: string; name: string }[];
  selected: string[];
  busy: boolean;
  onSave: (ids: string[]) => void;
}) {
  const selectedKey = [...selected].sort().join(',');
  const [draft, setDraft] = useState<{ key: string; ids: string[] }>({
    key: selectedKey,
    ids: selected,
  });
  // When the saved selection changes (after saving), start again from it.
  const ids = draft.key === selectedKey ? draft.ids : selected;
  const setIds = (next: string[]) => setDraft({ key: selectedKey, ids: next });
  const changed = [...ids].sort().join(',') !== [...selected].sort().join(',');
  return (
    <Card title="Your domains of expertise">
      {domains.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The HOD has not added any domains yet.
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
            You can ask to guide or co-review projects in these domains.
          </p>
          <div className="flex flex-wrap gap-3">
            {domains.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ids.includes(d.id)}
                  onChange={(e) =>
                    setIds(e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id))
                  }
                />
                {d.name}
              </label>
            ))}
          </div>
          <Button className="mt-3" busy={busy} disabled={!changed} onClick={() => onSave(ids)}>
            Save expertise
          </Button>
        </>
      )}
    </Card>
  );
}

function ProjectRequestRow({
  project: p,
  me,
  busy,
  guidePending,
  coPending,
  onRequest,
}: {
  project: ProjectRow;
  me: string;
  busy: boolean;
  guidePending: boolean;
  coPending: boolean;
  onRequest: (type: Enums<'assignment_type'>) => void;
}) {
  const isGuide = p.guide_id === me;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <div>
        <div className="font-medium">
          Slot {p.slot_no} · {p.student_name}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {p.domain_name} · Guide: {p.guide_name ?? 'unassigned'}
          {p.title && ` · ${p.title}`}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {isGuide ? (
          <span className="text-green-800 dark:text-green-300">✓ You are the guide</span>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={busy || guidePending}
              onClick={() => onRequest('guide')}
            >
              {guidePending ? 'Guide request sent' : 'Request to guide'}
            </Button>
            <Button
              variant="secondary"
              disabled={busy || coPending}
              onClick={() => onRequest('co_reviewer')}
            >
              {coPending ? 'Co-review request sent' : 'Request to co-review'}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function ProposeCard({
  projects,
  faculty,
  busy,
  onPropose,
}: {
  projects: ProjectRow[];
  faculty: { id: string; name: string }[];
  busy: boolean;
  onPropose: (
    projectId: string,
    type: Enums<'assignment_type'>,
    facultyId: string,
    reason: string,
  ) => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState<Enums<'assignment_type'>>('guide');
  const [facultyId, setFacultyId] = useState('');
  const [reason, setReason] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    onPropose(projectId, type, facultyId, reason.trim());
    setReason('');
  }
  return (
    <Card title="Propose a guide or co-reviewer">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Your proposal goes to the HOD for approval.
      </p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Choose a project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id ?? ''}>
              Slot {p.slot_no} · {p.student_name}{' '}
              {p.domain_name ? `(${p.domain_name})` : '(no domain)'}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Role"
          value={type}
          onChange={(e) => setType(e.target.value as Enums<'assignment_type'>)}
        >
          <option value="guide">Guide</option>
          <option value="co_reviewer">Co-reviewer</option>
        </SelectField>
        <SelectField
          label="Faculty member"
          value={facultyId}
          onChange={(e) => setFacultyId(e.target.value)}
        >
          <option value="">Choose a faculty member</option>
          {faculty.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="At least 5 characters"
        />
        <div className="sm:col-span-2">
          <Button
            type="submit"
            busy={busy}
            disabled={!projectId || !facultyId || reason.trim().length < 5}
          >
            Send proposal
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AuthorizationsCard({
  projects,
  faculty,
  authorizations,
  nameOf,
  projectLabel,
  closed,
  busy,
  onGrant,
  onRevoke,
}: {
  projects: ProjectRow[];
  faculty: { id: string; name: string }[];
  authorizations: {
    id: string;
    project_id: string;
    faculty_id: string;
    granted_by: string;
    valid_until: string | null;
    revoked_at: string | null;
    note: string | null;
    created_at: string;
  }[];
  nameOf: (id: string | null | undefined) => string;
  projectLabel: (id: string) => string;
  closed: boolean;
  busy: boolean;
  onGrant: (projectId: string, facultyId: string, until: string, note: string) => void;
  onRevoke: (id: string) => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  // Time of first render; authorizations expiring while the page is open update on the next load.
  const [now] = useState(() => Date.now());
  const status = (a: (typeof authorizations)[number]) =>
    a.revoked_at
      ? '○ Revoked'
      : a.valid_until && new Date(a.valid_until).getTime() <= now
        ? '○ Expired'
        : `✓ Active${a.valid_until ? ` until ${new Date(a.valid_until).toLocaleDateString()}` : ''}`;

  return (
    <Card title="Review authorizations">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Let a faculty member review one project they are not assigned to (for example to cover for
        the guide).
      </p>
      {!closed && (
        <form
          className="mb-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onGrant(projectId, facultyId, until, note.trim());
            setNote('');
            setUntil('');
          }}
        >
          <SelectField
            label="Project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Choose a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id ?? ''}>
                Slot {p.slot_no} · {p.student_name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Faculty member"
            value={facultyId}
            onChange={(e) => setFacultyId(e.target.value)}
          >
            <option value="">Choose a faculty member</option>
            {faculty.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Valid until (optional)"
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="sm:col-span-2">
            <Button type="submit" busy={busy} disabled={!projectId || !facultyId}>
              Grant authorization
            </Button>
          </div>
        </form>
      )}
      {authorizations.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">No authorizations yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {authorizations.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">
                  {nameOf(a.faculty_id)} → {projectLabel(a.project_id)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {status(a)} · granted by {nameOf(a.granted_by)}
                  {a.note && ` · ${a.note}`}
                </div>
              </div>
              {!closed &&
                !a.revoked_at &&
                (!a.valid_until || new Date(a.valid_until).getTime() > now) && (
                  <Button variant="secondary" disabled={busy} onClick={() => onRevoke(a.id)}>
                    Revoke
                  </Button>
                )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
