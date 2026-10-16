import { parseEnv } from './env';

const publishable = 'sb_publishable_abcdefghijklmnopqrstuvwxyz';

describe('parseEnv', () => {
  it('accepts a valid URL and publishable key, trimming trailing slashes', () => {
    const result = parseEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co/',
      VITE_SUPABASE_PUBLISHABLE_KEY: publishable,
    });
    expect(result).toEqual({
      ok: true,
      env: { supabaseUrl: 'https://abc.supabase.co', supabasePublishableKey: publishable },
    });
  });

  it('reports missing values instead of throwing', () => {
    const result = parseEnv({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems).toHaveLength(2);
  });

  it('rejects a secret key so it can never be bundled into the browser app', () => {
    const result = parseEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a legacy service_role JWT', () => {
    const payload = btoa(JSON.stringify({ role: 'service_role' })).replace(/=+$/, '');
    const result = parseEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`,
    });
    expect(result.ok).toBe(false);
  });

  it('accepts a legacy anon JWT', () => {
    const payload = btoa(JSON.stringify({ role: 'anon' })).replace(/=+$/, '');
    const result = parseEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`,
    });
    expect(result.ok).toBe(true);
  });
});
