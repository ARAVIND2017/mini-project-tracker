import { useQuery } from '@tanstack/react-query';
import { NavLink, useParams } from 'react-router';
import { getSemester } from '@/lib/api';
import { useActiveContext } from '../auth/authContext';
import { semesterSections } from './semesterSections';
import { SemesterStatusBadge } from './SemesterStatusBadge';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
    isActive
      ? 'bg-blue-700 font-medium text-white dark:bg-blue-600'
      : 'text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-white dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
  }`;

/**
 * Header shared by every semester screen: the semester's name and status. On large
 * screens the sections are in the sidebar; on small screens they are a row of tabs here.
 */
export function SemesterNav() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const sections = semesterSections(ctx, semesterId);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {semester.data?.name ?? 'Semester'}
        </h1>
        {semester.data && <SemesterStatusBadge status={semester.data.status} />}
        {semester.data?.academic_year && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {semester.data.academic_year}
          </span>
        )}
      </div>
      {/* Small screens only (the sidebar is hidden there); scrolls sideways if needed. */}
      <nav aria-label="Semester sections" className="-mx-4 mt-3 lg:hidden" data-scroll-x>
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1">
          {sections.map((s) => (
            <li key={s.to}>
              <NavLink to={s.to} end={s.end} className={tabClass}>
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
