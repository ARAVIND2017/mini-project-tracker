import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { API, createUser, linkFromLatestEmail } from './helpers';

// SEC-03: password recovery. The response is the same for unknown emails, the emailed
// link works once, and a redirect to an address outside the allow-list is not followed.
// Uses the real local sign-in service and email catcher. Fictional demo accounts.
const anonKey = () => readFileSync('.local-stack/anon.jwt', 'utf8').trim();
const USER = 'demo03.reset@example.test';
const OTHER = 'demo03.redirect@example.test';
const NEW_PASSWORD = 'ResetPassword2026';

test('SEC-03 password reset', async ({ page, request, browser }) => {
  await createUser(request, USER, 'Demo Reset User');
  await createUser(request, OTHER, 'Demo Redirect User');

  await test.step('the same answer for a known and an unknown address', async () => {
    const texts: string[] = [];
    for (const email of [USER, 'nobody.at.all@example.test']) {
      await page.goto('/forgot-password');
      await page.getByLabel('Email').fill(email);
      await page.getByRole('button', { name: /reset link/i }).click();
      const status = page.getByRole('status');
      await expect(status).toContainText('If an account exists for');
      texts.push((await status.innerText()).replace(email, '<email>'));
    }
    expect(texts[0]).toBe(texts[1]);
  });

  await test.step('the emailed link sets a new password, once', async () => {
    const link = await linkFromLatestEmail(request, USER);
    await page.goto(link);
    await page.getByRole('heading', { name: 'Choose your password' }).waitFor();
    await page.getByLabel('New password').fill(NEW_PASSWORD);
    await page.getByLabel('Confirm password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Save password' }).click();
    await page.getByRole('heading', { name: /^Welcome,/ }).waitFor();

    const signIn = await request.post(`${API}/auth/v1/token?grant_type=password`, {
      headers: { apikey: anonKey() },
      data: { email: USER, password: NEW_PASSWORD },
    });
    expect(signIn.ok()).toBe(true);

    // Using the same link again does not sign anyone in.
    const fresh = await (await browser.newContext()).newPage();
    await fresh.goto(link);
    await expect(fresh.getByRole('heading', { name: 'Link expired' })).toBeVisible();
    await expect(fresh.getByRole('button', { name: 'Save password' })).toHaveCount(0);
  });

  await test.step('a redirect outside the allow-list is not followed', async () => {
    const res = await request.post(
      `${API}/auth/v1/recover?redirect_to=${encodeURIComponent('https://evil.example.test/steal')}`,
      { headers: { apikey: anonKey() }, data: { email: OTHER } },
    );
    expect(res.ok()).toBe(true);
    const link = await linkFromLatestEmail(request, OTHER);
    const verify = await request.get(link, { maxRedirects: 0 });
    const location = verify.headers()['location'] ?? '';
    expect(location).not.toContain('evil.example.test');
    expect(location.startsWith('http://localhost:5173')).toBe(true);
  });
});
