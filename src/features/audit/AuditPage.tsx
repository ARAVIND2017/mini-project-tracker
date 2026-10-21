import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { Alert, Card, LoadingState, SelectField } from '@/components/ui';
import { isHod, membershipFor } from '@/domain/context';
import { profileNames } from '@/lib/api';
import { listAudit, listOverview, type AuditEntry } from '@/lib/reports';
import { useActiveContext } from '../auth/authContext';
import { AUDIT_COLUMNS } from '../dashboard/exportColumns';
import { formatWhen } from '../research/format';
import { SemesterNav } from '../semesters/SemesterNav';

const GROUPS = [
  { value: '', label: 'Everything' },
  { value: 'review.', label: 'Reviews' },
  { value: 'correction.', label: 'Corrections' },
  { value: 'record.', label: 'Submissions of stage records' },
  { value: 'task.', label: 'Weekly tasks' },
  { value: 'assignment.', label: 'Guide and co-reviewer requests' },
  { value: 'project.', label: 'Projects (guide, domain, escalation, completion)' },
  { value: 'signoff.', label: 'Panel sign-off' },
  { value: 'stage.', label: 'Stage exceptions' },
  { value: 'override.', label: 'HOD overrides' },
  { value: 'meeting.', label: 'Meetings' },
  { value: 'roster.', label: 'Roster' },
  { value: 'semester.', label: 'Semester settings' },
];

/** Who did what and when (HOD, admins and the semester lead). Read-only: the log cannot be changed. */
export function AuditPage() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const allowed =
    isHod(ctx) ||
    ctx.system_roles.some((r) => r.role === 'admin') ||
    membershipFor(ctx, semesterId)?.role === 'lead_faculty';
  const [action, setAction] = useState('');
  const [projectId, setProjectId] = useState('');
  const audit = useQuery({
    queryKey: ['audit', semesterId, action, projectId],
    queryFn: () => listAudit({ semesterId, action, projectId }),
    enabled: allowed,
  });
  const projects = useQuery({
    queryKey: ['overview', semesterId],
    queryFn: () => listOverview(semesterId),
    enabled: allowed,
  });
  const actorIds = [
    ...new Set((audit.data ?? []).map((a) => a.actor_id).filter((x): x is string => !!x)),
  ];
  const names = useQuery({
    queryKey: ['names', actorIds.join(',')],
    queryFn: () => profileNames(actorIds),
    enabled: actorIds.length > 0,
  });

  if (!allowed) {
    return (
      <div>
        <SemesterNav />
        <Alert>The audit log is available to the HOD, administrators and the lead faculty.</Alert>
      </div>
    );
  }
  const nameOf = names.data ?? {};
  const studentOf: Record<string, string> = Object.fromEntries(
    (projects.data ?? []).map((p) => [p.id ?? '', p.student_name ?? `Slot ${p.slot_no}`]),
  );

  return (
    <div>
      <SemesterNav />
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Every workflow action, newest first (the latest 500 for the filters chosen). Entries cannot
        be edited or deleted.
        {!isHod(ctx) &&
          !ctx.system_roles.some((r) => r.role === 'admin') &&
          ' As lead you see the entries about this semester’s projects; semester-wide entries (settings, roster, meetings) are visible to the HOD.'}
      </p>
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SelectField label="Action" value={action} onChange={(e) => setAction(e.target.value)}>
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">All projects</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id ?? ''}>
                {p.student_name ?? `Slot ${p.slot_no}`}
              </option>
            ))}
          </SelectField>
          <ExportCsvButton
            rows={audit.data ?? []}
            columns={AUDIT_COLUMNS(nameOf)}
            name="audit-log"
          />
        </div>
        {audit.isPending ? (
          <LoadingState />
        ) : audit.error ? (
          <Alert tone="error">{audit.error.message}</Alert>
        ) : audit.data.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No entries for these filters.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Who</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-4 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {audit.data.map((a) => (
                  <AuditRow
                    key={a.id}
                    a={a}
                    who={a.actor_id ? (nameOf[a.actor_id] ?? '…') : 'System'}
                    student={a.project_id ? studentOf[a.project_id] : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function AuditRow({ a, who, student }: { a: AuditEntry; who: string; student?: string }) {
  const details = a.new_data && typeof a.new_data === 'object' ? JSON.stringify(a.new_data) : '';
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-2 align-top">{formatWhen(a.created_at)}</td>
      <td className="px-4 py-2 align-top">{who}</td>
      <td className="px-4 py-2 align-top font-mono text-xs">{a.action}</td>
      <td className="px-4 py-2 align-top">
        {a.project_id ? (
          <Link
            to={`/projects/${a.project_id}`}
            className="text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
          >
            {student ?? 'Project'}
          </Link>
        ) : (
          '—'
        )}
      </td>
      <td className="max-w-md px-4 py-2 align-top">
        <span
          className="line-clamp-2 break-all font-mono text-xs text-slate-600 dark:text-slate-300"
          title={details}
        >
          {details || '—'}
        </span>
      </td>
    </tr>
  );
}
