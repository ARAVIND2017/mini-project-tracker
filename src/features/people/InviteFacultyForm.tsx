import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Alert, Button, Card, SelectField, TextField } from '@/components/ui';
import { inviteFaculty } from '@/lib/api';

const schema = z.object({
  email: z.email('Enter a valid email'),
  fullName: z.string().trim().min(1, 'Required').max(120),
  designation: z.string().trim().max(80),
  role: z.enum(['faculty', 'lead_faculty']),
});

interface Props {
  semesterId: string;
  canAppointLead: boolean;
  onInvited: () => Promise<void>;
}

export function InviteFacultyForm({ semesterId, canAppointLead, onInvited }: Props) {
  const [values, setValues] = useState({
    email: '',
    fullName: '',
    designation: '',
    role: 'faculty' as 'faculty' | 'lead_faculty',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues)
        next[issue.path[0] as keyof typeof values] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    setResult(null);
    try {
      await inviteFaculty({ ...parsed.data, semesterId });
      setResult({ tone: 'success', text: `Invitation sent to ${parsed.data.email}.` });
      setValues({ email: '', fullName: '', designation: '', role: 'faculty' });
      await onInvited();
    } catch (err) {
      setResult({
        tone: 'error',
        text: err instanceof Error ? err.message : 'The invitation could not be sent.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Invite faculty">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {result && (
          <div className="sm:col-span-2">
            <Alert tone={result.tone}>{result.text}</Alert>
          </div>
        )}
        <TextField
          label="Full name"
          value={values.fullName}
          error={errors.fullName}
          onChange={(e) => setValues({ ...values, fullName: e.target.value })}
        />
        <TextField
          label="Email"
          type="email"
          value={values.email}
          error={errors.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
        <TextField
          label="Designation (optional)"
          placeholder="e.g. Assistant Professor"
          value={values.designation}
          error={errors.designation}
          onChange={(e) => setValues({ ...values, designation: e.target.value })}
        />
        <SelectField
          label="Role in this semester"
          value={values.role}
          onChange={(e) =>
            setValues({ ...values, role: e.target.value as 'faculty' | 'lead_faculty' })
          }
          hint={
            canAppointLead
              ? 'Appointing a new lead makes the current lead a faculty member.'
              : 'Only the HOD can appoint the lead.'
          }
        >
          <option value="faculty">Faculty</option>
          {canAppointLead && <option value="lead_faculty">Lead faculty</option>}
        </SelectField>
        <div className="sm:col-span-2">
          <Button type="submit" busy={busy}>
            Send invitation
          </Button>
        </div>
      </form>
    </Card>
  );
}
