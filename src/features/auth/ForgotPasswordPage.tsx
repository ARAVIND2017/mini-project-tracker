import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alert, Button, TextField } from '@/components/ui';
import { authRedirectUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    // The response is the same whether or not the email exists (SEC-03).
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl() });
    setBusy(false);
    setSent(true);
  }

  return (
    <AuthLayout title="Reset password">
      {sent ? (
        <Alert tone="success">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. The link
          works once and expires soon.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" busy={busy} className="w-full" disabled={!email || !supabase}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="text-blue-700 underline dark:text-blue-300">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
