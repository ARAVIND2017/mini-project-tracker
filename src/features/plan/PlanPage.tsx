import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import {
  Alert,
  Button,
  Card,
  ListField,
  LoadingState,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui';
import { ENUMS, STAGES, type StageKey } from '@/domain/constants';
import { hasAdminPermission } from '@/domain/context';
import { toHHMM, weekDueDate, weekdayLabel } from '@/domain/semester';
import { cleanList } from '@/domain/workspace';
import { getSemester, listDomains, type Domain } from '@/lib/api';
import type { Enums } from '@/lib/database.types';
import {
  generateTasks,
  listPlan,
  upsertMilestone,
  upsertTaskTemplate,
  type Milestone,
  type TaskTemplate,
} from '@/lib/tasks';
import { useActiveContext } from '../auth/authContext';
import { EVIDENCE_LABELS } from '../research/format';
import { SemesterNav } from '../semesters/SemesterNav';
import { StaffOnly } from '../semesters/StaffOnly';

const stageLabel = (key: string) => {
  const s = STAGES.find((x) => x.key === key);
  return s ? `S${s.no} ${s.name}` : key;
};

export function PlanPage() {
  return (
    <StaffOnly>
      <PlanContent />
    </StaffOnly>
  );
}

function PlanContent() {
  const { semesterId = '' } = useParams();
  const ctx = useActiveContext();
  const queryClient = useQueryClient();
  const semester = useQuery({
    queryKey: ['semester', semesterId],
    queryFn: () => getSemester(semesterId),
  });
  const plan = useQuery({ queryKey: ['plan', semesterId], queryFn: () => listPlan(semesterId) });
  const domains = useQuery({
    queryKey: ['domains', semesterId],
    queryFn: () => listDomains(semesterId),
  });
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | 'new' | null>(null);

  const action = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plan', semesterId] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      ]),
  });
  const run = (
    fn: () => Promise<unknown>,
    success: (result: unknown) => string,
    done?: () => void,
  ) => {
    setMessage(null);
    action.mutate(fn, {
      onSuccess: (result) => {
        setMessage({ tone: 'success', text: success(result) });
        done?.();
      },
      onError: (err) => setMessage({ tone: 'error', text: err.message }),
    });
  };

  if (semester.isPending || plan.isPending) {
    return (
      <>
        <SemesterNav />
        <LoadingState />
      </>
    );
  }
  if (semester.error || plan.error) {
    return <Alert tone="error">{(semester.error ?? plan.error)?.message}</Alert>;
  }

  const s = semester.data;
  const canEdit = hasAdminPermission(ctx, 'manage_config') && s.status !== 'closed';
  const weeks = Array.from({ length: s.week_count }, (_, i) => i + 1);
  const domainName = (id: string | null) =>
    id ? ((domains.data ?? []).find((d) => d.id === id)?.name ?? 'Unknown domain') : 'All domains';
  const generic = plan.data.templates.filter((t) => !t.domain_id);

  return (
    <div>
      <SemesterNav />
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        The {s.week_count}-week plan. Work for each week is due on{' '}
        {weekdayLabel(s.submission_weekday)} at {toHHMM(s.submission_time)} ({s.timezone}) before
        the next lab. Every project gets one task per template: templates for all domains, plus
        those of its own domain (a domain task can replace a generic one).
      </p>
      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      {!s.start_date && (
        <div className="mb-4">
          <Alert>
            Set the semester start date on the Overview tab; deadlines are computed from it.
          </Alert>
        </div>
      )}
      {canEdit && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            busy={action.isPending}
            disabled={!s.start_date}
            onClick={() =>
              run(
                () => generateTasks(semesterId, false),
                (n) => `${n as number} task(s) created.`,
              )
            }
          >
            Create missing tasks
          </Button>
          <Button
            variant="secondary"
            busy={action.isPending}
            disabled={!s.start_date}
            onClick={() =>
              window.confirm(
                'Update every task that has no submission yet with the current plan (text and deadline)? Submitted work is never changed.',
              ) &&
              run(
                () => generateTasks(semesterId, true),
                (n) => `${n as number} task(s) created or updated.`,
              )
            }
          >
            Apply plan changes to unsubmitted tasks
          </Button>
        </div>
      )}

      <ol className="space-y-3">
        {weeks.map((week) => {
          const m = plan.data.milestones.find((x) => x.week_no === week);
          const due =
            s.start_date &&
            `${weekDueDate(s.start_date, week, s.submission_weekday, m?.start_date_override)} ${toHHMM(s.submission_time)}`;
          return (
            <li key={week}>
              <Card>
                {editingWeek === week ? (
                  <MilestoneForm
                    week={week}
                    milestone={m}
                    busy={action.isPending}
                    onCancel={() => setEditingWeek(null)}
                    onSave={(data) =>
                      run(
                        () => upsertMilestone(semesterId, week, data),
                        () => `Week ${week} saved.`,
                        () => setEditingWeek(null),
                      )
                    }
                  />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">
                        Week {week}
                        {m ? ` · ${m.title}` : ''}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {m ? stageLabel(m.stage_key) : 'No milestone'}
                        {due && ` · due ${due}`}
                        {m?.start_date_override && ` · starts ${m.start_date_override}`}
                      </p>
                      {m?.checkpoint && (
                        <p
                          className={`mt-1 text-xs ${m.is_gate ? 'font-medium text-amber-800 dark:text-amber-300' : ''}`}
                        >
                          {m.is_gate ? '! ' : ''}
                          {m.checkpoint}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <Button variant="secondary" onClick={() => setEditingWeek(week)}>
                        Edit week {week}
                      </Button>
                    )}
                  </div>
                )}
                <ul className="mt-3 space-y-2">
                  {plan.data.templates
                    .filter((t) => t.week_no === week)
                    .map((t) =>
                      editingTemplate === t.id ? (
                        <li key={t.id}>
                          <TemplateForm
                            template={t}
                            weeks={weeks}
                            domains={domains.data ?? []}
                            generic={generic}
                            busy={action.isPending}
                            onCancel={() => setEditingTemplate(null)}
                            onSave={(data) =>
                              run(
                                () => upsertTaskTemplate(semesterId, data, t.id),
                                () => 'Task saved.',
                                () => setEditingTemplate(null),
                              )
                            }
                          />
                        </li>
                      ) : (
                        <li
                          key={t.id}
                          className={`rounded-md bg-slate-50 p-2 text-sm dark:bg-slate-800/40 ${t.is_active ? '' : 'opacity-60'}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{t.title}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {stageLabel(t.stage_key)} · {domainName(t.domain_id)}
                              {t.replaces_template_id &&
                                ` · replaces "${plan.data.templates.find((x) => x.id === t.replaces_template_id)?.title ?? 'a task'}"`}
                              {!t.is_active && ' · switched off'}
                            </span>
                            {canEdit && (
                              <span className="ml-auto flex gap-2">
                                <Button
                                  variant="secondary"
                                  onClick={() => setEditingTemplate(t.id)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="secondary"
                                  busy={action.isPending}
                                  onClick={() =>
                                    run(
                                      () =>
                                        upsertTaskTemplate(
                                          semesterId,
                                          { ...templateData(t), is_active: !t.is_active },
                                          t.id,
                                        ),
                                      () =>
                                        t.is_active ? 'Task switched off.' : 'Task switched on.',
                                    )
                                  }
                                >
                                  {t.is_active ? 'Switch off' : 'Switch on'}
                                </Button>
                              </span>
                            )}
                          </div>
                          <ul className="mt-1 list-disc pl-5 text-xs">
                            {t.acceptance_criteria.map((c) => (
                              <li key={c}>{c}</li>
                            ))}
                          </ul>
                          {t.required_evidence.length > 0 && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Evidence:{' '}
                              {t.required_evidence.map((e) => EVIDENCE_LABELS[e]).join(', ')}
                            </p>
                          )}
                        </li>
                      ),
                    )}
                </ul>
              </Card>
            </li>
          );
        })}
      </ol>

      {canEdit && (
        <div className="mt-6">
          {editingTemplate === 'new' ? (
            <Card title="New task template">
              <TemplateForm
                weeks={weeks}
                domains={domains.data ?? []}
                generic={generic}
                busy={action.isPending}
                onCancel={() => setEditingTemplate(null)}
                onSave={(data) =>
                  run(
                    () => upsertTaskTemplate(semesterId, data),
                    () => 'Task added to the plan.',
                    () => setEditingTemplate(null),
                  )
                }
              />
            </Card>
          ) : (
            <Button variant="secondary" onClick={() => setEditingTemplate('new')}>
              Add a task to the plan
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function templateData(t: TaskTemplate) {
  return {
    week_no: t.week_no,
    stage_key: t.stage_key,
    domain_id: t.domain_id,
    replaces_template_id: t.replaces_template_id,
    title: t.title,
    description: t.description,
    acceptance_criteria: t.acceptance_criteria,
    required_evidence: t.required_evidence,
    sort_order: t.sort_order,
    is_active: t.is_active,
  };
}

function MilestoneForm({
  week,
  milestone: m,
  busy,
  onSave,
  onCancel,
}: {
  week: number;
  milestone?: Milestone;
  busy: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    title: m?.title ?? '',
    stage_key: (m?.stage_key ?? 'exploration') as StageKey,
    checkpoint: m?.checkpoint ?? '',
    is_gate: m?.is_gate ?? false,
    start_date_override: m?.start_date_override ?? '',
    description: m?.description ?? '',
  });
  return (
    <form
      aria-label={`Edit week ${week}`}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...f, start_date_override: f.start_date_override || null });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Week title"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
        <SelectField
          label="Main stage"
          value={f.stage_key}
          onChange={(e) => setF({ ...f, stage_key: e.target.value as StageKey })}
        >
          {ENUMS.stage_key.map((k) => (
            <option key={k} value={k}>
              {stageLabel(k)}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Checkpoint"
          value={f.checkpoint}
          onChange={(e) => setF({ ...f, checkpoint: e.target.value })}
        />
        <TextField
          label="Start date override (optional)"
          type="date"
          value={f.start_date_override}
          onChange={(e) => setF({ ...f, start_date_override: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={f.is_gate}
          onChange={(e) => setF({ ...f, is_gate: e.target.checked })}
        />
        This week is a gate
      </label>
      <div className="flex gap-2">
        <Button type="submit" busy={busy}>
          Save week
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TemplateForm({
  template: t,
  weeks,
  domains,
  generic,
  busy,
  onSave,
  onCancel,
}: {
  template?: TaskTemplate;
  weeks: number[];
  domains: Domain[];
  generic: TaskTemplate[];
  busy: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    week_no: t?.week_no ?? 1,
    stage_key: (t?.stage_key ?? 'exploration') as StageKey,
    domain_id: t?.domain_id ?? '',
    replaces_template_id: t?.replaces_template_id ?? '',
    title: t?.title ?? '',
    description: t?.description ?? '',
  });
  const [criteria, setCriteria] = useState<string[]>(t?.acceptance_criteria ?? []);
  const [evidence, setEvidence] = useState<Enums<'evidence_category'>[]>(
    t?.required_evidence ?? [],
  );
  return (
    <form
      aria-label={t ? `Edit task ${t.title}` : 'New task template'}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...f,
          domain_id: f.domain_id || null,
          replaces_template_id: f.domain_id ? f.replaces_template_id || null : null,
          acceptance_criteria: cleanList(criteria),
          required_evidence: evidence,
          sort_order: t?.sort_order ?? 0,
          is_active: t?.is_active ?? true,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Week"
          value={f.week_no}
          onChange={(e) => setF({ ...f, week_no: Number(e.target.value) })}
        >
          {weeks.map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Stage"
          value={f.stage_key}
          onChange={(e) => setF({ ...f, stage_key: e.target.value as StageKey })}
        >
          {ENUMS.stage_key.map((k) => (
            <option key={k} value={k}>
              {stageLabel(k)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Domain"
          value={f.domain_id}
          onChange={(e) => setF({ ...f, domain_id: e.target.value })}
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
      </div>
      {f.domain_id && (
        <SelectField
          label="Replaces the generic task (optional)"
          value={f.replaces_template_id}
          onChange={(e) => setF({ ...f, replaces_template_id: e.target.value })}
        >
          <option value="">Does not replace a task (added for this domain)</option>
          {generic
            .filter((g) => g.id !== t?.id)
            .map((g) => (
              <option key={g.id} value={g.id}>
                Week {g.week_no}: {g.title}
              </option>
            ))}
        </SelectField>
      )}
      <TextField
        label="Task title"
        value={f.title}
        onChange={(e) => setF({ ...f, title: e.target.value })}
      />
      <TextAreaField
        label="Description (optional)"
        rows={2}
        value={f.description}
        onChange={(e) => setF({ ...f, description: e.target.value })}
      />
      <ListField
        label="Acceptance criteria"
        values={criteria}
        onChange={setCriteria}
        addLabel="Add a criterion"
      />
      <fieldset>
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Evidence expected
        </legend>
        <div className="mt-1 grid gap-1 sm:grid-cols-3">
          {ENUMS.evidence_category.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={evidence.includes(c)}
                onChange={(e) =>
                  setEvidence(e.target.checked ? [...evidence, c] : evidence.filter((x) => x !== c))
                }
              />
              {EVIDENCE_LABELS[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" busy={busy}>
          Save task
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
