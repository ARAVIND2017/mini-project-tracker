// Dashboard counts and the project-list filters they link to (UI-02: every number on a
// dashboard opens the list of projects behind it). UI only: the database is the source.
import { STAGES, type StageKey } from './constants';

export interface OverviewLike {
  id: string | null;
  domain_id: string | null;
  domain_name: string | null;
  guide_id: string | null;
  current_stage: string | null;
  is_completed: boolean | null;
  blocked: boolean | null;
  roster_status: string | null;
  awaiting_review: number | null;
  overdue_tasks: number | null;
  blocked_tasks: number | null;
  open_corrections: number | null;
  addressed_corrections: number | null;
  progress: number | null;
  student_name: string | null;
  institution_id: string | null;
  title: string | null;
}

export const FLAGS = {
  no_guide: 'Without a guide',
  no_domain: 'Without a domain',
  overdue: 'With overdue tasks',
  blocked: 'Blocked',
  awaiting: 'Waiting for review',
  corrections: 'With open corrections',
  completed: 'Completed',
} as const;
export type Flag = keyof typeof FLAGS;

export interface ProjectFilters {
  stage: StageKey | 'complete' | '';
  flag: Flag | '';
  domain: string; // a domain id, 'none' or ''
  guide: string; // a user id, 'none' or ''
  q: string;
}

const isFlag = (v: string | null): v is Flag => !!v && v in FLAGS;
const isStage = (v: string | null): v is StageKey => STAGES.some((s) => s.key === v);

/** Reads the filters from the projects-list URL (unknown values are ignored). */
export function filtersFromParams(params: URLSearchParams): ProjectFilters {
  const stage = params.get('stage');
  const flag = params.get('flag');
  return {
    stage: stage === 'complete' ? 'complete' : isStage(stage) ? stage : '',
    flag: isFlag(flag) ? flag : '',
    domain: params.get('domain') ?? '',
    guide: params.get('guide') ?? '',
    q: params.get('q') ?? '',
  };
}

/** The projects-list URL for a set of filters (empty ones are left out). */
export function projectsLink(semesterId: string, filters: Partial<ProjectFilters> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const query = params.toString();
  return `/semesters/${semesterId}/projects${query ? `?${query}` : ''}`;
}

export function hasFlag(p: OverviewLike, flag: Flag): boolean {
  switch (flag) {
    case 'no_guide':
      return !p.guide_id;
    case 'no_domain':
      return !p.domain_id;
    case 'overdue':
      return (p.overdue_tasks ?? 0) > 0;
    case 'blocked':
      return !!p.blocked || (p.blocked_tasks ?? 0) > 0;
    case 'awaiting':
      return (p.awaiting_review ?? 0) > 0;
    case 'corrections':
      return (p.open_corrections ?? 0) + (p.addressed_corrections ?? 0) > 0;
    case 'completed':
      return !!p.is_completed;
  }
}

export function matchesFilters(p: OverviewLike, f: ProjectFilters): boolean {
  const term = f.q.trim().toLowerCase();
  return (
    (!f.stage || (f.stage === 'complete' ? !p.current_stage : p.current_stage === f.stage)) &&
    (!f.flag || hasFlag(p, f.flag)) &&
    (!f.domain || (f.domain === 'none' ? !p.domain_id : p.domain_id === f.domain)) &&
    (!f.guide || (f.guide === 'none' ? !p.guide_id : p.guide_id === f.guide)) &&
    (!term ||
      [p.student_name, p.institution_id, p.title].some((v) => v?.toLowerCase().includes(term)))
  );
}

/** Projects that count on the dashboards: withdrawn students are left out. */
export const countable = <T extends OverviewLike>(rows: readonly T[]) =>
  rows.filter((p) => p.roster_status !== 'withdrawn');

export function flagCounts(rows: readonly OverviewLike[]): Record<Flag, number> {
  const out = {} as Record<Flag, number>;
  for (const flag of Object.keys(FLAGS) as Flag[]) {
    out[flag] = rows.filter((p) => hasFlag(p, flag)).length;
  }
  return out;
}

/** How many projects are at each stage (the stage funnel), plus completed ones. */
export function stageFunnel(rows: readonly OverviewLike[]) {
  return [
    ...STAGES.map((s) => ({
      key: s.key as StageKey | 'complete',
      label: `S${s.no} ${s.name}`,
      count: rows.filter((p) => p.current_stage === s.key).length,
    })),
    {
      key: 'complete' as const,
      label: 'All stages complete',
      count: rows.filter((p) => !p.current_stage).length,
    },
  ];
}

/** Domain × current stage counts for the lead's heat table. */
export function domainStageMatrix(rows: readonly OverviewLike[]) {
  const domains = new Map<string, { id: string; name: string }>();
  for (const p of rows) {
    const id = p.domain_id ?? 'none';
    if (!domains.has(id)) domains.set(id, { id, name: p.domain_name ?? 'No domain' });
  }
  return [...domains.values()]
    .sort((a, b) => (a.id === 'none' ? 1 : b.id === 'none' ? -1 : a.name.localeCompare(b.name)))
    .map((d) => {
      const inDomain = rows.filter((p) => (p.domain_id ?? 'none') === d.id);
      return {
        ...d,
        total: inDomain.length,
        cells: STAGES.map((s) => inDomain.filter((p) => p.current_stage === s.key).length),
        complete: inDomain.filter((p) => !p.current_stage).length,
      };
    });
}

export function averageProgress(rows: readonly OverviewLike[]): number | null {
  const values = rows.map((p) => p.progress).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Shade for a heat-table cell: share of the largest count, in 5 steps (0–4). */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4;
}
