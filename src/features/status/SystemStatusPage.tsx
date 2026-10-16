import { useQuery } from '@tanstack/react-query';
import { envResult } from '@/lib/env';
import { checkConnection } from '@/lib/supabase';

export function SystemStatusPage() {
  const connection = useQuery({ queryKey: ['connection'], queryFn: () => checkConnection() });

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold">System status</h1>
      <dl className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        <div className="p-4">
          <dt className="text-sm text-slate-500 dark:text-slate-400">Configuration</dt>
          <dd className="mt-1">
            {envResult.ok ? (
              <span>✓ Configured</span>
            ) : (
              <>
                <span>✕ Not configured</span>
                <ul className="mt-2 list-disc pl-5 text-sm text-red-700 dark:text-red-300">
                  {envResult.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Copy <code>.env.example</code> to <code>.env.local</code> and fill in the values.
                </p>
              </>
            )}
          </dd>
        </div>
        <div className="p-4">
          <dt className="text-sm text-slate-500 dark:text-slate-400">Supabase connection</dt>
          <dd className="mt-1" aria-live="polite">
            {connection.isPending && 'Checking…'}
            {connection.data?.state === 'ok' && '✓ Reachable'}
            {connection.data?.state === 'not_configured' && '— Skipped (not configured)'}
            {connection.data?.state === 'error' && `✕ ${connection.data.message}`}
          </dd>
        </div>
      </dl>
    </section>
  );
}
