import { z } from '@/lib/z';
import { DEFAULT_STAGE_WEIGHTS, ENUMS, SEMESTER_DEFAULTS, type StageKey } from './constants';

export const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
] as const;

export function weekdayLabel(value: number): string {
  return WEEKDAYS.find((d) => d.value === value)?.label ?? `Day ${value}`;
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');
const weekday = z.coerce.number().int().min(1).max(7);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((v) => {
    // Date.parse rolls 2027-02-30 over to March, so require an exact round trip.
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Not a real date');

const stageWeightsSchema = z
  .object(
    Object.fromEntries(
      ENUMS.stage_key.map((k) => [k, z.coerce.number().int().min(0).max(100)]),
    ) as Record<StageKey, z.ZodCoercedNumber<unknown>>,
  )
  .refine((w) => Object.values(w).reduce((a, b) => a + Number(b), 0) === 100, {
    message: 'Stage weights must total 100',
  });

/** Client-side mirror of the database rules (app.apply_semester_settings / validate_semester). */
export const semesterSettingsSchema = z
  .object({
    name: z.string().trim().min(1, 'Required').max(120),
    academic_year: z.string().trim().max(20),
    start_date: z.union([z.literal(''), isoDate]),
    week_count: z.coerce.number().int().min(1).max(30),
    timezone: z.string().trim().min(1, 'Required'),
    lab_weekday: weekday,
    lab_start: time,
    lab_end: time,
    submission_weekday: weekday,
    submission_time: time,
    review_weekday: weekday,
    review_time: time,
    target_paper_year: z.coerce.number().int().min(2000).max(2100),
    max_students: z.coerce.number().int().min(1).max(500),
    paper_change_cutoff_week: z.coerce.number().int().min(1),
    require_source_zip: z.boolean(),
    stage_weights: stageWeightsSchema,
  })
  .refine((s) => s.lab_end > s.lab_start, {
    path: ['lab_end'],
    message: 'Lab must end after it starts',
  })
  .refine((s) => s.paper_change_cutoff_week <= s.week_count, {
    path: ['paper_change_cutoff_week'],
    message: 'Must be within the semester weeks',
  });

export type SemesterSettingsInput = z.input<typeof semesterSettingsSchema>;
export type SemesterSettings = z.output<typeof semesterSettingsSchema>;

export const DEFAULT_SEMESTER_FORM: SemesterSettingsInput = {
  name: '',
  academic_year: '',
  start_date: '',
  week_count: SEMESTER_DEFAULTS.weekCount,
  timezone: SEMESTER_DEFAULTS.timezone,
  lab_weekday: SEMESTER_DEFAULTS.labWeekday,
  lab_start: SEMESTER_DEFAULTS.labStart,
  lab_end: SEMESTER_DEFAULTS.labEnd,
  submission_weekday: SEMESTER_DEFAULTS.submissionWeekday,
  submission_time: SEMESTER_DEFAULTS.submissionTime,
  review_weekday: SEMESTER_DEFAULTS.reviewWeekday,
  review_time: SEMESTER_DEFAULTS.reviewTime,
  target_paper_year: SEMESTER_DEFAULTS.targetPaperYear,
  max_students: SEMESTER_DEFAULTS.maxStudents,
  paper_change_cutoff_week: SEMESTER_DEFAULTS.paperChangeCutoffWeek,
  require_source_zip: true,
  stage_weights: { ...DEFAULT_STAGE_WEIGHTS },
};

/** Postgres returns times as HH:MM:SS; the form uses HH:MM. */
export function toHHMM(value: string): string {
  return value.slice(0, 5);
}

interface SemesterRowLike {
  name: string;
  academic_year: string | null;
  start_date: string | null;
  week_count: number;
  timezone: string;
  lab_weekday: number;
  lab_start: string;
  lab_end: string;
  submission_weekday: number;
  submission_time: string;
  review_weekday: number;
  review_time: string;
  target_paper_year: number;
  max_students: number;
  paper_change_cutoff_week: number;
  require_source_zip: boolean;
  stage_weights: unknown;
}

export function formFromSemester(row: SemesterRowLike): SemesterSettingsInput {
  const weights = { ...DEFAULT_STAGE_WEIGHTS } as Record<StageKey, number>;
  if (row.stage_weights && typeof row.stage_weights === 'object') {
    for (const key of ENUMS.stage_key) {
      const value = (row.stage_weights as Record<string, unknown>)[key];
      if (typeof value === 'number') weights[key] = value;
    }
  }
  return {
    name: row.name,
    academic_year: row.academic_year ?? '',
    start_date: row.start_date ?? '',
    week_count: row.week_count,
    timezone: row.timezone,
    lab_weekday: row.lab_weekday,
    lab_start: toHHMM(row.lab_start),
    lab_end: toHHMM(row.lab_end),
    submission_weekday: row.submission_weekday,
    submission_time: toHHMM(row.submission_time),
    review_weekday: row.review_weekday,
    review_time: toHHMM(row.review_time),
    target_paper_year: row.target_paper_year,
    max_students: row.max_students,
    paper_change_cutoff_week: row.paper_change_cutoff_week,
    require_source_zip: row.require_source_zip,
    stage_weights: weights,
  };
}

/** Payload for app_create_semester / app_update_semester (empty start date → null). */
export function settingsPayload(s: SemesterSettings): Record<string, unknown> {
  return { ...s, academic_year: s.academic_year || null, start_date: s.start_date || null };
}

/** Week N starts on start_date + 7·(N−1) days (TRD §6). Dates are calendar dates (YYYY-MM-DD). */
export function weekStartDate(startDate: string, weekNo: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * (weekNo - 1));
  return d.toISOString().slice(0, 10);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a calendar date. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Calendar date on which week N's work is due: the submission weekday before the next
 * lab (week start + 7 days). Mirrors app.week_due_at in the database; the time of day
 * is the semester's submission time, in the semester's time zone.
 */
export function weekDueDate(
  startDate: string,
  weekNo: number,
  submissionWeekday: number,
  weekStartOverride?: string | null,
): string {
  const nextLab = new Date(`${weekStartOverride || weekStartDate(startDate, weekNo)}T00:00:00Z`);
  nextLab.setUTCDate(nextLab.getUTCDate() + 7);
  const labDay = isoWeekday(nextLab.toISOString().slice(0, 10));
  nextLab.setUTCDate(nextLab.getUTCDate() - ((((labDay - submissionWeekday + 6) % 7) + 7) % 7) - 1);
  return nextLab.toISOString().slice(0, 10);
}

/** The current teaching week (1-based) for a date, or 0 before the start. */
export function teachingWeek(startDate: string | null, today: string): number {
  if (!startDate) return 0;
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
  );
  return days < 0 ? 0 : Math.floor(days / 7) + 1;
}

/** A date-time shown in the semester's time zone, e.g. "Mon, 11 Jan, 23:59". */
export function formatInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Today's calendar date in a time zone (YYYY-MM-DD). */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}
