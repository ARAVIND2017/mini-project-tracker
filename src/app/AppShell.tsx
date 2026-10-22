import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  HomeIcon,
  LayersIcon,
  LogoMark,
  LogoutIcon,
  MenuIcon,
  PulseIcon,
} from '@/components/icons';
import { primaryRoleLabel } from '@/domain/context';
import { useActiveContext, useAuth } from '@/features/auth/authContext';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { semesterSections } from '@/features/semesters/semesterSections';
import { getSemester } from '@/lib/api';

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-white/10 font-medium text-white'
      : 'text-brand-100 hover:bg-white/5 hover:text-white'
  }`;

/** The semester the current page belongs to (semester pages only). */
function useCurrentSemesterId(): string | null {
  const exact = useMatch('/semesters/:semesterId');
  const nested = useMatch('/semesters/:semesterId/*');
  return exact?.params.semesterId ?? nested?.params.semesterId ?? null;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const ctx = useActiveContext();
  const semesterId = useCurrentSemesterId();
  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId as string),
    enabled: !!semesterId,
  });

  return (
    <div className="flex h-full flex-col">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center gap-3 px-4 py-5"
        aria-label="MiniTrack home"
      >
        <LogoMark />
        <span className="leading-tight">
          <span className="block text-base font-semibold tracking-tight text-white">MiniTrack</span>
          <span className="block text-xs text-brand-200">Research mini-projects</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          <li>
            <NavLink to="/" end className={navItemClass} onClick={onNavigate}>
              <HomeIcon className="h-5 w-5 shrink-0 opacity-80" />
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/semesters" end className={navItemClass} onClick={onNavigate}>
              <LayersIcon className="h-5 w-5 shrink-0 opacity-80" />
              Semesters
            </NavLink>
          </li>
          <li>
            <NavLink to="/status" className={navItemClass} onClick={onNavigate}>
              <PulseIcon className="h-5 w-5 shrink-0 opacity-80" />
              System status
            </NavLink>
          </li>
        </ul>

        {semesterId && (
          <div>
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-brand-300">
              {semester.data?.name ?? 'Semester'}
            </p>
            <ul className="space-y-1">
              {semesterSections(ctx, semesterId).map((s) => (
                <li key={s.to}>
                  <NavLink to={s.to} end={s.end} className={navItemClass} onClick={onNavigate}>
                    <s.icon className="h-5 w-5 shrink-0 opacity-80" />
                    {s.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
    </div>
  );
}

/** Breadcrumb trail from the address (semester names come from the cache). */
function Breadcrumbs() {
  const { pathname } = useLocation();
  const semesterId = useCurrentSemesterId();
  const ctx = useActiveContext();
  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId as string),
    enabled: !!semesterId,
  });
  const crumbs: { label: string; to?: string }[] = [{ label: 'Home', to: '/' }];
  if (pathname.startsWith('/semesters')) {
    crumbs.push({ label: 'Semesters', to: '/semesters' });
    if (semesterId) {
      const sections = semesterSections(ctx, semesterId);
      const section = sections.find((s) => !s.end && pathname.startsWith(s.to));
      crumbs.push({
        label: semester.data?.name ?? 'Semester',
        to: section ? `/semesters/${semesterId}` : undefined,
      });
      if (section) crumbs.push({ label: section.label });
    }
  } else if (pathname.startsWith('/projects/')) {
    crumbs.push({ label: 'Project' });
  } else if (pathname === '/notifications') {
    crumbs.push({ label: 'Notifications' });
  }
  if (crumbs.length === 1) return <span className="text-sm font-medium">Home</span>;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li
              key={`${c.label}-${i}`}
              className={`min-w-0 items-center gap-1 ${last ? 'flex' : 'hidden sm:flex'}`}
            >
              {i > 0 && (
                <ChevronRightIcon className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
              )}
              {c.to && !last ? (
                <Link to={c.to} className="truncate hover:text-slate-900 dark:hover:text-white">
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className="truncate font-medium text-slate-800 dark:text-slate-100"
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

/** Account menu (disclosure pattern): name, role and sign out. */
function ProfileMenu() {
  const ctx = useActiveContext();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="profile-menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
        >
          {initials(ctx.profile.full_name)}
        </span>
        <span className="hidden text-right leading-tight sm:block">
          <span className="block max-w-48 truncate text-sm font-medium">
            {ctx.profile.full_name}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {primaryRoleLabel(ctx)}
          </span>
        </span>
        <span className="sr-only sm:hidden">Account: {ctx.profile.full_name}</span>
        <ChevronDownIcon className="h-4 w-4 text-slate-500" />
      </button>
      {open && (
        <div
          id="profile-menu"
          className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{ctx.profile.full_name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {ctx.profile.email}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {primaryRoleLabel(ctx)}
            </p>
          </div>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <LogoutIcon className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const [drawer, setDrawer] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  // Links in the drawer close it; Escape closes it; focus moves in and back out.
  useEffect(() => {
    if (!drawer) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
    };
    document.addEventListener('keydown', onKey);
    const menu = menuButton.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      menu?.focus();
    };
  }, [drawer]);

  return (
    <div className="min-h-screen lg:pl-64">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-brand-900 lg:block dark:bg-brand-950">
        <SidebarContent />
      </aside>

      {drawer && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setDrawer(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-brand-900 shadow-xl dark:bg-brand-950">
            <button
              ref={closeButton}
              type="button"
              onClick={() => setDrawer(false)}
              className="absolute right-2 top-4 rounded-lg p-2 text-brand-100 hover:bg-white/10"
            >
              <CloseIcon />
              <span className="sr-only">Close navigation</span>
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <button
            ref={menuButton}
            type="button"
            onClick={() => setDrawer(true)}
            aria-expanded={drawer}
            className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <MenuIcon />
            <span className="sr-only">Open navigation</span>
          </button>
          <Link to="/" className="lg:hidden" aria-label="MiniTrack home">
            <LogoMark className="h-7 w-7" />
          </Link>
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-1 text-sm sm:gap-2">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
