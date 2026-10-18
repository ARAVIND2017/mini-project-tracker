import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, Button, Card, LoadingState, PageHeader } from '@/components/ui';
import { hasAdminPermission } from '@/domain/context';
import { formFromSemester, settingsPayload, weekStartDate } from '@/domain/semester';
import {
  activateSemester,
  closeSemester,
  getSemester,
  listMembers,
  updateSemester,
} from '@/lib/api';
import { useActiveContext, useAuth } from '../auth/authContext';
import { SemesterForm } from './SemesterForm';
import { SemesterStatusBadge } from './SemesterStatusBadge';

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

  return (
    <div>
      <PageHeader
        title={s.name}
        description={
          <span className="inline-flex items-center gap-2">
            <SemesterStatusBadge status={s.status} /> {s.academic_year ?? ''}
          </span>
        }
        actions={
          <Link
            to={`/semesters/${s.id}/people`}
            className="text-sm font-medium text-blue-700 underline dark:text-blue-300"
          >
            People & roles →
          </Link>
        }
      />

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
          </ul>
          {activate.error && (
            <div className="mt-3">
              <Alert tone="error">{activate.error.message}</Alert>
            </div>
          )}
          <Button
            className="mt-3"
            busy={activate.isPending}
            disabled={!s.start_date || !lead}
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
