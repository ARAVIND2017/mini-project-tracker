import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { Alert, Button, Card, LoadingState, TextField } from '@/components/ui';
import { hasAdminPermission } from '@/domain/context';
import {
  getSemester,
  listCriteria,
  listDomains,
  upsertCriterion,
  upsertDomain,
  type Domain,
} from '@/lib/api';
import { useActiveContext } from '../auth/authContext';
import { SemesterNav } from '../semesters/SemesterNav';

export function DomainsPage() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const queryClient = useQueryClient();
  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const domains = useQuery({
    queryKey: ['domains', semesterId],
    queryFn: () => listDomains(semesterId),
  });
  const criteria = useQuery({
    queryKey: ['criteria', semesterId],
    queryFn: () => listCriteria(semesterId),
  });
  const canEdit = hasAdminPermission(ctx, 'manage_config') && semester.data?.status !== 'closed';
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['domains', semesterId] }),
      queryClient.invalidateQueries({ queryKey: ['criteria', semesterId] }),
    ]);

  const save = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (err) => setMessage({ tone: 'error', text: err.message }),
  });
  const run = (fn: () => Promise<unknown>, success: string) => {
    setMessage(null);
    save.mutate(fn, { onSuccess: () => setMessage({ tone: 'success', text: success }) });
  };

  if (domains.isPending || criteria.isPending) {
    return (
      <>
        <SemesterNav />
        <LoadingState />
      </>
    );
  }
  if (domains.error) return <Alert tone="error">{domains.error.message}</Alert>;

  const list = domains.data;
  return (
    <div>
      <SemesterNav />
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Project domains for this semester. Faculty choose the domains they are expert in, and
        students are placed in a domain. Domains are switched off rather than deleted, so history is
        kept.
      </p>
      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {canEdit && (
        <NewDomainForm
          busy={save.isPending}
          onSave={(name, description) =>
            run(() => upsertDomain({ semesterId, name, description }), `Domain “${name}” added.`)
          }
        />
      )}

      {list.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No domains yet.
            {canEdit
              ? ' Add the first one above — a semester needs at least one domain before it can be activated.'
              : ''}
          </p>
        </Card>
      ) : (
        <ul className="mt-4 space-y-4">
          {list.map((d) => (
            <li key={d.id}>
              <DomainCard
                domain={d}
                criteria={(criteria.data ?? []).filter((c) => c.domain_id === d.id)}
                canEdit={canEdit}
                busy={save.isPending}
                onSave={(name, description, isActive) =>
                  run(
                    () => upsertDomain({ semesterId, domainId: d.id, name, description, isActive }),
                    isActive === d.is_active
                      ? 'Domain saved.'
                      : isActive
                        ? 'Domain switched on.'
                        : 'Domain switched off.',
                  )
                }
                onAddCriterion={(name, description) =>
                  run(
                    () =>
                      upsertCriterion({
                        domainId: d.id,
                        name,
                        description,
                        sortOrder:
                          (criteria.data ?? []).filter((c) => c.domain_id === d.id).length + 1,
                      }),
                    'Criterion added.',
                  )
                }
                onToggleCriterion={(c) =>
                  run(
                    () =>
                      upsertCriterion({
                        domainId: d.id,
                        criterionId: c.id,
                        name: c.name,
                        description: c.description ?? undefined,
                        sortOrder: c.sort_order,
                        isActive: !c.is_active,
                      }),
                    c.is_active ? 'Criterion switched off.' : 'Criterion switched on.',
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewDomainForm({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (name: string, description: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), description.trim());
    setName('');
    setDescription('');
  }
  return (
    <Card title="Add a domain">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <TextField
          label="Name"
          placeholder="e.g. Machine Learning"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit" busy={busy} disabled={!name.trim()}>
          Add domain
        </Button>
      </form>
    </Card>
  );
}

interface DomainCardProps {
  domain: Domain;
  criteria: {
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_active: boolean;
  }[];
  canEdit: boolean;
  busy: boolean;
  onSave: (name: string, description: string, isActive: boolean) => void;
  onAddCriterion: (name: string, description: string) => void;
  onToggleCriterion: (c: {
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
    is_active: boolean;
  }) => void;
}

function DomainCard({
  domain: d,
  criteria,
  canEdit,
  busy,
  onSave,
  onAddCriterion,
  onToggleCriterion,
}: DomainCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(d.name);
  const [description, setDescription] = useState(d.description ?? '');
  const [criterion, setCriterion] = useState('');

  return (
    <Card
      title={`${d.name}${d.is_active ? '' : ' (switched off)'}`}
      actions={
        canEdit && (
          <div className="flex gap-2">
            {!editing && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => onSave(d.name, d.description ?? '', !d.is_active)}
            >
              {d.is_active ? 'Switch off' : 'Switch on'}
            </Button>
          </div>
        )
      }
    >
      {editing ? (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(name.trim(), description.trim(), d.is_active);
            setEditing(false);
          }}
        >
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" busy={busy} disabled={!name.trim()}>
              Save
            </Button>
            <Button variant="secondary" type="button" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        d.description && (
          <p className="text-sm text-slate-600 dark:text-slate-300">{d.description}</p>
        )
      )}

      <h3 className="mt-4 text-sm font-medium">Evaluation criteria</h3>
      {criteria.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">None yet.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {criteria.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <span className={c.is_active ? '' : 'text-slate-400 line-through'}>{c.name}</span>
              {canEdit && (
                <button
                  type="button"
                  className="text-xs text-blue-700 underline dark:text-blue-300"
                  disabled={busy}
                  onClick={() => onToggleCriterion(c)}
                >
                  {c.is_active ? 'switch off' : 'switch on'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!criterion.trim()) return;
            onAddCriterion(criterion.trim(), '');
            setCriterion('');
          }}
        >
          <TextField
            className="min-w-64 flex-1"
            label="New criterion"
            placeholder="e.g. Accuracy improvement over the baseline"
            value={criterion}
            onChange={(e) => setCriterion(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={!criterion.trim() || busy}>
            Add
          </Button>
        </form>
      )}
    </Card>
  );
}
