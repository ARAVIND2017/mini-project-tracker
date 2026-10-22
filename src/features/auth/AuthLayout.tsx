import type { ReactNode } from 'react';
import { LogoMark } from '@/components/icons';
import { STAGES } from '@/domain/constants';

/** Sign-in, password reset and set-password pages: brand panel + form. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-950">
      <aside className="relative hidden w-[42%] max-w-xl flex-col justify-between overflow-hidden bg-brand-900 p-10 text-white lg:flex dark:bg-brand-950">
        <div className="flex items-center gap-3">
          <LogoMark className="h-9 w-9" />
          <span className="leading-tight">
            <span className="block text-lg font-semibold tracking-tight">MiniTrack</span>
            <span className="block text-sm text-brand-200">Research mini-project tracker</span>
          </span>
        </div>
        <div>
          <p className="text-2xl font-semibold leading-snug tracking-tight">
            From research paper to final sign-off, one evidence-based record.
          </p>
          <p className="mt-3 text-sm text-brand-200">
            Every stage is approved by faculty. Progress comes from approvals and verified work,
            never from a number typed in.
          </p>
          <ol className="mt-8 space-y-2.5" aria-label="The nine research stages">
            {STAGES.map((s) => (
              <li key={s.key} className="flex items-center gap-3 text-sm text-brand-100">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold"
                >
                  {s.no}
                </span>
                {s.name}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-brand-300">
          Department research mini-projects · role-based access
        </p>
      </aside>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="h-9 w-9" />
            <span className="leading-tight">
              <span className="block text-lg font-semibold tracking-tight">MiniTrack</span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">
                Research mini-project tracker
              </span>
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
