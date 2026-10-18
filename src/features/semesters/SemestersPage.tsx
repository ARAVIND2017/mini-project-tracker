import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert, Button, Card, LoadingState, PageHeader } from '@/components/ui';
import { hasAdminPermission } from '@/domain/context';
import { DEFAULT_SEMESTER_FORM, settingsPayload } from '@/domain/semester';
import { createSemester, listSemesters } from '@/lib/api';
import { useActiveContext, useAuth } from '../auth/authContext';
import { SemesterForm } from './SemesterForm';
import { SemesterStatusBadge } from './SemesterStatusBadge';

export function SemestersPage() {
  const ctx = useActiveContext();
  const { refreshContext } = useAuth();
  const canCreate = hasAdminPermission(ctx, 'manage_config');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const semesters = useQuery({ queryKey: ['semesters'], queryFn: listSemesters });

  return (
    <div>
      <PageHeader
        title="Semesters"
        description="Each semester is a separate workspace with its own faculty, students and schedule."
        actions={
          canCreate && !creating && <Button onClick={() => setCreating(true)}>New semester</Button>
        }
      />

      {creating && (
        <div className="mb-8">
          <SemesterForm
            initial={DEFAULT_SEMESTER_FORM}
            submitLabel="Create semester"
            onSubmit={async (values) => {
              const { name, academic_year, ...rest } = settingsPayload(values) as typeof values &
                Record<string, unknown>;
              const id = await createSemester(name, (academic_year as string | null) ?? null, rest);
              await queryClient.invalidateQueries({ queryKey: ['semesters'] });
              await refreshContext();
              navigate(`/semesters/${id}`);
            }}
          />
          <Button variant="secondary" className="mt-3" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      )}

      {semesters.isPending && <LoadingState />}
      {semesters.error && <Alert tone="error">{semesters.error.message}</Alert>}
      {semesters.data && semesters.data.length === 0 && (
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {canCreate
              ? 'No semesters yet. Create the first one to start setting up faculty and students.'
              : 'You are not part of any semester yet. The HOD will add you.'}
          </p>
        </Card>
      )}
      {semesters.data && semesters.data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {semesters.data.map((s) => (
            <li key={s.id}>
              <Link
                to={`/semesters/${s.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{s.name}</span>
                  <SemesterStatusBadge status={s.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {s.academic_year ?? 'No academic year'} · {s.week_count} weeks ·{' '}
                  {s.start_date ? `starts ${s.start_date}` : 'start date not set'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
