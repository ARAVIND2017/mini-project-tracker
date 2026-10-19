import { itemLink, waitedFor } from './queue';

describe('review queue helpers', () => {
  const now = Date.parse('2027-01-20T12:00:00Z');

  it('shows hours under a day and days after', () => {
    expect(waitedFor('2027-01-20T07:00:00Z', now)).toBe('5 h');
    expect(waitedFor('2027-01-17T11:00:00Z', now)).toBe('3 d');
    expect(waitedFor(null, now)).toBe('—');
  });

  it('links task submissions to the weekly tasks and records to their stage', () => {
    expect(
      itemLink({
        project_id: 'p1',
        target_type: 'task_submission',
        target_id: 's1',
        stage_key: 'exploration',
      }),
    ).toBe('/projects/p1?view=tasks&submission=s1');
    expect(
      itemLink({
        project_id: 'p1',
        target_type: 'paper',
        target_id: 'x',
        stage_key: 'paper_selection',
      }),
    ).toBe('/projects/p1?stage=paper_selection');
  });
});
