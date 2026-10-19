import { expect, test, type Page } from '@playwright/test';
import { createUser, screenshotAs, signIn, sql, sqlAs } from './helpers';
import { addressCorrection, review, verifyCorrection } from './review';

// TEST_PLAN.md journeys 4 (weekly loop) and 5 (cross-review), Phase 5. Run on a freshly
// reset local stack. Every person and link here is fictional demo data.
const HOD = 'demo.hod@example.test';
const LEAD = 'demo5.lead@example.test';
const GUIDE = 'demo5.guide@example.test';
const OTHER = 'demo5.faculty@example.test';
const STUDENT = 'demo5.student@example.test';
const SEMESTER = 'Demo Semester (Phase 5)';
const sem = `(select id from public.semesters where name = '${SEMESTER}')`;
const uid = (email: string) => `(select id from auth.users where email = '${email}')`;

const REPORT =
  'This week I explored the demo domain, listed candidate topics and keywords, and searched ' +
  'two digital libraries. Next week I will choose a paper.';

const taskButton = (page: Page, title: RegExp) =>
  page.getByRole('button', { name: title, expanded: undefined });

async function submit(page: Page, label: 'Submit for review' | 'Resubmit', link: string) {
  const form = page.getByRole('form', { name: /^(Submit|Resubmit) the task$/ });
  await form.getByLabel('Progress report').fill(REPORT);
  await form.getByLabel('Link 1', { exact: true }).fill(link);
  await form.getByLabel('Link 1 description').fill('Search notes in my Drive folder');
  await form.getByRole('button', { name: label }).click();
}

test('weekly loop and cross-review (journeys 4 and 5)', async ({ browser, request }) => {
  let projectId = '';
  let semesterId = '';

  await test.step('seed: semester starting today, faculty, one student with a guide', async () => {
    await createUser(request, HOD, 'Demo HOD');
    await createUser(request, LEAD, 'Demo Lead (P5)');
    await createUser(request, GUIDE, 'Demo Guide (P5)');
    await createUser(request, OTHER, 'Demo Faculty (P5)');
    await createUser(request, STUDENT, 'Demo Student 201');
    if (
      sql("select count(*) from public.system_roles where role = 'hod' and revoked_at is null") ===
      '0'
    ) {
      sql(`select app.bootstrap_hod('${HOD}')`);
    }
    sqlAs(
      HOD,
      `select public.app_create_semester('${SEMESTER}', '2026-27',
         jsonb_build_object('start_date', current_date, 'max_students', 5))`,
    );
    sqlAs(HOD, `select public.app_set_lead(${sem}, ${uid(LEAD)})`);
    sqlAs(HOD, `select public.app_set_membership(${sem}, ${uid(GUIDE)}, 'faculty')`);
    sqlAs(HOD, `select public.app_set_membership(${sem}, ${uid(OTHER)}, 'faculty')`);
    sqlAs(HOD, `select public.app_upsert_domain(${sem}, 'Machine Learning')`);
    sqlAs(
      HOD,
      `select public.app_import_roster(${sem}, '[{"slot_no": 1, "institution_id": "DEMO201",
         "full_name": "Demo Student 201", "email": "${STUDENT}", "domain_name": "Machine Learning"}]'::jsonb, false)`,
    );
    sqlAs(
      HOD,
      `select public.app_link_student((select id from public.students where semester_id = ${sem} and slot_no = 1), ${uid(STUDENT)})`,
    );
    sqlAs(HOD, `select public.app_activate_semester(${sem})`);
    semesterId = sql(`select ${sem}`);
    projectId = sql(`select id from public.projects where semester_id = ${sem}`);
    sqlAs(HOD, `select public.app_assign_guide('${projectId}', ${uid(GUIDE)})`);
    expect(sql(`select count(*) from public.tasks where project_id = '${projectId}'`)).toBe('19');
  });

  const student = await (await browser.newContext()).newPage();
  const guide = await (await browser.newContext()).newPage();
  const other = await (await browser.newContext()).newPage();
  const openTasks = (page: Page) => page.goto(`/projects/${projectId}?view=tasks`);

  // ------------------------------------------------------------- journey 4 ------
  await test.step('the student submits week 1 on time', async () => {
    await signIn(student, STUDENT);
    await expect(student.getByText(/Week 1: Explore the assigned domain/)).toBeVisible();
    await student.getByRole('link', { name: 'My weekly tasks' }).click();
    await taskButton(student, /Explore the assigned domain/).click();
    await student.getByRole('button', { name: 'Start this task' }).click();
    await expect(student.getByText('Task started.')).toBeVisible();
    await submit(student, 'Submit for review', 'https://drive.google.com/drive/folders/demo-week1');
    await expect(student.getByText('Task submitted.')).toBeVisible();
    await expect(student.getByText('✓ On time')).toBeVisible();
    await screenshotAs(student, 'p5-01-student-submitted-week1');
  });

  await test.step('the guide finds it in the review queue and requests two corrections', async () => {
    await signIn(guide, GUIDE);
    await guide.goto(`/semesters/${semesterId}/review-queue`);
    const row = guide.getByRole('link', { name: 'Week 1: Explore the assigned domain' });
    await expect(row).toBeVisible();
    await screenshotAs(guide, 'p5-02-guide-review-queue');
    await row.click();
    await guide.getByRole('button', { name: 'Start review' }).click();
    await expect(guide.getByText('Review started.')).toBeVisible();
    await review(guide, 'Request changes', 'Good start; two things to add.', [
      'Add two more sources',
      'Link the notes for each source',
    ]);
    await expect(taskButton(guide, /Explore the assigned domain/)).toContainText(
      'Changes requested',
    );
  });

  await test.step('the deadline passes; the student addresses both corrections and resubmits late', async () => {
    sql(`update public.tasks set due_at = now() - interval '1 hour'
         where project_id = '${projectId}' and week_no = 1`);
    await openTasks(student);
    await taskButton(student, /Explore the assigned domain/).click();
    await addressCorrection(
      student,
      'Add two more sources',
      'Two more sources are listed in the notes.',
    );
    await addressCorrection(
      student,
      'Link the notes for each source',
      'Each source now links its notes.',
    );
    await expect(student.getByText(/The deadline .* has passed/)).toBeVisible();
    await submit(student, 'Resubmit', 'https://drive.google.com/drive/folders/demo-week1-v2');
    await expect(student.getByText('Task resubmitted.')).toBeVisible();
    await expect(student.getByText('✕ Late')).toBeVisible();
    await screenshotAs(student, 'p5-03-student-resubmitted-late');
  });

  await test.step('the guide verifies the corrections and the task', async () => {
    await openTasks(guide);
    await taskButton(guide, /Explore the assigned domain/).click();
    await verifyCorrection(guide, 'Add two more sources');
    await verifyCorrection(guide, 'Link the notes for each source');
    await review(guide, 'Accept', 'Week 1 verified.');
    await expect(taskButton(guide, /Explore the assigned domain/)).toContainText('Verified');
    await expect(guide.getByText(/Submissions: 1 on time, 1 late/)).toBeVisible();
    await screenshotAs(guide, 'p5-04-guide-task-verified');
  });

  // ------------------------------------------------------------- journey 5 ------
  await test.step('the student submits week 2; another faculty member can only comment', async () => {
    await openTasks(student);
    await taskButton(student, /Select a research paper/).click();
    await submit(student, 'Submit for review', 'https://drive.google.com/file/d/demo-paper-pdf');
    await expect(student.getByText('Task submitted.')).toBeVisible();

    await signIn(other, OTHER);
    await openTasks(other);
    await taskButton(other, /Select a research paper/).click();
    const form = other.getByRole('form', { name: 'Review the week 2 task' });
    await expect(form.getByRole('heading', { name: 'Comment on the week 2 task' })).toBeVisible();
    await expect(form.getByLabel('Outcome')).toHaveCount(0);
  });

  await test.step('the lead authorizes the cross-review; the review succeeds', async () => {
    sqlAs(
      LEAD,
      `select public.app_grant_review_authorization('${projectId}', ${uid(OTHER)}, now() + interval '1 day', 'Cross-review')`,
    );
    await other.goto(`/semesters/${semesterId}/review-queue`);
    await other.getByRole('tab', { name: 'Mine' }).click();
    await other.getByRole('link', { name: 'Week 2: Select a research paper' }).click();
    await review(other, 'Accept', 'Paper choice checked in the cross-review.');
    await expect(taskButton(other, /Select a research paper/)).toContainText('Verified');
    await screenshotAs(other, 'p5-05-cross-review-accepted');
  });

  await test.step('after the authorization expires, the faculty member can only comment again', async () => {
    sql(`update public.review_authorizations set valid_until = now() - interval '1 minute'
         where project_id = '${projectId}'`);
    await openTasks(student);
    await taskButton(student, /Analyse the paper/).click();
    await student
      .getByRole('form', { name: 'Submit the task' })
      .getByLabel('Progress report')
      .fill(REPORT);
    const form = student.getByRole('form', { name: 'Submit the task' });
    await form
      .getByLabel('Link 1', { exact: true })
      .fill('https://drive.google.com/file/d/demo-analysis');
    await form.getByLabel('Link 1 description').fill('Analysis notes for the paper');
    await form.getByRole('button', { name: 'Submit for review' }).click();
    await expect(student.getByText('Task submitted.')).toBeVisible();

    await openTasks(other);
    await taskButton(other, /Analyse the paper/).click();
    const review3 = other.getByRole('form', { name: 'Review the week 3 task' });
    await expect(
      review3.getByRole('heading', { name: 'Comment on the week 3 task' }),
    ).toBeVisible();
    await expect(review3.getByLabel('Outcome')).toHaveCount(0);
  });

  await test.step('the HOD sees the plan and can create missing tasks', async () => {
    const hod = await (await browser.newContext()).newPage();
    await signIn(hod, HOD);
    await hod.goto(`/semesters/${semesterId}/plan`);
    await expect(
      hod.getByRole('heading', { name: /Week 2 · Research paper selection/ }),
    ).toBeVisible();
    await hod.getByRole('button', { name: 'Create missing tasks' }).click();
    await expect(hod.getByText('0 task(s) created.')).toBeVisible();
    await screenshotAs(hod, 'p5-06-hod-semester-plan');
    expect(
      sql(`select count(*) || '/' || count(*) filter (where is_late) from public.submissions
           where project_id = '${projectId}'`),
    ).toBe('4/1');
  });
});
