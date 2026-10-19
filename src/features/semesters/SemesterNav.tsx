import { useQuery } from '@tanstack/react-query';
import { NavLink, useParams } from 'react-router';
import { hasAdminPermission, isFacultyLevel } from '@/domain/context';
import { getSemester } from '@/lib/api';
import { useActiveContext } from '../auth/authContext';
import { SemesterStatusBadge } from './SemesterStatusBadge';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
    isActive
      ? 'border-blue-700 font-medium text-blue-800 dark:border-blue-300 dark:text-blue-200'
      : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
  }`;

/** Header and tabs shared by every semester screen. */
export function SemesterNav() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const staff = isFacultyLevel(ctx, semesterId) || ctx.system_roles.some((r) => r.role === 'admin');

  const tabs = [
    { to: `/semesters/${semesterId}`, label: 'Overview', end: true, show: true },
    { to: `/semesters/${semesterId}/projects`, label: 'Projects', end: false, show: staff },
    {
      to: `/semesters/${semesterId}/review-queue`,
      label: 'Review queue',
      end: false,
      show: isFacultyLevel(ctx, semesterId),
    },
    {
      to: `/semesters/${semesterId}/assignments`,
      label: 'Assignments',
      end: false,
      show: isFacultyLevel(ctx, semesterId),
    },
    { to: `/semesters/${semesterId}/roster`, label: 'Roster', end: false, show: staff },
    { to: `/semesters/${semesterId}/plan`, label: 'Plan', end: false, show: staff },
    { to: `/semesters/${semesterId}/domains`, label: 'Domains', end: false, show: true },
    {
      to: `/semesters/${semesterId}/people`,
      label: 'People & roles',
      end: false,
      show: staff || hasAdminPermission(ctx, 'manage_users'),
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{semester.data?.name ?? 'Semester'}</h1>
        {semester.data && <SemesterStatusBadge status={semester.data.status} />}
      </div>
      <nav
        aria-label="Semester"
        className="-mx-4 mt-3 flex overflow-x-auto border-b border-slate-200 px-4 dark:border-slate-800"
      >
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
              {t.label}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
