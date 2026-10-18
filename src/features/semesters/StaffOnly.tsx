import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Alert } from '@/components/ui';
import { isFacultyLevel } from '@/domain/context';
import { useActiveContext } from '../auth/authContext';
import { SemesterNav } from './SemesterNav';

/**
 * UI gate for faculty screens (roster, projects, assignments). The database already
 * hides other students' data; this gives students a clear message instead of an
 * empty or partial page.
 */
export function StaffOnly({ children }: { children: ReactNode }) {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const staff = isFacultyLevel(ctx, semesterId) || ctx.system_roles.some((r) => r.role === 'admin');
  if (staff) return <>{children}</>;
  return (
    <div>
      <SemesterNav />
      <Alert>
        This page is for faculty. Your own project is on your{' '}
        <Link to="/" className="underline">
          home page
        </Link>
        .
      </Alert>
    </div>
  );
}
