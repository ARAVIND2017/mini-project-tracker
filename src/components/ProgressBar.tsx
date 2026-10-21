import { STAGES } from '@/domain/constants';
import type { Json } from '@/lib/database.types';

interface StagePart {
  weight: number;
  completion: number;
  points: number;
}

const partsOf = (breakdown: Json | null | undefined): Record<string, StagePart> =>
  breakdown && typeof breakdown === 'object' && !Array.isArray(breakdown)
    ? (breakdown as unknown as Record<string, StagePart>)
    : {};

/**
 * Progress from approved stages and verified tasks (DATA-09), with the per-stage
 * breakdown in a disclosure. The number comes from the database; nothing here edits it.
 */
export function ProgressBar({
  value,
  breakdown,
  compact = false,
}: {
  value: number | null | undefined;
  breakdown?: Json | null;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const parts = partsOf(breakdown);
  const bar = (
    <span className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={`block overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${compact ? 'h-1.5 w-16' : 'h-2 w-40'}`}
      >
        <span
          className="block h-full rounded-full bg-blue-700 dark:bg-blue-400"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-sm tabular-nums">{pct}%</span>
    </span>
  );
  if (compact || Object.keys(parts).length === 0) return bar;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer list-none">
        {bar}
        <span className="mt-1 block text-xs text-blue-700 underline dark:text-blue-300">
          How is this calculated?
        </span>
      </summary>
      <div className="mt-2 rounded-md border border-slate-200 p-2 dark:border-slate-800">
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">
          Each stage counts its weight in full once approved; before that, the share of its weekly
          tasks that are verified. Submitted work counts only after review.
        </p>
        <table className="w-full text-xs">
          <thead className="text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-1 text-left font-medium">Stage</th>
              <th className="py-1 text-right font-medium">Weight</th>
              <th className="py-1 text-right font-medium">Done</th>
              <th className="py-1 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map((s) => {
              const p = parts[s.key];
              return (
                <tr key={s.key}>
                  <td className="py-0.5">
                    S{s.no} {s.name}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">{p?.weight ?? 0}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {Math.round((p?.completion ?? 0) * 100)}%
                  </td>
                  <td className="py-0.5 text-right tabular-nums">{p?.points ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
