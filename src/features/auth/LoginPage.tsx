import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Alert, Button, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from './authContext';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={from} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      // Same message for unknown email and wrong password.
      setError(
        /banned/i.test(signInError.message)
          ? 'This account has been deactivated. Contact the HOD.'
          : 'Email or password is incorrect.',
      );
      return;
    }
    navigate(from, { replace: true });
  }

  return (
    <AuthLayout title="Sign in">
      {!supabase && <Alert tone="error">The app is not configured. See System status.</Alert>}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          type="submit"
          busy={busy}
          className="w-full"
          disabled={!email || !password || !supabase}
        >
          Sign in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/forgot-password" className="text-blue-700 underline dark:text-blue-300">
          Forgot password?
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
        Accounts are created by the HOD. Check your email for an invitation.
      </p>
    </AuthLayout>
  );
}
