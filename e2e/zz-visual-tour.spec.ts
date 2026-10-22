/// <reference lib="dom" />
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { signIn, sql, sqlAs } from './helpers';

// Visual QA tour (run with VISUAL_TOUR=1 after the journeys have seeded the LOCAL stack).
// Opens every main screen as each role at desktop, tablet and phone widths, takes
// screenshots, and records console errors, page errors, failed requests and horizontal
// overflow into <VISUAL_OUT>/report.json, plus axe colour-contrast failures (so a dark-mode
// run, PW_COLOR_SCHEME=dark, checks contrast on every screen). Local fictional demo data only.
test.skip(!process.env.VISUAL_TOUR, 'visual tour only on request (VISUAL_TOUR=1)');
test.setTimeout(15 * 60_000);

const OUT = process.env.VISUAL_OUT ?? 'test-results/visual';
const WIDTHS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
] as const;

interface Finding {
  screen: string;
  width: string;
  kind: 'console' | 'pageerror' | 'request' | 'overflow' | 'blank' | 'contrast';
  detail: string;
}
const findings: Finding[] = [];
const screens: { screen: string; role: string; path: string }[] = [];

async function visit(page: Page, role: string, screen: string, path: string) {
  screens.push({ screen, role, path });
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w.width, height: w.height });
    const errors: string[] = [];
    const failed: string[] = [];
    const onConsole = (m: { type: () => string; text: () => string }) => {
      if (m.type() === 'error') errors.push(m.text());
    };
    const onPageError = (e: Error) => errors.push(`pageerror: ${e.message}`);
    const onResponse = (r: {
      status: () => number;
      url: () => string;
      request: () => { method: () => string };
    }) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    };
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('response', onResponse);
    await page.goto(path);
    await expect(page.getByText(/Loading/))
      .toHaveCount(0, { timeout: 15_000 })
      .catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      text: document.body.innerText.trim().length,
      offenders: [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .filter((el) => !el.closest('[data-scroll-x]') && getComputedStyle(el).position !== 'fixed')
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`),
    }));
    const contrast = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
    for (const e of errors)
      findings.push({
        screen,
        width: w.name,
        kind: e.startsWith('pageerror') ? 'pageerror' : 'console',
        detail: e,
      });
    for (const f of failed) findings.push({ screen, width: w.name, kind: 'request', detail: f });
    if (state.overflow > 1)
      findings.push({
        screen,
        width: w.name,
        kind: 'overflow',
        detail: `${state.overflow}px: ${state.offenders.join(', ')}`,
      });
    for (const v of contrast.violations)
      for (const n of v.nodes)
        findings.push({
          screen,
          width: w.name,
          kind: 'contrast',
          detail: `${n.target.join(' ')}: ${n.any[0]?.message ?? v.help}`,
        });
    if (state.text < 20)
      findings.push({ screen, width: w.name, kind: 'blank', detail: `${state.text} characters` });
    const file = `${screen.toLowerCase().replace(/[^a-z0-9]+/g, '-')}--${w.name}.png`;
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  }
}

async function as(browser: Browser, email: string | null) {
  const page = await (await browser.newContext()).newPage();
  if (email) await signIn(page, email);
  return page;
}

test('visual tour of every screen and role', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const sem7 = sql("select id from public.semesters where name = 'Demo Semester (Phase 7)'");
  const sem6 = sql("select id from public.semesters where name = 'Demo Semester (Phase 6)'");
  const p301 = sql(
    `select p.id from public.projects p join public.students s on s.id = p.student_id where s.semester_id = '${sem7}' and s.slot_no = 1`,
  );
  const p6 = sql(
    "select p.id from public.projects p join public.students s on s.id = p.student_id join public.semesters se on se.id = s.semester_id where se.name = 'Demo Semester (Phase 6)' and s.user_id is not null limit 1",
  );
  const p302 = sql(
    `select p.id from public.projects p join public.students s on s.id = p.student_id where s.semester_id = '${sem7}' and s.slot_no = 2`,
  );
  expect(sem7 && sem6 && p301 && p6 && p302).toBeTruthy();
  // A long title (local fixture) to check that long text wraps instead of breaking layouts.
  sqlAs(
    'demo7.student@example.test',
    `select public.app_set_project_title('${p301}', 'Energy-efficient federated learning for low-power edge devices in rural healthcare monitoring: a reproducibility study of the original benchmark with extended evaluation')`,
  );

  const anon = await as(browser, null);
  await visit(anon, 'signed out', 'Sign in', '/login');
  await visit(anon, 'signed out', 'Forgot password', '/forgot-password');
  await visit(anon, 'signed out', 'Set password (no link)', '/auth/set-password');
  await visit(anon, 'signed out', 'System status', '/status');
  await visit(anon, 'signed out', 'Unknown page', '/no-such-page');

  const hod = await as(browser, 'demo.hod@example.test');
  await visit(hod, 'HOD', 'HOD home', '/');
  await visit(hod, 'HOD', 'Semesters', '/semesters');
  await visit(hod, 'HOD', 'HOD dashboard', `/semesters/${sem7}`);
  for (const [name, sub] of [
    ['Projects', 'projects'],
    ['Projects filtered (overdue)', 'projects?flag=overdue'],
    ['Review queue', 'review-queue'],
    ['Assignments', 'assignments'],
    ['Roster', 'roster'],
    ['Plan', 'plan'],
    ['Panels', 'panels'],
    ['Meetings', 'meetings'],
    ['Domains', 'domains'],
    ['People and roles', 'people'],
    ['Audit log', 'audit'],
  ] as const) {
    await visit(hod, 'HOD', name, `/semesters/${sem7}/${sub}`);
  }
  await visit(hod, 'HOD', 'Notifications', '/notifications');
  await visit(hod, 'HOD', 'Project overview (stage S1)', `/projects/${p301}`);
  await visit(hod, 'HOD', 'Weekly tasks (faculty view)', `/projects/${p301}?view=tasks`);

  // Phone navigation drawer and the account menu: open, screenshot, close by keyboard.
  await hod.setViewportSize({ width: 390, height: 844 });
  await hod.goto(`/semesters/${sem7}`);
  await hod.getByRole('button', { name: 'Open navigation' }).click();
  const drawer = hod.getByRole('dialog', { name: 'Navigation' });
  await expect(drawer.getByRole('link', { name: 'Review queue' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Close navigation' })).toBeFocused();
  await hod.screenshot({ path: `${OUT}/navigation-drawer--phone.png` });
  await hod.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(hod.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await hod.setViewportSize({ width: 1440, height: 900 });
  await hod.getByRole('button', { name: /Demo HOD/ }).click();
  await expect(hod.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await hod.screenshot({ path: `${OUT}/account-menu--desktop.png` });
  await hod.keyboard.press('Escape');
  await expect(hod.getByRole('button', { name: 'Sign out' })).toHaveCount(0);

  const lead = await as(browser, 'demo7.lead@example.test');
  await visit(lead, 'Lead', 'Lead dashboard', `/semesters/${sem7}`);

  const guide = await as(browser, 'demo7.guide@example.test');
  await visit(guide, 'Faculty', 'Faculty dashboard', `/semesters/${sem7}`);
  await visit(guide, 'Faculty', 'Faculty review queue', `/semesters/${sem7}/review-queue`);

  const panel = await as(browser, 'demo6.guide@example.test');
  for (const stage of [
    'paper_selection',
    'paper_analysis',
    'code_execution',
    'objectives',
    'implementation',
    'evaluation',
    'paper_writing',
    'final',
  ])
    await visit(panel, 'Faculty', `Completed project: ${stage}`, `/projects/${p6}?stage=${stage}`);
  await visit(panel, 'Faculty', 'Final semester dashboard', `/semesters/${sem6}`);

  const student = await as(browser, 'demo7.student@example.test');
  await visit(student, 'Student', 'Student home', '/');
  await visit(student, 'Student', 'Student research stages', `/projects/${p301}`);
  await visit(student, 'Student', 'Student weekly tasks', `/projects/${p301}?view=tasks`);
  await visit(student, 'Student', 'Student opens another project', `/projects/${p302}`);
  await visit(
    student,
    'Student',
    'Student opens roster (faculty only)',
    `/semesters/${sem7}/roster`,
  );

  // Browser back/forward keeps the app working.
  await student.goto('/');
  await student.goto(`/projects/${p301}?view=tasks`);
  await student.goBack();
  await expect(student.getByRole('heading', { name: /^Welcome,/ })).toBeVisible();
  await student.goForward();
  await expect(student).toHaveURL(/view=tasks/);

  // States that a plain page visit does not show: empty list, form error, keyboard focus,
  // loading placeholder.
  await visit(student, 'Student', 'Student notifications', '/notifications');
  for (const w of [WIDTHS[0], WIDTHS[2]]) {
    await anon.setViewportSize({ width: w.width, height: w.height });
    await anon.goto('/login');
    await anon.getByLabel('Email').fill('demo.hod@example.test');
    await anon.getByLabel('Password').fill('not-the-password');
    await anon.getByRole('button', { name: 'Sign in' }).click();
    await expect(anon.getByRole('alert')).toBeVisible();
    await anon.screenshot({ path: `${OUT}/state-sign-in-error--${w.name}.png` });
  }
  await hod.setViewportSize({ width: 1440, height: 900 });
  await hod.goto(`/semesters/${sem7}/projects`);
  await expect(hod.getByText(/Loading/)).toHaveCount(0);
  // The skip link is only visible when focused, so check its contrast then.
  await hod.keyboard.press('Tab');
  await expect(hod.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  const skip = await new AxeBuilder({ page: hod })
    .include('a[href="#main"]')
    .withRules(['color-contrast'])
    .analyze();
  expect(skip.violations).toEqual([]);
  await hod.screenshot({
    path: `${OUT}/state-skip-link--desktop.png`,
    clip: { x: 0, y: 0, width: 600, height: 140 },
  });
  for (let i = 0; i < 3; i++) await hod.keyboard.press('Tab');
  await hod.screenshot({ path: `${OUT}/state-keyboard-focus--desktop.png` });
  await hod.getByRole('combobox').first().focus();
  await hod.screenshot({ path: `${OUT}/state-input-focus--desktop.png` });
  const slow = await (await browser.newContext()).newPage();
  await signIn(slow, 'demo7.student@example.test');
  await slow.route('**/rest/v1/**', async (r) => {
    await new Promise((res) => setTimeout(res, 4000));
    await r.continue().catch(() => {});
  });
  await slow.goto(`/projects/${p301}`);
  await expect(slow.getByText('Loading…').first()).toBeAttached();
  await slow.screenshot({ path: `${OUT}/state-loading--desktop.png` });
  await slow.unrouteAll({ behavior: 'ignoreErrors' });

  writeFileSync(`${OUT}/report.json`, JSON.stringify({ screens, findings }, null, 2));
  console.log(
    `visual tour: ${screens.length} screens × ${WIDTHS.length} widths, ${findings.length} finding(s)`,
  );
});
