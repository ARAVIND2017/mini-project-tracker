import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { ProgressBar } from '@/components/ProgressBar';
import { Alert, Card, LoadingState, SelectField, TextField } from '@/components/ui';
import { STAGES } from '@/domain/constants';
import { hasAdminPermission, isHod, membershipFor } from '@/domain/context';
import { FLAGS, filtersFromParams, matchesFilters, type ProjectFilters } from '@/domain/dashboard';
import { assignGuide, getSemester, listDomains, setProjectDomain } from '@/lib/api';
import { listOverview } from '@/lib/reports';
import { OVERVIEW_COLUMNS } from '../dashboard/exportColumns';
import { useActiveContext } from '../auth/authContext';
import { SemesterNav } from '../semesters/SemesterNav';
import { StaffOnly } from '../semesters/StaffOnly';
import { useFacultyOptions } from './useFacultyOptions';

const stageName = (key: string | null) => {
  if (!key) return 'All stages complete';
  const stage = STAGES.find((s) => s.key === key);
  return stage ? `${stage.no}. ${stage.name}` : key;
};

export function ProjectsPage() {
  return (
    <StaffOnly>
      <ProjectsPageContent />
    </StaffOnly>
  );
}

function ProjectsPageContent() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const queryClient = useQueryClient();
  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const projects = useQuery({
    queryKey: ['overview', semesterId],
    queryFn: () => listOverview(semesterId),
  });
  const domains = useQuery({
    queryKey: ['domains', semesterId],
    queryFn: () => listDomains(semesterId),
  });
  const faculty = useFacultyOptions(semesterId, ctx);
  const closed = semester.data?.status === 'closed';
  const canSetDomain = hasAdminPermission(ctx, 'manage_config') && !closed;
  const canAssignGuide = isHod(ctx) && !closed;
  // CSV export is for the HOD, admins and the lead (FUN-17).
  const canExport =
    isHod(ctx) ||
    ctx.system_roles.some((r) => r.role === 'admin') ||
    membershipFor(ctx, semesterId)?.role === 'lead_faculty';

  // Filters live in the URL so that dashboard numbers can link to this list (UI-02).
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const showWithdrawn = params.get('withdrawn') === '1';
  const setFilter = (key: keyof ProjectFilters | 'withdrawn', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const action = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['overview', semesterId] }),
        queryClient.invalidateQueries({ queryKey: ['projects', semesterId] }),
      ]),
    onError: (err) => setMessage({ tone: 'error', text: err.message }),
  });
  const run = (fn: () => Promise<unknown>, success: string) => {
    setMessage(null);
    action.mutate(fn, { onSuccess: () => setMessage({ tone: 'success', text: success }) });
  };

  const paramKey = params.toString();
  const rows = useMemo(() => {
    const f = filtersFromParams(new URLSearchParams(paramKey));
    const withdrawn = new URLSearchParams(paramKey).get('withdrawn') === '1';
    return (projects.data ?? []).filter(
      (p) => (withdrawn || p.roster_status !== 'withdrawn') && matchesFilters(p, f),
    );
  }, [projects.data, paramKey]);

  if (projects.isPending) {
    return (
      <>
        <SemesterNav />
        <LoadingState />
      </>
    );
  }
  if (projects.error) return <Alert tone="error">{projects.error.message}</Alert>;

  const activeDomains = (domains.data ?? []).filter((d) => d.is_active);
  const unassigned = (projects.data ?? []).filter((p) => !p.guide_id).length;

  return (
    <div>
      <SemesterNav />
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span>
          <strong>{projects.data.length}</strong> projects
        </span>
        <span>
          <strong>{unassigned}</strong> without a guide
        </span>
        <span>
          <strong>{projects.data.filter((p) => !p.domain_id).length}</strong> without a domain
        </span>
      </div>
      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <TextField
            label="Search"
            placeholder="Name, student ID or title"
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
          />
          <SelectField
            label="Domain"
            value={filters.domain}
            onChange={(e) => setFilter('domain', e.target.value)}
          >
            <option value="">All domains</option>
            <option value="none">No domain</option>
            {(domains.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Guide"
            value={filters.guide}
            onChange={(e) => setFilter('guide', e.target.value)}
          >
            <option value="">All guides</option>
            <option value="none">Unassigned</option>
            {faculty.options.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Current stage"
            value={filters.stage}
            onChange={(e) => setFilter('stage', e.target.value)}
          >
            <option value="">All stages</option>
            {STAGES.map((st) => (
              <option key={st.key} value={st.key}>
                S{st.no} {st.name}
              </option>
            ))}
            <option value="complete">All stages complete</option>
          </SelectField>
          <SelectField
            label="Flag"
            value={filters.flag}
            onChange={(e) => setFilter('flag', e.target.value)}
          >
            <option value="">Any</option>
            {Object.entries(FLAGS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showWithdrawn}
              onChange={(e) => setFilter('withdrawn', e.target.checked ? '1' : '')}
            />
            Include withdrawn students
          </label>
          <span className="flex items-center gap-3">
            <span role="status">
              Showing <strong>{rows.length}</strong> of {projects.data.length}
            </span>
            {params.toString() && (
              <button
                type="button"
                className="text-blue-700 underline dark:text-blue-300"
                onClick={() => setParams({}, { replace: true })}
              >
                Clear filters
              </button>
            )}
            {canExport && (
              <ExportCsvButton rows={rows} columns={OVERVIEW_COLUMNS} name="projects" />
            )}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {projects.data.length === 0
              ? 'No projects yet. Projects are created when students are added to the roster.'
              : 'No projects match these filters.'}
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Slot</th>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Domain</th>
                  <th className="px-4 py-2 font-medium">Guide</th>
                  <th className="px-4 py-2 font-medium">Co-reviewers</th>
                  <th className="px-4 py-2 font-medium">Current stage</th>
                  <th className="px-4 py-2 font-medium">Progress</th>
                  <th className="px-4 py-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className={p.roster_status === 'withdrawn' ? 'text-slate-400' : ''}
                  >
                    <td className="px-4 py-2 align-top">{p.slot_no}</td>
                    <td className="px-4 py-2 align-top">
                      <Link
                        to={`/projects/${p.id}`}
                        className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                      >
                        {p.student_name}
                      </Link>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {p.institution_id ?? 'No student ID'}
                        {p.roster_status === 'withdrawn' && ' · withdrawn'}
                      </div>
                      {p.title && <div className="mt-1 text-xs italic">{p.title}</div>}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {canSetDomain ? (
                        <select
                          aria-label={`Domain for ${p.student_name}`}
                          className="rounded-md border-0 bg-white py-1 pl-2 pr-7 text-sm ring-1 ring-slate-300 dark:bg-slate-900 dark:ring-slate-700"
                          value={p.domain_id ?? ''}
                          disabled={action.isPending}
                          onChange={(e) =>
                            p.id &&
                            run(
                              () => setProjectDomain(p.id as string, e.target.value || null),
                              `Domain updated for ${p.student_name}.`,
                            )
                          }
                        >
                          <option value="">— none —</option>
                          {activeDomains.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                          {p.domain_id && !activeDomains.some((d) => d.id === p.domain_id) && (
                            <option value={p.domain_id}>{p.domain_name} (switched off)</option>
                          )}
                        </select>
                      ) : (
                        (p.domain_name ?? '—')
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {canAssignGuide ? (
                        <select
                          aria-label={`Guide for ${p.student_name}`}
                          className="rounded-md border-0 bg-white py-1 pl-2 pr-7 text-sm ring-1 ring-slate-300 dark:bg-slate-900 dark:ring-slate-700"
                          value={p.guide_id ?? ''}
                          disabled={action.isPending}
                          onChange={(e) => {
                            const next = e.target.value || null;
                            const label = next
                              ? faculty.options.find((f) => f.id === next)?.name
                              : 'no guide';
                            if (
                              window.confirm(`Set the guide for ${p.student_name} to ${label}?`)
                            ) {
                              run(
                                () => assignGuide(p.id as string, next),
                                `Guide updated for ${p.student_name}.`,
                              );
                            }
                          }}
                        >
                          <option value="">Unassigned</option>
                          {faculty.options.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      ) : p.guide_name ? (
                        p.guide_name
                      ) : (
                        <span className="text-amber-800 dark:text-amber-300">! Unassigned</span>
                      )}
                      {(p.pending_requests ?? 0) > 0 && (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {p.pending_requests} request(s) waiting
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {p.co_reviewer_names?.length ? p.co_reviewer_names.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {stageName(p.current_stage)}
                      {(p.awaiting_review ?? 0) > 0 && (
                        <div className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                          ! {p.awaiting_review} waiting for review
                        </div>
                      )}
                      {p.selected_paper_title && (
                        <div
                          className="mt-1 max-w-56 truncate text-xs text-slate-500 dark:text-slate-400"
                          title={p.selected_paper_title}
                        >
                          Paper: {p.selected_paper_title}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <ProgressBar value={p.progress} compact />
                    </td>
                    <td className="px-4 py-2 align-top text-xs">
                      {(p.overdue_tasks ?? 0) > 0 && (
                        <div className="font-medium text-red-800 dark:text-red-300">
                          ✕ {p.overdue_tasks} overdue
                        </div>
                      )}
                      {(p.blocked || (p.blocked_tasks ?? 0) > 0) && (
                        <div className="font-medium text-red-800 dark:text-red-300">✕ Blocked</div>
                      )}
                      {(p.open_corrections ?? 0) > 0 && (
                        <div className="text-amber-800 dark:text-amber-300">
                          ! {p.open_corrections} open correction(s)
                        </div>
                      )}
                      {p.is_completed && (
                        <div className="text-green-800 dark:text-green-300">✓ Complete</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
