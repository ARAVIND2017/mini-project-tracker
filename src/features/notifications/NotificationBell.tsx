import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router';
import { countUnread, refreshMyReminders } from '@/lib/reports';

/** Header link to the inbox with the unread count. Also adds due-soon reminders (48 h). */
export function NotificationBell() {
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      // Reminders are created when the user is using the app (no scheduler needed);
      // each task is reminded only once, so calling this again is harmless.
      await refreshMyReminders().catch(() => 0);
      return countUnread();
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
  const n = unread.data ?? 0;

  return (
    <NavLink
      to="/notifications"
      aria-label={n > 0 ? `Notifications, ${n} unread` : 'Notifications'}
      className={({ isActive }) =>
        `relative inline-flex items-center gap-1 rounded-md px-2 py-1 ${isActive ? 'font-medium text-blue-700 dark:text-blue-300' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`
      }
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
        <path d="M10 2a5 5 0 0 0-5 5v2.6l-1.3 2.6A1 1 0 0 0 4.6 14h10.8a1 1 0 0 0 .9-1.8L15 9.6V7a5 5 0 0 0-5-5Zm-2 13a2 2 0 0 0 4 0H8Z" />
      </svg>
      {n > 0 && (
        <span className="min-w-5 rounded-full bg-red-700 px-1.5 text-center text-xs font-semibold leading-5 text-white">
          {n > 99 ? '99+' : n}
        </span>
      )}
    </NavLink>
  );
}
