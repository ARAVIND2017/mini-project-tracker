import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Alert, Button, Card, LoadingState } from '@/components/ui';
import { hasAdminPermission, isFacultyLevel } from '@/domain/context';
import { formFromSemester, settingsPayload, weekStartDate } from '@/domain/semester';
import {
  activateSemester,
  closeSemester,
  getSemester,
  listDomains,
  listMembers,
  updateSemester,
} from '@/lib/api';
import { useActiveContext, useAuth } from '../auth/authContext';
import { SemesterDashboard } from '../dashboard/SemesterDashboard';
import { CopySetupCard } from './CopySetupCard';
import { SemesterForm } from './SemesterForm';
import { SemesterNav } from './SemesterNav';

export function SemesterDetailPage() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const { refreshContext } = useAuth();
  const canConfigure = hasAdminPermission(ctx, 'manage_config');
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const members = useQuery({
    queryKey: ['members', semesterId],
    queryFn: () => listMembers(semesterId),
  });
  const domains = useQuery({
    queryKey: ['domains', semesterId],
    queryFn: () => listDomains(semesterId),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['semester', semesterId] }),
      queryClient.invalidateQueries({ queryKey: ['semesters'] }),
    ]);
    await refreshContext();
  };
  const activate = useMutation({
    mutationFn: () => activateSemester(semesterId),
    onSuccess: invalidate,
  });
  const close = useMutation({ mutationFn: () => closeSemester(semesterId), onSuccess: invalidate });

  if (semester.isPending) return <LoadingState />;
  if (semester.error) return <Alert tone="error">{semester.error.message}</Alert>;
  const s = semester.data;
  const lead = members.data?.find((m) => m.role === 'lead_faculty' && m.is_active);
  const readOnly = !canConfigure || s.status === 'closed';
  const activeDomainCount = (domains.data ?? []).filter((d) => d.is_active).length;
  const hasDomain = activeDomainCount > 0;

  return (
    <div>
      <SemesterNav />

      {s.status !== 'draft' &&
        (isFacultyLevel(ctx, semesterId) || ctx.system_roles.some((r) => r.role === 'admin')) && (
          <div className="mb-8">
            <SemesterDashboard semesterId={semesterId} />
          </div>
        )}

      {canConfigure && s.status === 'draft' && (
        <div className="mb-6">
          <CopySetupCard semesterId={semesterId} />
        </div>
      )}

      {canConfigure && s.status === 'draft' && (
        <Card title="Activation checklist">
          <ul className="space-y-1 text-sm">
            <li>
              {s.start_date ? '✓' : '✕'} Start date set{' '}
              {s.start_date && `(week 16 starts ${weekStartDate(s.start_date, s.week_count)})`}
            </li>
            <li>
              {lead ? '✓' : '✕'} Lead faculty appointed{' '}
              {lead?.profile && `(${lead.profile.full_name})`}
            </li>
            <li>
              {hasDomain ? '✓' : '✕'} At least one project domain{' '}
              {hasDomain && `(${activeDomainCount})`}
            </li>
          </ul>
          {activate.error && (
            <div className="mt-3">
              <Alert tone="error">{activate.error.message}</Alert>
            </div>
          )}
          <Button
            className="mt-3"
            busy={activate.isPending}
            disabled={!s.start_date || !lead || !hasDomain}
            onClick={() => {
              if (
                window.confirm(
                  'Activate this semester? Faculty and students will be able to start working in it.',
                )
              )
                activate.mutate();
            }}
          >
            Activate semester
          </Button>
        </Card>
      )}
      {canConfigure && s.status === 'active' && (
        <Card title="Close semester">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Closing makes the whole semester read-only. This cannot be undone.
          </p>
          {close.error && (
            <div className="mt-3">
              <Alert tone="error">{close.error.message}</Alert>
            </div>
          )}
          <Button
            variant="danger"
            className="mt-3"
            busy={close.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Close "${s.name}"? Everything in it becomes read-only. This cannot be undone.`,
                )
              )
                close.mutate();
            }}
          >
            Close semester
          </Button>
        </Card>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Settings</h2>
      {saved && (
        <div className="mb-3">
          <Alert tone="success">Settings saved.</Alert>
        </div>
      )}
      {s.status === 'closed' && (
        <div className="mb-3">
          <Alert>This semester is closed and read-only.</Alert>
        </div>
      )}
      <SemesterForm
        key={s.updated_at}
        initial={formFromSemester(s)}
        submitLabel="Save settings"
        readOnly={readOnly}
        onSubmit={async (values) => {
          setSaved(false);
          await updateSemester(s.id, settingsPayload(values));
          await invalidate();
          setSaved(true);
        }}
      />
    </div>
  );
}
