import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { envResult } from './env';

export type AppSupabaseClient = SupabaseClient<Database>;

/**
 * Type of the Supabase auth link the app was opened with ("invite", "recovery", …).
 * Read before the client starts, because supabase-js removes the tokens from the URL.
 * Invitations sent from the Supabase dashboard land on the Site URL, not on
 * /auth/set-password, so the app routes them there itself.
 */
export const initialAuthLinkType: string | null =
  typeof window === 'undefined'
    ? null
    : (new URLSearchParams(window.location.hash.slice(1)).get('type') ??
      new URLSearchParams(window.location.search).get('type'));

/** Null when the environment is not configured; the UI shows a configuration notice instead. */
export const supabase: AppSupabaseClient | null = envResult.ok
  ? createClient<Database>(envResult.env.supabaseUrl, envResult.env.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function requireSupabase(): AppSupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

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
