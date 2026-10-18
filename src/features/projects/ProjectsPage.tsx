import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Alert, Card, LoadingState, SelectField, TextField } from '@/components/ui';
import { STAGES } from '@/domain/constants';
import { hasAdminPermission, isHod } from '@/domain/context';
import { assignGuide, getSemester, listDomains, listProjects, setProjectDomain } from '@/lib/api';
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
    queryKey: ['projects', semesterId],
    queryFn: () => listProjects(semesterId),
  });
  const domains = useQuery({
    queryKey: ['domains', semesterId],
    queryFn: () => listDomains(semesterId),
  });
  const faculty = useFacultyOptions(semesterId, ctx);
  const closed = semester.data?.status === 'closed';
  const canSetDomain = hasAdminPermission(ctx, 'manage_config') && !closed;
  const canAssignGuide = isHod(ctx) && !closed;

  const [domainFilter, setDomainFilter] = useState('');
  const [guideFilter, setGuideFilter] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const action = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', semesterId] }),
    onError: (err) => setMessage({ tone: 'error', text: err.message }),
  });
  const run = (fn: () => Promise<unknown>, success: string) => {
    setMessage(null);
    action.mutate(fn, { onSuccess: () => setMessage({ tone: 'success', text: success }) });
  };

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (projects.data ?? []).filter(
      (p) =>
        (!domainFilter ||
          (domainFilter === 'none' ? !p.domain_id : p.domain_id === domainFilter)) &&
        (!guideFilter || (guideFilter === 'none' ? !p.guide_id : p.guide_id === guideFilter)) &&
        (!term ||
          [p.student_name, p.institution_id, p.title].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [projects.data, domainFilter, guideFilter, search]);

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
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <TextField
            label="Search"
            placeholder="Name, student ID or title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SelectField
            label="Domain"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
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
            value={guideFilter}
            onChange={(e) => setGuideFilter(e.target.value)}
          >
            <option value="">All guides</option>
            <option value="none">Unassigned</option>
            {faculty.options.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </SelectField>
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
                      <div className="font-medium">{p.student_name}</div>
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
                    <td className="px-4 py-2 align-top">{stageName(p.current_stage)}</td>
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
