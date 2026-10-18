import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, Button, Card, LoadingState, PageHeader } from '@/components/ui';
import { hasAdminPermission, isHod, ROLE_LABELS } from '@/domain/context';
import {
  getSemester,
  listMembers,
  resendInvite,
  setLead,
  setMembership,
  setUserActive,
  type Member,
} from '@/lib/api';
import { useActiveContext, useAuth } from '../auth/authContext';
import { InviteFacultyForm } from './InviteFacultyForm';

const ROLE_ORDER = { lead_faculty: 0, faculty: 1, student: 2 } as const;

export function PeoplePage() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const { refreshContext } = useAuth();
  const hod = isHod(ctx);
  const canManageUsers = hasAdminPermission(ctx, 'manage_users');
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const members = useQuery({
    queryKey: ['members', semesterId],
    queryFn: () => listMembers(semesterId),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['members', semesterId] });
    await refreshContext();
  };

  const action = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => refresh(),
    onError: (err) => setMessage({ tone: 'error', text: err.message }),
  });

  function run(fn: () => Promise<unknown>, success: string) {
    setMessage(null);
    action.mutate(fn, { onSuccess: () => setMessage({ tone: 'success', text: success }) });
  }

  function askReason(prompt: string): string | null {
    const reason = window.prompt(prompt);
    if (reason === null) return null;
    if (reason.trim().length < 5) {
      setMessage({ tone: 'error', text: 'Please give a reason of at least 5 characters.' });
      return null;
    }
    return reason.trim();
  }

  if (semester.isPending || members.isPending) return <LoadingState />;
  if (semester.error) return <Alert tone="error">{semester.error.message}</Alert>;
  if (members.error) return <Alert tone="error">{members.error.message}</Alert>;

  const closed = semester.data.status === 'closed';
  const sorted = [...members.data].sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? ''),
  );
  const lead = sorted.find((m) => m.role === 'lead_faculty' && m.is_active);
  const staff = sorted.filter((m) => m.role !== 'student');

  return (
    <div>
      <PageHeader
        title="People & roles"
        description={
          <>
            <Link to={`/semesters/${semesterId}`} className="underline">
              {semester.data.name}
            </Link>{' '}
            · Lead faculty: {lead?.profile?.full_name ?? 'not appointed yet'}
          </>
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      {closed && (
        <div className="mb-4">
          <Alert>This semester is closed. Memberships can no longer be changed.</Alert>
        </div>
      )}

      {canManageUsers && !closed && (
        <div className="mb-6">
          <InviteFacultyForm semesterId={semesterId} canAppointLead={hod} onInvited={refresh} />
        </div>
      )}

      <Card title={`Faculty (${staff.length})`}>
        {staff.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No faculty in this semester yet.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Reports to</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  {(hod || canManageUsers) && <th className="px-4 py-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {staff.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    reportsTo={
                      m.reports_to
                        ? sorted.find((x) => x.id === m.reports_to)?.profile?.full_name
                        : undefined
                    }
                    showActions={hod || canManageUsers}
                    hod={hod}
                    canManageUsers={canManageUsers}
                    closed={closed}
                    busy={action.isPending}
                    onMakeLead={() =>
                      window.confirm(
                        `Appoint ${m.profile?.full_name} as lead faculty? The current lead becomes a faculty member.`,
                      ) &&
                      run(
                        () => setLead(semesterId, m.user_id),
                        `${m.profile?.full_name} is now the lead faculty.`,
                      )
                    }
                    onRemove={() =>
                      window.confirm(
                        `Remove ${m.profile?.full_name} from this semester? Their history is kept.`,
                      ) &&
                      run(
                        () => setMembership(semesterId, m.user_id, m.role, false),
                        'Removed from the semester.',
                      )
                    }
                    onRestore={() =>
                      run(
                        () => setMembership(semesterId, m.user_id, 'faculty', true),
                        'Restored to the semester as faculty.',
                      )
                    }
                    onResend={() => run(() => resendInvite(m.user_id), 'Invitation sent again.')}
                    onDeactivate={() => {
                      const reason = askReason(
                        `Why are you deactivating ${m.profile?.full_name}'s account?`,
                      );
                      if (reason)
                        run(
                          () => setUserActive(m.user_id, false, reason),
                          'Account deactivated. They can no longer sign in.',
                        );
                    }}
                    onReactivate={() => {
                      const reason = askReason(
                        `Why are you reactivating ${m.profile?.full_name}'s account?`,
                      );
                      if (reason)
                        run(() => setUserActive(m.user_id, true, reason), 'Account reactivated.');
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        Students are added from the roster in the next phase. Every change here is recorded in the
        audit log.
      </p>
    </div>
  );
}

interface RowProps {
  member: Member;
  reportsTo?: string;
  showActions: boolean;
  hod: boolean;
  canManageUsers: boolean;
  closed: boolean;
  busy: boolean;
  onMakeLead: () => void;
  onRemove: () => void;
  onRestore: () => void;
  onResend: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}

function MemberRow({
  member: m,
  reportsTo,
  showActions,
  hod,
  canManageUsers,
  closed,
  busy,
  ...on
}: RowProps) {
  const accountActive = m.profile?.is_active ?? true;
  return (
    <tr className={m.is_active ? '' : 'text-slate-400 dark:text-slate-500'}>
      <td className="px-4 py-2">
        <div className="font-medium">{m.profile?.full_name ?? 'Unknown'}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {m.profile?.email}
          {m.profile?.designation && ` · ${m.profile.designation}`}
        </div>
      </td>
      <td className="px-4 py-2">{ROLE_LABELS[m.role]}</td>
      <td className="px-4 py-2">{reportsTo ?? '—'}</td>
      <td className="px-4 py-2">
        {!accountActive
          ? '✕ Account deactivated'
          : m.is_active
            ? '✓ Active'
            : '○ Removed from semester'}
      </td>
      {showActions && (
        <td className="px-4 py-2">
          <div className="flex flex-wrap gap-2">
            {hod && !closed && m.is_active && m.role === 'faculty' && accountActive && (
              <Button variant="secondary" disabled={busy} onClick={on.onMakeLead}>
                Make lead
              </Button>
            )}
            {hod && !closed && m.is_active && (
              <Button variant="secondary" disabled={busy} onClick={on.onRemove}>
                Remove
              </Button>
            )}
            {hod && !closed && !m.is_active && (
              <Button variant="secondary" disabled={busy} onClick={on.onRestore}>
                Restore
              </Button>
            )}
            {canManageUsers && accountActive && (
              <Button variant="secondary" disabled={busy} onClick={on.onResend}>
                Resend invite
              </Button>
            )}
            {canManageUsers && accountActive && (
              <Button variant="danger" disabled={busy} onClick={on.onDeactivate}>
                Deactivate
              </Button>
            )}
            {canManageUsers && !accountActive && (
              <Button variant="secondary" disabled={busy} onClick={on.onReactivate}>
                Reactivate
              </Button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
