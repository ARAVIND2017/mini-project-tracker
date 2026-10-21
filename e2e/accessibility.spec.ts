/// <reference lib="dom" />
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { createUser, PASSWORD, signIn, sql, sqlAs } from './helpers';

// TEST_PLAN.md §5: axe-core (WCAG 2.1 A and AA) on every main screen, and a keyboard-only
// run through the weekly-task submission. Run on a freshly reset local stack. Every
// person and link here is fictional demo data.
const HOD = 'demo.hod@example.test';
const LEAD = 'demoa.lead@example.test';
const GUIDE = 'demoa.guide@example.test';
const STUDENT = 'demoa.student@example.test';
const SEMESTER = 'Demo Semester (Accessibility)';
const sem = `(select id from public.semesters where name = '${SEMESTER}')`;
const uid = (email: string) => `(select id from auth.users where email = '${email}')`;
const REPORT =
  'This week I explored the demo domain, listed candidate topics and keywords, and searched ' +
  'two digital libraries. Next week I will choose a paper.';

const findings: {
  screen: string;
  id: string;
  impact: string | null | undefined;
  nodes: number;
  help: string;
}[] = [];

async function audit(page: Page, screen: string) {
  // Wait for data to load before scanning.
  await expect(page.getByText('Loading…')).toHaveCount(0);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  for (const v of result.violations) {
    findings.push({ screen, id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help });
  }
  return result.violations;
}

test('accessibility: axe on every main screen, and a keyboard-only task submission', async ({
  browser,
  request,
}) => {
  let projectId = '';
  let semesterId = '';

  await test.step('seed', async () => {
    await createUser(request, HOD, 'Demo HOD');
    await createUser(request, LEAD, 'Demo Lead (A11y)');
    await createUser(request, GUIDE, 'Demo Guide (A11y)');
    await createUser(request, STUDENT, 'Demo Student 401');
    if (
      sql("select count(*) from public.system_roles where role = 'hod' and revoked_at is null") ===
      '0'
    ) {
      sql(`select app.bootstrap_hod('${HOD}')`);
    }
    sqlAs(
      HOD,
      `select public.app_create_semester('${SEMESTER}', '2026-27',
         jsonb_build_object('start_date', current_date - 8, 'max_students', 5))`,
    );
    sqlAs(HOD, `select public.app_set_lead(${sem}, ${uid(LEAD)})`);
    sqlAs(HOD, `select public.app_set_membership(${sem}, ${uid(GUIDE)}, 'faculty')`);
    sqlAs(HOD, `select public.app_upsert_domain(${sem}, 'Machine Learning')`);
    sqlAs(
      HOD,
      `select public.app_import_roster(${sem}, '[
         {"slot_no": 1, "institution_id": "DEMO401", "full_name": "Demo Student 401", "email": "${STUDENT}", "domain_name": "Machine Learning"},
         {"slot_no": 2, "institution_id": "DEMO402", "full_name": "Demo Student 402", "domain_name": "Machine Learning"}
       ]'::jsonb, false)`,
    );
    sqlAs(
      HOD,
      `select public.app_link_student((select id from public.students where semester_id = ${sem} and slot_no = 1), ${uid(STUDENT)})`,
    );
    sqlAs(HOD, `select public.app_activate_semester(${sem})`);
    semesterId = sql(`select ${sem}`);
    projectId = sql(
      `select p.id from public.projects p join public.students s on s.id = p.student_id
       where s.semester_id = ${sem} and s.slot_no = 1`,
    );
    sqlAs(HOD, `select public.app_assign_guide('${projectId}', ${uid(GUIDE)})`);
    const week1 = sql(
      `select id from public.tasks where project_id = '${projectId}' and week_no = 1 limit 1`,
    );
    sqlAs(STUDENT, `select public.app_start_task('${week1}')`);
    const sub = sqlAs(
      STUDENT,
      `select public.app_submit_task('${week1}', '${REPORT}',
         '[{"category": "other", "url": "https://drive.example.test/a11y", "description": "Search notes for week 1"}]')`,
    );
    sqlAs(
      GUIDE,
      `select public.app_record_review('task_submission', '${sub}', 'changes_requested',
         'Widen the search.', null, array['Add two more digital libraries'])`,
    );
  });

  await test.step('signed-out screens', async () => {
    const page = await (await browser.newContext()).newPage();
    for (const [path, name] of [
      ['/login', 'Sign in'],
      ['/forgot-password', 'Forgot password'],
      ['/status', 'System status'],
    ] as const) {
      await page.goto(path);
      await audit(page, name);
    }
  });

  await test.step('HOD screens', async () => {
    const page = await (await browser.newContext()).newPage();
    await signIn(page, HOD);
    await audit(page, 'HOD home');
    const screens: [string, string][] = [
      ['/semesters', 'Semesters'],
      [`/semesters/${semesterId}`, 'Semester overview and dashboard'],
      [`/semesters/${semesterId}/projects`, 'Projects'],
      [`/semesters/${semesterId}/review-queue`, 'Review queue'],
      [`/semesters/${semesterId}/assignments`, 'Assignments'],
      [`/semesters/${semesterId}/roster`, 'Roster'],
      [`/semesters/${semesterId}/plan`, 'Plan'],
      [`/semesters/${semesterId}/panels`, 'Panels'],
      [`/semesters/${semesterId}/meetings`, 'Meetings'],
      [`/semesters/${semesterId}/domains`, 'Domains'],
      [`/semesters/${semesterId}/people`, 'People & roles'],
      [`/semesters/${semesterId}/audit`, 'Audit log'],
      ['/notifications', 'Notifications'],
    ];
    for (const [path, name] of screens) {
      await page.goto(path);
      await audit(page, name);
    }
  });

  await test.step('guide screens', async () => {
    const page = await (await browser.newContext()).newPage();
    await signIn(page, GUIDE);
    await page.goto(`/semesters/${semesterId}`);
    await audit(page, 'Faculty dashboard');
    for (const stage of [
      'exploration',
      'paper_selection',
      'code_execution',
      'objectives',
      'evaluation',
      'paper_writing',
      'final',
    ]) {
      await page.goto(`/projects/${projectId}?stage=${stage}`);
      await audit(page, `Project page (${stage}), as guide`);
    }
    await page.goto(`/projects/${projectId}?view=tasks`);
    await audit(page, 'Weekly tasks, as guide');
  });

  await test.step('student screens', async () => {
    const page = await (await browser.newContext()).newPage();
    await signIn(page, STUDENT);
    await audit(page, 'Student home');
    await page.goto(`/projects/${projectId}?view=tasks`);
    await audit(page, 'Weekly tasks, as student');
  });

  await test.step('keyboard only: sign in and submit week 2', async () => {
    const page = await (await browser.newContext()).newPage();
    await page.goto('/login');
    const tabTo = async (match: (el: { tag: string; name: string }) => boolean, limit = 80) => {
      for (let i = 0; i < limit; i++) {
        await page.keyboard.press('Tab');
        const el = await page.evaluate(() => {
          const a = document.activeElement as HTMLElement | null;
          const label =
            (a?.getAttribute('aria-label') ??
              (a?.id ? document.querySelector(`label[for="${a.id}"]`)?.textContent : null) ??
              a?.textContent ??
              '') ||
            '';
          return { tag: a?.tagName.toLowerCase() ?? '', name: label.trim() };
        });
        if (match(el)) return el;
      }
      throw new Error('Could not reach the control with the keyboard');
    };
    await tabTo((e) => e.tag === 'input' && /Email/.test(e.name));
    await page.keyboard.type(STUDENT);
    await tabTo((e) => e.tag === 'input' && /Password/.test(e.name));
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: /^Welcome,/ }).waitFor();

    await tabTo((e) => e.tag === 'a' && e.name === 'My weekly tasks');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/view=tasks/);
    await tabTo((e) => e.tag === 'button' && /Select a research paper/.test(e.name), 200);
    await page.keyboard.press('Enter');
    await tabTo((e) => e.tag === 'button' && e.name === 'Start this task', 60);
    await page.keyboard.press('Enter');
    await tabTo((e) => e.tag === 'textarea' && /Progress report/.test(e.name), 60);
    await page.keyboard.type(REPORT);
    await tabTo((e) => e.tag === 'input' && e.name === 'Link 1', 20);
    await page.keyboard.type('https://drive.example.test/a11y-week2');
    await tabTo((e) => e.tag === 'input' && e.name === 'Link 1 description', 5);
    await page.keyboard.type('Paper shortlist for week 2');
    await tabTo((e) => e.tag === 'button' && e.name === 'Submit for review', 20);
    // The focused control shows a visible focus indicator.
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement as Element).outlineStyle,
    );
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/submitted/i).first()).toBeVisible();
    expect(
      sql(
        `select count(*) from public.submissions s join public.tasks k on k.id = s.task_id
         where k.project_id = '${projectId}' and k.week_no = 2`,
      ),
    ).toBe('1');
  });

  writeFileSync('test-results/accessibility.json', JSON.stringify(findings, null, 2));
  const serious = findings.filter((f) => f.impact === 'serious' || f.impact === 'critical');
  expect(findings.map((f) => `${f.screen}: ${f.id} (${f.impact}, ${f.nodes}) ${f.help}`)).toEqual(
    [],
  );
  expect(serious).toEqual([]);
});
