import {
  DEFAULT_SEMESTER_FORM,
  formFromSemester,
  isoWeekday,
  semesterSettingsSchema,
  settingsPayload,
  weekStartDate,
} from './semester';

const valid = { ...DEFAULT_SEMESTER_FORM, name: 'Odd Semester 2026-27' };

describe('semester settings', () => {
  it('accepts the defaults with a name', () => {
    expect(semesterSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects weights that do not total 100', () => {
    const result = semesterSettingsSchema.safeParse({
      ...valid,
      stage_weights: { ...valid.stage_weights, final: 11 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a lab that ends before it starts', () => {
    const result = semesterSettingsSchema.safeParse({ ...valid, lab_start: '17:00' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['lab_end']);
  });

  it('rejects a paper-change cutoff beyond the last week', () => {
    expect(semesterSettingsSchema.safeParse({ ...valid, week_count: 3 }).success).toBe(false);
  });

  it('rejects impossible dates and bad times', () => {
    expect(semesterSettingsSchema.safeParse({ ...valid, start_date: '2027-02-30' }).success).toBe(
      false,
    );
    expect(semesterSettingsSchema.safeParse({ ...valid, lab_start: '2pm' }).success).toBe(false);
  });

  it('sends an empty start date as null', () => {
    const parsed = semesterSettingsSchema.parse(valid);
    expect(settingsPayload(parsed).start_date).toBeNull();
  });

  it('round-trips a database row, trimming seconds from times', () => {
    const form = formFromSemester({
      name: 'S',
      academic_year: null,
      start_date: '2027-01-05',
      week_count: 16,
      timezone: 'Asia/Kolkata',
      lab_weekday: 2,
      lab_start: '14:00:00',
      lab_end: '16:40:00',
      submission_weekday: 1,
      submission_time: '23:59:00',
      review_weekday: 4,
      review_time: '23:59:00',
      target_paper_year: 2026,
      max_students: 30,
      paper_change_cutoff_week: 4,
      require_source_zip: true,
      stage_weights: { ...DEFAULT_SEMESTER_FORM.stage_weights },
    });
    expect(form.lab_start).toBe('14:00');
    expect(semesterSettingsSchema.safeParse(form).success).toBe(true);
  });
});

describe('week dates', () => {
  it('starts week N seven days after week N−1', () => {
    expect(weekStartDate('2027-01-05', 1)).toBe('2027-01-05');
    expect(weekStartDate('2027-01-05', 2)).toBe('2027-01-12');
    expect(weekStartDate('2027-01-05', 16)).toBe('2027-04-20');
  });

  it('computes ISO weekdays', () => {
    expect(isoWeekday('2027-01-05')).toBe(2); // Tuesday
    expect(isoWeekday('2027-01-10')).toBe(7); // Sunday
  });
});
