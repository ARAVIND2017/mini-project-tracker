import { Outlet } from 'react-router';
import { AuthProvider } from '@/features/auth/AuthProvider';

/** Provides auth to every route (it needs the router for navigation). */
export function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
