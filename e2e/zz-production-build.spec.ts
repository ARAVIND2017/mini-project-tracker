/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { createUser, signIn, sql } from './helpers';

// Runs only against the production build served with the hosts' security headers
// (PW_BASE_URL, scripts/serve-dist.mjs): every main screen loads with no Content
// Security Policy violation, and deep links work through the single-page-app fallback.
// Named "zz-" so it runs after the journeys that create the demo data.
test.skip(!process.env.PW_BASE_URL, 'only against the production build');

test('production build: security headers and no CSP violations', async ({ page, request }) => {
  await createUser(request, 'demo.hod@example.test', 'Demo HOD');
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { cspViolations: string[] }).cspViolations.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      ),
    );
  });
  const response = await page.goto('/login');
  const headers = response?.headers() ?? {};
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['x-frame-options']).toBe('DENY');

  await signIn(page, 'demo.hod@example.test');
  const semesterId = sql('select id from public.semesters order by created_at limit 1');
  const projectId = sql(
    'select id from public.projects where guide_id is not null order by created_at limit 1',
  );
  const paths = [
    '/semesters',
    `/semesters/${semesterId}`,
    `/semesters/${semesterId}/projects?flag=overdue`,
    `/semesters/${semesterId}/review-queue`,
    `/semesters/${semesterId}/meetings`,
    `/semesters/${semesterId}/audit`,
    `/projects/${projectId}`,
    `/projects/${projectId}?view=tasks`,
    '/notifications',
  ];
  const violations: string[] = [];
  for (const path of paths) {
    // A full page load each time: deep links must work through the SPA fallback.
    await page.goto(path);
    await expect(page.getByText('Loading…')).toHaveCount(0);
    await expect(page.getByRole('heading').first()).toBeVisible();
    const found = await page.evaluate(
      () => (window as unknown as { cspViolations: string[] }).cspViolations,
    );
    violations.push(...found.map((v) => `${path}: ${v}`));
  }
  expect(violations).toEqual([]);
});
