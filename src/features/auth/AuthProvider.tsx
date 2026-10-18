import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { fetchMyContext } from '@/lib/api';
import { initialAuthLinkType, supabase } from '@/lib/supabase';
import { AuthContext, type AuthState } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      // Opened from an invitation or reset link: the user must choose a password first.
      if (
        data.session &&
        (initialAuthLinkType === 'invite' || initialAuthLinkType === 'recovery')
      ) {
        navigate('/auth/set-password', { replace: true });
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_OUT') queryClient.clear();
      // Recovery links sign the user in; send them to choose a new password.
      if (event === 'PASSWORD_RECOVERY') navigate('/auth/set-password', { replace: true });
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate, queryClient]);

  const userId = session?.user.id ?? null;
  const contextQuery = useQuery({
    queryKey: ['my-context', userId],
    queryFn: fetchMyContext,
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const refreshContext = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['my-context'] });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = useMemo<AuthState>(() => {
    const data = contextQuery.data;
    return {
      loading: loading || (Boolean(userId) && contextQuery.isPending),
      session,
      context: data?.active ? data : null,
      inactive: data?.active === false,
      contextError: contextQuery.error,
      refreshContext,
      signOut,
    };
  }, [
    loading,
    userId,
    contextQuery.data,
    contextQuery.isPending,
    contextQuery.error,
    session,
    refreshContext,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
