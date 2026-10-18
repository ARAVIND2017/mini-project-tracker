import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert, Button, LoadingState, TextField } from '@/components/ui';
import { newPasswordSchema } from '@/domain/password';
import { supabase } from '@/lib/supabase';
import { useAuth } from './authContext';
import { AuthLayout } from './AuthLayout';

/** Landing page for invitation and password-reset links (both arrive signed in). */
export function SetPasswordPage() {
  const { session, loading, refreshContext } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingState />;

  if (!session) {
    return (
      <AuthLayout title="Link expired">
        <Alert tone="error">
          This link is invalid or has expired. Links work once and only for a short time.
        </Alert>
        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="text-blue-700 underline dark:text-blue-300">
            Request a new link
          </Link>
        </p>
      </AuthLayout>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as 'password' | 'confirm';
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setFailure(
        /different from the old/i.test(error.message)
          ? 'Choose a password different from your previous one.'
          : 'The password could not be saved. Request a new link and try again.',
      );
      return;
    }
    await refreshContext();
    navigate('/', { replace: true });
  }

  return (
    <AuthLayout title="Choose your password">
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        Signed in as <strong>{session.user.email}</strong>.
      </p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {failure && <Alert tone="error">{failure}</Alert>}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters, with letters and digits."
          error={errors.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button type="submit" busy={busy} className="w-full">
          Save password
        </Button>
      </form>
    </AuthLayout>
  );
}
