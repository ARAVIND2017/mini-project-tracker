import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { STAGES, type StageKey } from '@/domain/constants';
import { STATUS_LABELS } from '@/domain/labels';
import { CheckIcon } from './icons';

type StageStatus = keyof (typeof STATUS_LABELS)['stage_status'];

// Marker per status: shape and symbol differ, not only colour (WCAG 1.4.1).
const marker: Record<StageStatus, { ring: string; symbol: ReactNode | null }> = {
  approved: {
    ring: 'bg-green-600 text-white ring-green-600',
    symbol: <CheckIcon className="h-4 w-4" />,
  },
  exception_approved: {
    ring: 'bg-green-600 text-white ring-green-600',
    symbol: <CheckIcon className="h-4 w-4" />,
  },
  awaiting_approval: {
    ring: 'bg-amber-50 text-amber-800 ring-amber-500 dark:bg-amber-950 dark:text-amber-200',
    symbol: '!',
  },
  changes_requested: { ring: 'bg-amber-500 text-white ring-amber-500', symbol: '!' },
  in_progress: {
    ring: 'bg-blue-50 text-blue-800 ring-blue-600 dark:bg-blue-950 dark:text-blue-200',
    symbol: null,
  },
  not_started: {
    ring: 'bg-white text-slate-500 ring-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-600',
    symbol: null,
  },
};

export interface JourneyStage {
  key: StageKey;
  status: StageStatus;
}

/**
 * The nine-stage research journey: a vertical list on small screens and a connected
 * horizontal timeline on large ones. Each step shows its number, name and status in
 * words. Steps are buttons (onSelect) or links (linkTo), or plain items.
 */
export function JourneyTimeline({
  stages,
  current,
  onSelect,
  linkTo,
  label = 'Research stages',
  isOpen = () => true,
}: {
  stages: JourneyStage[];
  current?: StageKey | null;
  onSelect?: (key: StageKey) => void;
  linkTo?: (key: StageKey) => string;
  label?: string;
  isOpen?: (key: StageKey) => boolean;
}) {
  const statusOf = (key: StageKey): StageStatus =>
    stages.find((s) => s.key === key)?.status ?? 'not_started';

  return (
    <nav aria-label={label}>
      <ol className="relative grid gap-1.5 lg:grid-cols-9 lg:gap-0">
        {STAGES.map((s, i) => {
          const status = statusOf(s.key);
          const m = marker[status];
          const isCurrent = s.key === current;
          const done = status === 'approved' || status === 'exception_approved';
          const content = (
            <>
              <span
                aria-hidden="true"
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-inset ${m.ring} ${isCurrent ? 'outline outline-2 outline-offset-2 outline-blue-600' : ''}`}
              >
                {m.symbol ?? s.no}
              </span>
              <span className="min-w-0 lg:mt-2 lg:px-1">
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  S{s.no}
                </span>
                <span
                  className={`block text-sm leading-snug lg:text-xs ${isCurrent ? 'font-semibold' : 'font-medium'}`}
                >
                  {s.name}
                </span>
                <span
                  className={`mt-0.5 block text-xs ${
                    done
                      ? 'text-green-800 dark:text-green-300'
                      : status === 'not_started'
                        ? 'text-slate-600 dark:text-slate-400'
                        : status === 'in_progress'
                          ? 'text-blue-800 dark:text-blue-300'
                          : 'text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {STATUS_LABELS.stage_status[status].label}
                </span>
              </span>
            </>
          );
          const cls = `flex h-full w-full items-start gap-3 rounded-lg p-2 text-left transition-colors lg:flex-col lg:items-center lg:gap-0 lg:text-center ${
            isCurrent
              ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-950/50 dark:ring-blue-900'
              : ''
          }`;
          const open = isOpen(s.key);
          return (
            <li key={s.key} className="relative">
              {/* Connector to the next step (large screens). */}
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-6 hidden h-0.5 w-full lg:block ${done ? 'bg-green-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                />
              )}
              {onSelect && open ? (
                <button
                  type="button"
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => onSelect(s.key)}
                  className={`${cls} hover:bg-slate-100 dark:hover:bg-slate-800`}
                >
                  {content}
                </button>
              ) : linkTo && open ? (
                <Link
                  to={linkTo(s.key)}
                  className={`${cls} hover:bg-slate-100 dark:hover:bg-slate-800`}
                >
                  {content}
                </Link>
              ) : (
                <div className={`${cls} ${open ? '' : 'opacity-60'}`}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
