import type { Enums } from '@/lib/database.types';

const styles: Record<
  Enums<'semester_status'>,
  { label: string; icon: string; className: string }
> = {
  draft: {
    label: 'Draft',
    icon: '○',
    className: 'bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-800 dark:text-slate-200',
  },
  active: {
    label: 'Active',
    icon: '✓',
    className: 'bg-green-50 text-green-800 ring-green-300 dark:bg-green-950 dark:text-green-200',
  },
  closed: {
    label: 'Closed',
    icon: '■',
    className: 'bg-slate-200 text-slate-700 ring-slate-400 dark:bg-slate-700 dark:text-slate-100',
  },
};

export function SemesterStatusBadge({ status }: { status: Enums<'semester_status'> }) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.className}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}
