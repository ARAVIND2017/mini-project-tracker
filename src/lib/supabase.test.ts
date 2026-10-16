import { vi } from 'vitest';

vi.mock('./env', () => ({
  envResult: {
    ok: true,
    env: { supabaseUrl: 'https://abc.supabase.co', supabasePublishableKey: 'sb_publishable_x' },
  },
}));

const { checkConnection } = await import('./supabase');

describe('checkConnection', () => {
  it('calls the auth health endpoint with the publishable key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await expect(checkConnection(fetchMock)).resolves.toEqual({ state: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('https://abc.supabase.co/auth/v1/health', {
      headers: { apikey: 'sb_publishable_x' },
    });
  });

  it('reports HTTP errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    await expect(checkConnection(fetchMock)).resolves.toEqual({
      state: 'error',
      message: 'HTTP 503',
    });
  });

  it('reports network failures without leaking details', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('getaddrinfo ENOTFOUND internal'));
    const result = await checkConnection(fetchMock);
    expect(result.state).toBe('error');
    expect(JSON.stringify(result)).not.toContain('ENOTFOUND');
  });
});
