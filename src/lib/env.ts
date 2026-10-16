import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .url({ protocol: /^https?$/, message: 'must be the Supabase project URL' })
    .transform((url) => url.replace(/\/+$/, '')),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: 'is missing — use the publishable (anon) key' })
    .min(20, 'must be the publishable (anon) key'),
});

export interface AppEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export type EnvResult = { ok: true; env: AppEnv } | { ok: false; problems: string[] };

const SECRET_KEY_PATTERN = /^sb_secret_|service_role/;

function looksLikeServiceRoleKey(key: string): boolean {
  if (SECRET_KEY_PATTERN.test(key)) return true;
  // Legacy keys are JWTs; the payload names the role.
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    return atob(payload.replace(/-/g, '+').replace(/_/g, '/')).includes('"service_role"');
  } catch {
    return false;
  }
}

export function parseEnv(raw: Record<string, unknown>): EnvResult {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`),
    };
  }
  const { VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_PUBLISHABLE_KEY: key } = parsed.data;
  if (looksLikeServiceRoleKey(key)) {
    return {
      ok: false,
      problems: [
        'VITE_SUPABASE_PUBLISHABLE_KEY is a secret/service-role key. Use the publishable key; the secret key must never be bundled into the browser app.',
      ],
    };
  }
  return { ok: true, env: { supabaseUrl, supabasePublishableKey: key } };
}

export const envResult: EnvResult = parseEnv(import.meta.env);
