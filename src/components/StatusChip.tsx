import { STATUS_LABELS, type StatusFamily, type StatusLabel, type Tone } from '@/domain/labels';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-800 dark:text-slate-200',
  info: 'bg-blue-50 text-blue-800 ring-blue-300 dark:bg-blue-950 dark:text-blue-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-300 dark:bg-amber-950 dark:text-amber-200',
  success: 'bg-green-50 text-green-800 ring-green-300 dark:bg-green-950 dark:text-green-200',
  danger: 'bg-red-50 text-red-800 ring-red-300 dark:bg-red-950 dark:text-red-200',
};

// Status must never be conveyed by colour alone (UI_UX_SPEC §1).
const toneIcons: Record<Tone, string> = {
  neutral: '○',
  info: '◐',
  warning: '!',
  success: '✓',
  danger: '✕',
};

interface StatusChipProps<F extends StatusFamily> {
  family: F;
  value: keyof (typeof STATUS_LABELS)[F];
}

export function StatusChip<F extends StatusFamily>({ family, value }: StatusChipProps<F>) {
  const { label, tone } = STATUS_LABELS[family][value] as StatusLabel;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tone]}`}
    >
      <span aria-hidden="true">{toneIcons[tone]}</span>
      {label}
    </span>
  );
}
