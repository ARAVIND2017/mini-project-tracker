import { NavLink, Outlet } from 'react-router';
import { primaryRoleLabel } from '@/domain/context';
import { useActiveContext, useAuth } from '@/features/auth/authContext';
import { NotificationBell } from '@/features/notifications/NotificationBell';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? 'font-medium text-blue-700 underline underline-offset-4 dark:text-blue-300'
    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white';

export function AppShell() {
  const ctx = useActiveContext();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-6">
            <span className="font-semibold">Mini-Project Tracker</span>
            <nav aria-label="Main" className="flex gap-4 text-sm">
              <NavLink to="/" end className={linkClass}>
                Home
              </NavLink>
              <NavLink to="/semesters" className={linkClass}>
                Semesters
              </NavLink>
              <NavLink to="/status" className={linkClass}>
                System status
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <NotificationBell />
            <span className="text-right leading-tight">
              <span className="block font-medium">{ctx.profile.full_name}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {primaryRoleLabel(ctx)}
              </span>
            </span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-md px-2 py-1 text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
