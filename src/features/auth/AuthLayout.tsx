import type { ReactNode } from 'react';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">
          Mini-Project Tracker
        </p>
        <h1 className="mt-1 text-center text-2xl font-semibold">{title}</h1>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {children}
        </div>
      </div>
    </div>
  );
}
