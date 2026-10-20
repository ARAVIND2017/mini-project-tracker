import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, Button, Card, LoadingState, TextField } from '@/components/ui';
import { isHod } from '@/domain/context';
import { getSemester, listProjects, type ProjectRow } from '@/lib/api';
import { listPanels, setPanel, type PanelRow } from '@/lib/final';
import { useActiveContext } from '../auth/authContext';
import { useFacultyOptions, type FacultyOption } from '../projects/useFacultyOptions';
import { SemesterNav } from '../semesters/SemesterNav';
import { StaffOnly } from '../semesters/StaffOnly';

export function PanelsPage() {
  return (
    <StaffOnly>
      <PanelsContent />
    </StaffOnly>
  );
}

function PanelsContent() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const queryClient = useQueryClient();
  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const panels = useQuery({
    queryKey: ['panels', semesterId],
    queryFn: () => listPanels(semesterId),
  });
  const projects = useQuery({
    queryKey: ['projects', semesterId],
    queryFn: () => listProjects(semesterId),
  });
  const faculty = useFacultyOptions(semesterId, ctx);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const save = useMutation({
    mutationFn: setPanel,
    onSuccess: () => {
      setMessage({ tone: 'success', text: 'Panel saved.' });
      setEditing(null);
      return queryClient.invalidateQueries({ queryKey: ['panels', semesterId] });
    },
    onError: (err) => setMessage({ tone: 'error', text: err.message }),
  });

  if (panels.isPending || projects.isPending) {
    return (
      <>
        <SemesterNav />
        <LoadingState />
      </>
    );
  }
  if (panels.error) return <Alert tone="error">{panels.error.message}</Alert>;

  const canEdit = isHod(ctx) && semester.data?.status !== 'closed';
  const name = (id: string) => faculty.options.find((f) => f.id === id)?.name ?? 'Faculty member';
  const projectList = (projects.data ?? []).filter((p) => p.roster_status !== 'withdrawn');
  const projectName = (id: string) => {
    const p = projectList.find((x) => x.id === id);
    return p ? `Slot ${p.slot_no} · ${p.student_name}` : 'Project';
  };
  const quorum = semester.data?.panel_quorum;

  return (
    <div>
      <SemesterNav />
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Each project is signed off by its panel. A project is complete when{' '}
        {quorum ? `${quorum} member(s)` : 'every member'} of its panel approve
        {quorum ? '' : ' (the quorum can be changed in the semester settings)'}. A guide may sit on
        their own student&apos;s panel.
      </p>
      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      <div className="space-y-3">
        {panels.data.length === 0 && editing !== 'new' && (
          <p className="text-sm text-slate-600 dark:text-slate-300">No panels yet.</p>
        )}
        {panels.data.map((p) =>
          editing === p.panel.id ? (
            <PanelForm
              key={p.panel.id}
              panel={p}
              faculty={faculty.options}
              projects={projectList}
              busy={save.isPending}
              onCancel={() => setEditing(null)}
              onSave={(v) => save.mutate({ semesterId, panelId: p.panel.id, ...v })}
            />
          ) : (
            <Card
              key={p.panel.id}
              title={p.panel.name}
              actions={
                canEdit && (
                  <Button variant="secondary" onClick={() => setEditing(p.panel.id)}>
                    Edit panel
                  </Button>
                )
              }
            >
              <p className="text-sm">
                <span className="font-medium">Members:</span> {p.memberIds.map(name).join(', ')}
              </p>
              <p className="mt-1 text-sm">
                <span className="font-medium">Projects ({p.projectIds.length}):</span>{' '}
                {p.projectIds.length === 0
                  ? 'none'
                  : p.projectIds.map((id, i) => (
                      <span key={id}>
                        {i > 0 && ', '}
                        <Link
                          to={`/projects/${id}?stage=final`}
                          className="text-blue-700 underline dark:text-blue-300"
                        >
                          {projectName(id)}
                        </Link>
                      </span>
                    ))}
              </p>
            </Card>
          ),
        )}
        {canEdit &&
          (editing === 'new' ? (
            <PanelForm
              faculty={faculty.options}
              projects={projectList}
              busy={save.isPending}
              onCancel={() => setEditing(null)}
              onSave={(v) => save.mutate({ semesterId, ...v })}
            />
          ) : (
            <Button variant="secondary" onClick={() => setEditing('new')}>
              Create a panel
            </Button>
          ))}
      </div>
    </div>
  );
}

function PanelForm({
  panel,
  faculty,
  projects,
  busy,
  onSave,
  onCancel,
}: {
  panel?: PanelRow;
  faculty: FacultyOption[];
  projects: ProjectRow[];
  busy: boolean;
  onSave: (v: { name: string; memberIds: string[]; projectIds: string[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(panel?.panel.name ?? '');
  const [members, setMembers] = useState<string[]>(panel?.memberIds ?? []);
  const [selected, setSelected] = useState<string[]>(panel?.projectIds ?? []);
  const toggle = (list: string[], id: string, on: boolean) =>
    on ? [...list, id] : list.filter((x) => x !== id);
  return (
    <Card title={panel ? `Edit ${panel.panel.name}` : 'New panel'}>
      <form
        aria-label={panel ? `Edit panel ${panel.panel.name}` : 'New panel'}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name, memberIds: members, projectIds: selected });
        }}
      >
        <TextField label="Panel name" value={name} onChange={(e) => setName(e.target.value)} />
        <fieldset>
          <legend className="text-sm font-medium">Members</legend>
          <div className="mt-1 grid gap-1 sm:grid-cols-3">
            {faculty.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={members.includes(f.id)}
                  onChange={(e) => setMembers(toggle(members, f.id, e.target.checked))}
                />
                {f.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">Projects</legend>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A project moved here leaves any other panel.
          </p>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {projects.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id as string)}
                  onChange={(e) => setSelected(toggle(selected, p.id as string, e.target.checked))}
                />
                Slot {p.slot_no} · {p.student_name}
                {p.guide_name && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    (guide: {p.guide_name})
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <Button type="submit" busy={busy}>
            Save panel
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
