import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, SelectField, TextField } from '@/components/ui';
import { ENUMS, STAGES, type StageKey } from '@/domain/constants';
import {
  semesterSettingsSchema,
  WEEKDAYS,
  weekdayLabel,
  type SemesterSettings,
  type SemesterSettingsInput,
} from '@/domain/semester';

type Errors = Partial<Record<string, string>>;

interface Props {
  initial: SemesterSettingsInput;
  submitLabel: string;
  readOnly?: boolean;
  onSubmit: (values: SemesterSettings) => Promise<void>;
}

/** Create/edit form for semester settings. Mirrors the database rules; the database has the final say. */
export function SemesterForm({ initial, submitLabel, readOnly = false, onSubmit }: Props) {
  const [values, setValues] = useState<SemesterSettingsInput>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof SemesterSettingsInput>(key: K, value: SemesterSettingsInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }
  function setWeight(stage: StageKey, value: string) {
    setValues((v) => ({ ...v, stage_weights: { ...v.stage_weights, [stage]: value } }));
  }

  const weightTotal = ENUMS.stage_key.reduce(
    (sum, k) => sum + (Number(values.stage_weights[k]) || 0),
    0,
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = semesterSettingsSchema.safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path.join('.')] ??= issue.message;
      setErrors(next);
      setFailure('Please correct the highlighted fields.');
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'The settings could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof SemesterSettingsInput) => ({
    value: String(values[key] ?? ''),
    error: errors[key],
    disabled: readOnly,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {failure && <Alert tone="error">{failure}</Alert>}

      <Card title="Semester">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" placeholder="e.g. Odd Semester 2026-27" {...field('name')} />
          <TextField label="Academic year" placeholder="e.g. 2026-27" {...field('academic_year')} />
          <TextField
            label="Start date (first lab day)"
            type="date"
            hint="Week 1 starts on this date. Needed before activation."
            {...field('start_date')}
          />
          <TextField
            label="Number of weeks"
            type="number"
            min={1}
            max={30}
            {...field('week_count')}
          />
          <TextField label="Timezone" hint="IANA name, e.g. Asia/Kolkata" {...field('timezone')} />
          <TextField
            label="Student capacity"
            type="number"
            min={1}
            max={500}
            hint="Maximum students in the roster"
            {...field('max_students')}
          />
        </div>
      </Card>

      <Card title="Weekly schedule">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Lab day" {...field('lab_weekday')}>
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Lab starts" type="time" {...field('lab_start')} />
          <TextField label="Lab ends" type="time" {...field('lab_end')} />
          <SelectField label="Submission deadline day" {...field('submission_weekday')}>
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Submission deadline time" type="time" {...field('submission_time')} />
          <div className="hidden sm:block" />
          <SelectField label="Faculty review due day" {...field('review_weekday')}>
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Faculty review due time" type="time" {...field('review_time')} />
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Students submit by {weekdayLabel(Number(values.submission_weekday))}{' '}
          {String(values.submission_time)}; work is reviewed at the{' '}
          {weekdayLabel(Number(values.lab_weekday))} lab; faculty record outcomes by{' '}
          {weekdayLabel(Number(values.review_weekday))} {String(values.review_time)}.
        </p>
      </Card>

      <Card title="Research rules">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Target paper year"
            type="number"
            hint="Older papers need a justification"
            {...field('target_paper_year')}
          />
          <TextField
            label="Last week to change paper"
            type="number"
            min={1}
            {...field('paper_change_cutoff_week')}
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(values.require_source_zip)}
              disabled={readOnly}
              onChange={(e) => set('require_source_zip', e.target.checked)}
            />
            Require a final source-code ZIP
          </label>
        </div>
      </Card>

      <Card title="Progress weights by stage">
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Progress is calculated from approved stages and verified tasks. Weights must total 100.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {STAGES.map((stage) => (
            <TextField
              key={stage.key}
              label={`${stage.no}. ${stage.name}`}
              type="number"
              min={0}
              max={100}
              value={String(values.stage_weights[stage.key])}
              disabled={readOnly}
              onChange={(e) => setWeight(stage.key, e.target.value)}
            />
          ))}
        </div>
        <p
          className={`mt-3 text-sm font-medium ${weightTotal === 100 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}
          aria-live="polite"
        >
          {weightTotal === 100 ? '✓' : '✕'} Total: {weightTotal}
          {errors.stage_weights && ` — ${errors.stage_weights}`}
        </p>
      </Card>

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" busy={busy}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
