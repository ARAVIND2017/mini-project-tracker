import { describe, expect, it } from 'vitest';
import {
  averageProgress,
  countable,
  domainStageMatrix,
  filtersFromParams,
  flagCounts,
  heatLevel,
  matchesFilters,
  projectsLink,
  stageFunnel,
  type OverviewLike,
} from './dashboard';

const base: OverviewLike = {
  id: 'p',
  domain_id: 'd1',
  domain_name: 'Machine Learning',
  guide_id: 'g1',
  current_stage: 'exploration',
  is_completed: false,
  blocked: false,
  roster_status: 'active',
  awaiting_review: 0,
  overdue_tasks: 0,
  blocked_tasks: 0,
  open_corrections: 0,
  addressed_corrections: 0,
  progress: 0,
  student_name: 'Student A',
  institution_id: 'ID1',
  title: null,
};
const row = (o: Partial<OverviewLike>): OverviewLike => ({ ...base, ...o });

const rows = [
  row({ id: 'a', progress: 10, overdue_tasks: 2 }),
  row({
    id: 'b',
    guide_id: null,
    current_stage: 'paper_selection',
    progress: 20,
    awaiting_review: 1,
  }),
  row({
    id: 'c',
    domain_id: null,
    domain_name: null,
    blocked_tasks: 1,
    open_corrections: 1,
    progress: 30,
  }),
  row({ id: 'd', current_stage: null, is_completed: true, progress: 100 }),
  row({ id: 'w', roster_status: 'withdrawn', overdue_tasks: 5 }),
];

describe('project filters (UI-02)', () => {
  it('reads known filters from the URL and ignores unknown values', () => {
    expect(
      filtersFromParams(new URLSearchParams('stage=objectives&flag=overdue&guide=none')),
    ).toEqual({
      stage: 'objectives',
      flag: 'overdue',
      domain: '',
      guide: 'none',
      q: '',
    });
    const odd = filtersFromParams(new URLSearchParams('stage=drop&flag=everything'));
    expect(odd.stage).toBe('');
    expect(odd.flag).toBe('');
  });

  it('builds the projects link with only the filters given', () => {
    expect(projectsLink('s1')).toBe('/semesters/s1/projects');
    expect(projectsLink('s1', { flag: 'overdue', domain: '' })).toBe(
      '/semesters/s1/projects?flag=overdue',
    );
  });

  it('each dashboard number matches the rows its link shows', () => {
    const live = countable(rows);
    const counts = flagCounts(live);
    for (const [flag, n] of Object.entries(counts)) {
      const f = filtersFromParams(new URLSearchParams(`flag=${flag}`));
      expect(live.filter((p) => matchesFilters(p, f)).length, flag).toBe(n);
    }
    expect(counts).toMatchObject({
      no_guide: 1,
      no_domain: 1,
      overdue: 1,
      blocked: 1,
      awaiting: 1,
      corrections: 1,
      completed: 1,
    });

    for (const s of stageFunnel(live)) {
      const f = filtersFromParams(new URLSearchParams(`stage=${s.key}`));
      expect(live.filter((p) => matchesFilters(p, f)).length, s.key).toBe(s.count);
    }
  });

  it('searches names, student IDs and titles', () => {
    const f = filtersFromParams(new URLSearchParams('q=id1'));
    expect(matchesFilters(base, f)).toBe(true);
    expect(matchesFilters(row({ institution_id: 'X' }), f)).toBe(false);
  });
});

describe('dashboard figures', () => {
  it('leaves withdrawn students out of the counts', () => {
    expect(countable(rows).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('counts the stage funnel, including completed projects', () => {
    const funnel = stageFunnel(countable(rows));
    expect(funnel).toHaveLength(10);
    expect(funnel.find((s) => s.key === 'exploration')?.count).toBe(2);
    expect(funnel.find((s) => s.key === 'complete')?.count).toBe(1);
    expect(funnel.reduce((a, s) => a + s.count, 0)).toBe(4);
  });

  it('builds the domain × stage table with "No domain" last', () => {
    const m = domainStageMatrix(countable(rows));
    expect(m.map((d) => d.name)).toEqual(['Machine Learning', 'No domain']);
    expect(m[0]?.total).toBe(3);
    expect(m[0]?.cells[0]).toBe(1);
    expect(m[0]?.cells[1]).toBe(1);
    expect(m[0]?.complete).toBe(1);
  });

  it('averages progress and shades the heat table', () => {
    expect(averageProgress(countable(rows))).toBe(40);
    expect(averageProgress([])).toBeNull();
    expect([0, 1, 2, 3, 4].map((n) => heatLevel(n, 4))).toEqual([0, 1, 2, 3, 4]);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(3, 0)).toBe(0);
  });
});
