import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { envResult } from './env';

/** Null when the environment is not configured; the UI shows a configuration notice instead. */
export const supabase: SupabaseClient | null = envResult.ok
  ? createClient(envResult.env.supabaseUrl, envResult.env.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export type ConnectionStatus =
  { state: 'not_configured' } | { state: 'ok' } | { state: 'error'; message: string };

/** Calls the public Auth health endpoint; does not read any data. */
export async function checkConnection(fetchImpl: typeof fetch = fetch): Promise<ConnectionStatus> {
  if (!envResult.ok) return { state: 'not_configured' };
  const { supabaseUrl, supabasePublishableKey } = envResult.env;
  try {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: supabasePublishableKey },
    });
    return res.ok ? { state: 'ok' } : { state: 'error', message: `HTTP ${res.status}` };
  } catch {
    return { state: 'error', message: 'Network error — the Supabase project could not be reached' };
  }
}
