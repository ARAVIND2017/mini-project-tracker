import { Link } from 'react-router';
import { Alert, Card, PageHeader } from '@/components/ui';
import { STAGES } from '@/domain/constants';
import { hasAdminPermission, isHod, ROLE_LABELS } from '@/domain/context';
import { useActiveContext } from '@/features/auth/authContext';
import { MyProjectCard } from '@/features/projects/MyProjectCard';
import { SemesterStatusBadge } from '@/features/semesters/SemesterStatusBadge';

export function HomePage() {
  const ctx = useActiveContext();
  const hod = isHod(ctx);
  const noRole = !hod && ctx.system_roles.length === 0 && ctx.memberships.length === 0;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${ctx.profile.full_name}`}
        description={ctx.profile.designation ?? undefined}
      />

      {noRole && (
        <div className="mb-6">
          <Alert>
            Your account is ready, but you have not been added to a semester yet. The HOD will add
            you.
          </Alert>
        </div>
      )}

      {ctx.memberships.some((m) => m.role === 'student') && (
        <div className="mb-6">
          <MyProjectCard userId={ctx.user_id} />
        </div>
      )}

      {hasAdminPermission(ctx, 'manage_config') && (
        <Card title="Department setup">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Create a semester, add domains, invite the lead and faculty, import the student roster,
            then activate it.
          </p>
          <Link
            to="/semesters"
            className="mt-3 inline-block text-sm font-medium text-blue-700 underline dark:text-blue-300"
          >
            Manage semesters →
          </Link>
        </Card>
      )}

      {ctx.memberships.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Your semesters</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ctx.memberships.map((m) => (
              <li key={m.membership_id}>
                <Link
                  to={`/semesters/${m.semester_id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{m.semester_name}</span>
                    <SemesterStatusBadge status={m.semester_status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {ROLE_LABELS[m.role]}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Project lifecycle</h2>
      <ol className="grid gap-2 sm:grid-cols-3">
        {STAGES.map((stage) => (
          <li
            key={stage.key}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="text-slate-500 dark:text-slate-400">Stage {stage.no}</span>
            <div className="font-medium">{stage.name}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
