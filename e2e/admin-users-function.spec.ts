import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { API, createUser, PASSWORD, sql } from './helpers';

// SEC-14: the admin-users Edge Function (invites, deactivation) refuses requests without
// a valid user token, and callers who are not the HOD or an admin with the permission.
// Calls the real function on the local stack. No invitation is sent: the HOD's request
// uses an invalid email, so it stops at validation, after the permission check.
const anonKey = () => readFileSync('.local-stack/anon.jwt', 'utf8').trim();
const FN = `${API}/functions/v1/admin-users`;

async function tokenFor(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey() },
    data: { email, password: PASSWORD },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return ((await res.json()) as { access_token: string }).access_token;
}

const call = (request: APIRequestContext, token: string | null, body: unknown) =>
  request.post(FN, {
    headers: { apikey: anonKey(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    data: body,
  });

test('SEC-14 the admin-users function checks the caller', async ({ request }) => {
  await createUser(request, 'demo.hod@example.test', 'Demo HOD');
  await createUser(request, 'demo14.faculty@example.test', 'Demo Faculty (SEC-14)');
  await createUser(request, 'demo14.student@example.test', 'Demo Student (SEC-14)');
  if (
    sql("select count(*) from public.system_roles where role = 'hod' and revoked_at is null") ===
    '0'
  ) {
    sql("select app.bootstrap_hod('demo.hod@example.test')");
  }
  const invite = {
    action: 'invite_faculty',
    email: 'not-an-email',
    full_name: 'Nobody',
    semester_id: '00000000-0000-0000-0000-000000000000',
    role: 'faculty',
  };

  const noToken = await call(request, null, invite);
  expect(noToken.status()).toBe(401);

  // The public (anon) key is not a user.
  const anonOnly = await call(request, anonKey(), invite);
  expect(anonOnly.status()).toBe(401);

  for (const email of ['demo14.student@example.test', 'demo14.faculty@example.test']) {
    const res = await call(request, await tokenFor(request, email), invite);
    expect(res.status(), email).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe('FORBIDDEN');
    const deactivate = await call(request, await tokenFor(request, email), {
      action: 'deactivate_user',
      user_id: sql("select id from auth.users where email = 'demo.hod@example.test'"),
      reason: 'Should never work',
    });
    expect(deactivate.status(), email).toBe(403);
  }

  // The HOD gets past the permission check (and is stopped by validation instead).
  const hod = await call(request, await tokenFor(request, 'demo.hod@example.test'), invite);
  expect(hod.status()).toBe(400);
  expect(await hod.json()).toMatchObject({ code: 'VALIDATION', message: 'email is not valid' });

  // Errors carry a code and a plain message only (SEC-13).
  expect(Object.keys(await noToken.json()).sort()).toEqual(['code', 'message']);
});
