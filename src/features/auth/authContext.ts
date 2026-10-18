import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import type { ActiveContext } from '@/domain/context';

export interface AuthState {
  /** True until the stored session has been read. */
  loading: boolean;
  session: Session | null;
  /** The signed-in user's roles and semesters; null while loading or signed out. */
  context: ActiveContext | null;
  /** Signed in, but the account has been deactivated. */
  inactive: boolean;
  contextError: Error | null;
  refreshContext: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** For screens that are only rendered inside RequireAuth. */
export function useActiveContext(): ActiveContext {
  const { context } = useAuth();
  if (!context) throw new Error('useActiveContext used outside an authenticated route');
  return context;
}
