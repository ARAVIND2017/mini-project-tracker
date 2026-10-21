import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Button, Card, SelectField } from '@/components/ui';
import { copySemesterConfig, listSemesters } from '@/lib/api';

/**
 * For a draft semester: copy the setup (domains, evaluation criteria, milestones, task
 * templates) from an earlier semester. People, the roster and projects are not copied.
 */
export function CopySetupCard({ semesterId }: { semesterId: string }) {
  const queryClient = useQueryClient();
  const semesters = useQuery({ queryKey: ['semesters'], queryFn: listSemesters });
  const [from, setFrom] = useState('');
  const others = (semesters.data ?? []).filter((s) => s.id !== semesterId);
  const copy = useMutation({
    mutationFn: () => copySemesterConfig(from, semesterId),
    onSuccess: () =>
      Promise.all(
        ['domains', 'plan', 'semester'].map((k) =>
          queryClient.invalidateQueries({ queryKey: [k, semesterId] }),
        ),
      ),
  });

  if (others.length === 0) return null;
  return (
    <Card title="Copy the setup from an earlier semester">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
        Copies the domains, evaluation criteria, milestones and weekly task templates. The current
        task plan of this semester is switched off and replaced. People, the roster and projects are
        not copied.
      </p>
      {copy.error && (
        <div className="mb-3">
          <Alert tone="error">{copy.error.message}</Alert>
        </div>
      )}
      {copy.data && (
        <div className="mb-3">
          <Alert tone="success">
            Copied: {copy.data.domains_added} new domain(s), {copy.data.criteria_added} criteria,{' '}
            {copy.data.milestones} milestone(s) and {copy.data.templates} task template(s).
          </Alert>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <SelectField label="Copy from" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">Choose a semester…</option>
          {others.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.academic_year ? ` (${s.academic_year})` : ''}
            </option>
          ))}
        </SelectField>
        <Button
          variant="secondary"
          busy={copy.isPending}
          disabled={!from}
          onClick={() => {
            const name = others.find((s) => s.id === from)?.name;
            if (window.confirm(`Copy the setup of "${name}" into this semester?`)) copy.mutate();
          }}
        >
          Copy setup
        </Button>
      </div>
    </Card>
  );
}
