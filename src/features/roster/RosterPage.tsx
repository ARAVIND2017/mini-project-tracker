import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Alert, Button, Card, LoadingState, TextField } from '@/components/ui';
import { hasAdminPermission, isHod } from '@/domain/context';
import {
  addEmptySlots,
  getSemester,
  inviteStudent,
  listProjects,
  listStudents,
  updateStudent,
  withdrawStudent,
  type Student,
} from '@/lib/api';
import type { Enums } from '@/lib/database.types';
import { useActiveContext } from '../auth/authContext';
import { SemesterNav } from '../semesters/SemesterNav';
import { StaffOnly } from '../semesters/StaffOnly';
import { RosterImport } from './RosterImport';

const STATUS: Record<Enums<'roster_status'>, string> = {
  empty: '○ Empty slot',
  pending_invite: '• No account yet',
  active: '✓ Account active',
  withdrawn: '■ Withdrawn',
};

export function RosterPage() {
  return (
    <StaffOnly>
      <RosterPageContent />
    </StaffOnly>
  );
}

function RosterPageContent() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const queryClient = useQueryClient();
  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const students = useQuery({
    queryKey: ['students', semesterId],
    queryFn: () => listStudents(semesterId),
  });
  const projects = useQuery({
    queryKey: ['projects', semesterId],
    queryFn: () => listProjects(semesterId),
  });
  const closed = semester.data?.status === 'closed';
  const canEdit = hasAdminPermission(ctx, 'manage_roster') && !closed;
  const canInvite =
    (hasAdminPermission(ctx, 'manage_roster') || hasAdminPermission(ctx, 'manage_users')) &&
    !closed;
  const canWithdraw = isHod(ctx) && !closed;
  const [editing, setEditing] = useState<string | null>(null);
  const [slots, setSlots] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['students', semesterId] }),
      queryClient.invalidateQueries({ queryKey: ['projects', semesterId] }),
      queryClient.invalidateQueries({ queryKey: ['overview', semesterId] }),
    ]);
  };
  const action = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
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

  if (students.isPending || semester.isPending) {
    return (
      <>
        <SemesterNav />
        <LoadingState />
      </>
    );
  }
  if (students.error) return <Alert tone="error">{students.error.message}</Alert>;
  if (semester.error) return <Alert tone="error">{semester.error.message}</Alert>;

  const list = students.data;
  const filled = list.filter((s) => s.status !== 'empty').length;
  const domainByStudent = new Map((projects.data ?? []).map((p) => [p.student_id, p.domain_name]));

  return (
    <div>
      <SemesterNav />
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <span>
          <strong>{filled}</strong> of <strong>{semester.data.max_students}</strong> places filled
        </span>
        <span>{list.length - filled} empty slot(s)</span>
        <span>{list.filter((s) => s.status === 'pending_invite').length} without an account</span>
      </div>
      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {canEdit && (
        <div className="mb-6 space-y-4">
          <RosterImport semesterId={semesterId} onImported={refresh} />
          <Card title="Prepare empty slots">
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(slots);
                if (Number.isInteger(n) && n >= 1)
                  run(
                    () => addEmptySlots(semesterId, n),
                    `Slots 1–${n} are ready.`,
                    () => setSlots(''),
                  );
              }}
            >
              <TextField
                label="Create empty slots up to number"
                type="number"
                min={1}
                max={999}
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                hint="Existing slots are not changed."
              />
              <Button type="submit" variant="secondary" disabled={!slots || action.isPending}>
                Create slots
              </Button>
            </form>
          </Card>
        </div>
      )}

      <Card title={`Roster (${list.length} slots)`}>
        {list.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The roster is empty.
            {canEdit ? ' Import the CSV supplied by the department, or prepare empty slots.' : ''}
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Slot</th>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Student ID</th>
                  <th className="px-4 py-2 font-medium">Domain</th>
                  <th className="px-4 py-2 font-medium">Drive</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  {(canEdit || canInvite || canWithdraw) && (
                    <th className="px-4 py-2 font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {list.map((s) =>
                  editing === s.id ? (
                    <EditRow
                      key={s.id}
                      student={s}
                      busy={action.isPending}
                      onCancel={() => setEditing(null)}
                      onSave={(patch) =>
                        run(
                          () => updateStudent(s.id, patch),
                          `Slot ${s.slot_no} saved.`,
                          () => setEditing(null),
                        )
                      }
                    />
                  ) : (
                    <tr key={s.id} className={s.status === 'withdrawn' ? 'text-slate-400' : ''}>
                      <td className="px-4 py-2">{s.slot_no}</td>
                      <td className="px-4 py-2">
                        {s.full_name ?? <em className="text-slate-400">empty</em>}
                        {s.email && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {s.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2">{s.institution_id ?? '—'}</td>
                      <td className="px-4 py-2">{domainByStudent.get(s.id) ?? '—'}</td>
                      <td className="px-4 py-2">
                        {s.drive_folder_url ? (
                          <a
                            href={s.drive_folder_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 underline dark:text-blue-300"
                          >
                            Open
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{STATUS[s.status]}</td>
                      {(canEdit || canInvite || canWithdraw) && (
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            {canEdit && s.status !== 'withdrawn' && (
                              <Button variant="secondary" onClick={() => setEditing(s.id)}>
                                Edit
                              </Button>
                            )}
                            {canInvite && s.status === 'pending_invite' && s.email && (
                              <Button
                                variant="secondary"
                                disabled={action.isPending}
                                onClick={() =>
                                  run(() => inviteStudent(s.id), `Invitation sent to ${s.email}.`)
                                }
                              >
                                Invite
                              </Button>
                            )}
                            {canWithdraw &&
                              (s.status === 'pending_invite' || s.status === 'active') && (
                                <Button
                                  variant="secondary"
                                  disabled={action.isPending}
                                  onClick={() => {
                                    const reason = window.prompt(
                                      `Why is ${s.full_name} being withdrawn?`,
                                    );
                                    if (reason === null) return;
                                    if (reason.trim().length < 5) {
                                      setMessage({
                                        tone: 'error',
                                        text: 'Please give a reason of at least 5 characters.',
                                      });
                                      return;
                                    }
                                    run(
                                      () => withdrawStudent(s.id, reason.trim()),
                                      `${s.full_name} has been withdrawn.`,
                                    );
                                  }}
                                >
                                  Withdraw
                                </Button>
                              )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function EditRow({
  student: s,
  busy,
  onCancel,
  onSave,
}: {
  student: Student;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: {
    full_name: string;
    institution_id: string;
    email: string;
    drive_folder_url: string;
  }) => void;
}) {
  const [values, setValues] = useState({
    full_name: s.full_name ?? '',
    institution_id: s.institution_id ?? '',
    email: s.email ?? '',
    drive_folder_url: s.drive_folder_url ?? '',
  });
  return (
    <tr className="bg-blue-50/40 dark:bg-blue-950/30">
      <td className="px-4 py-2 align-top">{s.slot_no}</td>
      <td colSpan={6} className="px-4 py-2">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(values);
          }}
        >
          <TextField
            label="Full name"
            value={values.full_name}
            onChange={(e) => setValues({ ...values, full_name: e.target.value })}
          />
          <TextField
            label="Student ID"
            value={values.institution_id}
            onChange={(e) => setValues({ ...values, institution_id: e.target.value })}
          />
          <TextField
            label="Email"
            type="email"
            value={values.email}
            disabled={Boolean(s.user_id)}
            hint={s.user_id ? 'Fixed once the student has an account' : undefined}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
          />
          <TextField
            label="Drive folder link"
            placeholder="https://drive.google.com/…"
            value={values.drive_folder_url}
            onChange={(e) => setValues({ ...values, drive_folder_url: e.target.value })}
          />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" busy={busy}>
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </td>
    </tr>
  );
}
