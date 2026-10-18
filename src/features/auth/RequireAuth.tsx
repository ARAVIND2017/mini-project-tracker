import { Navigate, Outlet, useLocation } from 'react-router';
import { Alert, Button, LoadingState } from '@/components/ui';
import { useAuth } from './authContext';
import { AuthLayout } from './AuthLayout';

/** UI gate only: hides screens from signed-out users. The database enforces access. */
export function RequireAuth() {
  const { loading, session, context, inactive, contextError, signOut } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (inactive) {
    return (
      <AuthLayout title="Account deactivated">
        <Alert tone="error">
          This account has been deactivated. Contact the HOD if you think this is a mistake.
        </Alert>
        <Button variant="secondary" className="mt-4 w-full" onClick={signOut}>
          Sign out
        </Button>
      </AuthLayout>
    );
  }
  if (contextError || !context) {
    return (
      <AuthLayout title="Something went wrong">
        <Alert tone="error">
          {contextError?.message ?? 'Your account details could not be loaded.'}
        </Alert>
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      </AuthLayout>
    );
  }
  return <Outlet />;
}
