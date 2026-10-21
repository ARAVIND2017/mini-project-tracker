import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createUser, screenshotAs, signIn, sql, sqlAs } from './helpers';

// Phase 7: notifications, dashboards (UI-02), progress, CSV export (FUN-17), escalation,
// meetings and the audit log. Run on a freshly reset local stack. Every person and link
// here is fictional demo data.
const HOD = 'demo.hod@example.test';
const LEAD = 'demo7.lead@example.test';
const GUIDE = 'demo7.guide@example.test';
const STUDENT = 'demo7.student@example.test';
const SEMESTER = 'Demo Semester (Phase 7)';
const sem = `(select id from public.semesters where name = '${SEMESTER}')`;
const uid = (email: string) => `(select id from auth.users where email = '${email}')`;

const REPORT =
  'This week I explored the demo domain, listed candidate topics and keywords, and searched ' +
  'two digital libraries. Next week I will choose a paper.';

test('dashboards, notifications, meetings and audit (Phase 7)', async ({ browser, request }) => {
  let projectId = '';
  let semesterId = '';

  await test.step('seed: a semester that started two weeks ago, three students', async () => {
    await createUser(request, HOD, 'Demo HOD');
    await createUser(request, LEAD, 'Demo Lead (P7)');
    await createUser(request, GUIDE, 'Demo Guide (P7)');
    await createUser(request, STUDENT, 'Demo Student 301');
    if (
      sql("select count(*) from public.system_roles where role = 'hod' and revoked_at is null") ===
      '0'
    ) {
      sql(`select app.bootstrap_hod('${HOD}')`);
    }
    sqlAs(
      HOD,
      `select public.app_create_semester('${SEMESTER}', '2026-27',
         jsonb_build_object('start_date', current_date - 15, 'max_students', 5))`,
    );
    sqlAs(HOD, `select public.app_set_lead(${sem}, ${uid(LEAD)})`);
    sqlAs(HOD, `select public.app_set_membership(${sem}, ${uid(GUIDE)}, 'faculty')`);
    sqlAs(HOD, `select public.app_upsert_domain(${sem}, 'Machine Learning')`);
    sqlAs(HOD, `select public.app_upsert_domain(${sem}, 'Web Systems')`);
    sqlAs(
      HOD,
      `select public.app_import_roster(${sem}, '[
         {"slot_no": 1, "institution_id": "DEMO301", "full_name": "Demo Student 301", "email": "${STUDENT}", "domain_name": "Machine Learning"},
         {"slot_no": 2, "institution_id": "DEMO302", "full_name": "Demo Student 302", "domain_name": "Machine Learning"},
         {"slot_no": 3, "institution_id": "DEMO303", "full_name": "Demo Student 303", "domain_name": "Web Systems"}
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
    sqlAs(
      HOD,
      `select public.app_assign_guide(p.id, ${uid(GUIDE)}) from public.projects p
       join public.students s on s.id = p.student_id where s.semester_id = ${sem} and s.slot_no in (1, 2)`,
    );
    // The student submits week 1 (late: the semester began two weeks ago); the guide
    // requests one change.
    const week1 = sql(
      `select id from public.tasks where project_id = '${projectId}' and week_no = 1 limit 1`,
    );
    sqlAs(STUDENT, `select public.app_start_task('${week1}')`);
    const sub = sqlAs(
      STUDENT,
      `select public.app_submit_task('${week1}', '${REPORT}',
         '[{"category": "other", "url": "https://drive.example.test/week1", "description": "Search notes for week 1"}]')`,
    );
    sqlAs(
      GUIDE,
      `select public.app_record_review('task_submission', '${sub}', 'changes_requested',
         'Good start; widen the search.', null, array['Add two more digital libraries'])`,
    );
  });

  const student = await (await browser.newContext()).newPage();
  const hod = await (await browser.newContext()).newPage();
  const lead = await (await browser.newContext({ acceptDownloads: true })).newPage();
  const guide = await (await browser.newContext()).newPage();

  await test.step('the student sees the review in the inbox and the dashboard', async () => {
    await signIn(student, STUDENT);
    const bell = student.getByRole('link', { name: /^Notifications, \d+ unread$/ });
    await expect(bell).toBeVisible();
    await expect(student.getByRole('region', { name: 'Latest feedback' })).toContainText(
      'Changes requested',
    );
    await expect(student.getByRole('region', { name: 'Progress' })).toContainText('0%');
    await expect(student.getByRole('region', { name: 'Timeliness' })).toContainText(
      'Submitted late',
    );
    await screenshotAs(student, 'p7-01-student-dashboard');

    await bell.click();
    await expect(student.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    const item = student.getByRole('link', {
      name: 'Your weekly task: changes requested (1 correction(s))',
    });
    await expect(item).toBeVisible();
    // A deadline reminder is added for any task due in the next 48 hours.
    await screenshotAs(student, 'p7-02-student-inbox');
    await item.click();
    await expect(student).toHaveURL(/view=tasks&submission=/);
    // Opening it marked it as read.
    await expect(student.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();
  });

  await test.step('the guide sees the faculty dashboard', async () => {
    await signIn(guide, GUIDE);
    await guide.goto(`/semesters/${semesterId}`);
    const mine = guide.getByRole('region', { name: 'My students' });
    await expect(mine.getByRole('link', { name: 'Demo Student 301' })).toBeVisible();
    await expect(mine.getByRole('link', { name: 'Demo Student 302' })).toBeVisible();
    await expect(mine.getByRole('link', { name: 'Demo Student 303' })).toHaveCount(0);
    await screenshotAs(guide, 'p7-03-faculty-dashboard');
  });

  await test.step('the HOD dashboard: every number opens the matching list (UI-02)', async () => {
    await signIn(hod, HOD);
    await hod.goto(`/semesters/${semesterId}`);
    const kpis = hod.getByRole('region', { name: 'Key figures' });
    await expect(kpis.getByRole('link', { name: /^3\s*Projects$/ })).toBeVisible();
    await expect(kpis.getByRole('link', { name: /^1\s*Without a guide$/ })).toBeVisible();
    await expect(hod.getByRole('heading', { name: 'Faculty workload' })).toBeVisible();
    await expect(hod.getByRole('cell', { name: /Demo Guide \(P7\)/ })).toBeVisible();
    await screenshotAs(hod, 'p7-04-hod-dashboard');

    const overdueTile = kpis.getByRole('link', { name: /With overdue tasks$/ });
    const overdue = (await overdueTile.innerText()).match(/\d+/)?.[0] ?? '';
    expect(Number(overdue)).toBeGreaterThan(0);
    await overdueTile.click();
    await expect(hod).toHaveURL(/flag=overdue/);
    await expect(hod.getByRole('status').filter({ hasText: 'Showing' })).toContainText(
      `Showing ${overdue} of 3`,
    );
    await hod.goto(`/semesters/${semesterId}`);
    await hod
      .getByRole('region', { name: 'Key figures' })
      .getByRole('link', { name: /Without a guide$/ })
      .click();
    await expect(hod.getByRole('status').filter({ hasText: 'Showing' })).toContainText(
      'Showing 1 of 3',
    );
    await expect(hod.getByRole('link', { name: 'Demo Student 303' })).toBeVisible();
    await screenshotAs(hod, 'p7-05-filtered-projects');
  });

  await test.step('the lead escalates a project; the HOD is notified', async () => {
    await signIn(lead, LEAD);
    await lead.goto(`/projects/${projectId}`);
    await lead.getByRole('button', { name: 'Escalate to HOD' }).click();
    const form = lead.getByRole('form', { name: 'Escalate to HOD' });
    await form
      .getByLabel(/needs the HOD's attention/)
      .fill('Week 1 was late and week 2 is overdue; please discuss with the student.');
    await form.getByRole('button', { name: 'Send to HOD' }).click();
    await expect(lead.getByText('The HOD has been notified.')).toBeVisible();

    await hod.goto('/notifications');
    await expect(
      hod.getByRole('link', { name: 'Escalated by the lead: Demo Student 301' }),
    ).toBeVisible();
    await expect(hod.getByText('Week 1 was late and week 2 is overdue')).toBeVisible();
    await screenshotAs(hod, 'p7-06-hod-escalation');
  });

  await test.step('the lead dashboard: domain × stage table and the CSV export', async () => {
    await lead.goto(`/semesters/${semesterId}`);
    const table = lead.getByRole('table', { name: /each domain at each stage/ });
    await expect(table.getByRole('rowheader', { name: 'Machine Learning' })).toBeVisible();
    await expect(table.getByRole('rowheader', { name: 'Web Systems' })).toBeVisible();
    const download = lead.waitForEvent('download');
    await lead.getByRole('button', { name: 'Project overview (CSV)' }).click();
    const file = await (await download).path();
    const csv = readFileSync(file, 'utf8');
    expect(csv.split('\r\n')[0]).toContain('Slot,Student ID,Student');
    expect(csv).toContain('Demo Student 301');
    expect(csv.trim().split('\r\n')).toHaveLength(4);
    await screenshotAs(lead, 'p7-07-lead-dashboard');
  });

  await test.step('the lead records a review meeting; the student sees only their outcome', async () => {
    await lead.goto(`/semesters/${semesterId}/meetings`);
    await lead.getByRole('button', { name: 'Record a meeting' }).click();
    const form = lead.getByRole('form', { name: 'Record a meeting' });
    await form.getByLabel('Title').fill('Week 3 review');
    await form
      .getByLabel('Held on')
      .fill(new Date(Date.now() - 3_600_000).toISOString().slice(0, 16));
    await form.getByLabel('Demo Guide (P7)').check();
    await form.getByRole('button', { name: 'Add a project outcome' }).click();
    await form.getByLabel('Project for outcome 1').selectOption({ label: 'Demo Student 301' });
    await form
      .getByLabel('Outcome 1', { exact: true })
      .fill('Search is too narrow; widen it this week.');
    await form
      .getByLabel('Action items for outcome 1 1', { exact: true })
      .fill('Add two digital libraries');
    await form.getByRole('button', { name: 'Add a project outcome' }).click();
    await form.getByLabel('Project for outcome 2').selectOption({ label: 'Demo Student 302' });
    await form.getByLabel('Outcome 2', { exact: true }).fill('On track.');
    await form.getByRole('button', { name: 'Save meeting' }).click();
    await expect(lead.getByRole('heading', { name: 'Week 3 review' })).toBeVisible();
    await screenshotAs(lead, 'p7-08-meetings');

    await student.goto('/');
    const outcomes = student.getByRole('region', { name: 'Meeting outcomes' });
    await expect(outcomes).toContainText('Search is too narrow');
    await expect(outcomes).not.toContainText('On track.');
    await expect(student.getByRole('link', { name: /^Notifications, 1 unread$/ })).toBeVisible();
  });

  await test.step('the audit log: the lead sees project entries, the HOD everything', async () => {
    await lead.goto(`/semesters/${semesterId}/audit`);
    await expect(lead.getByRole('cell', { name: 'project.escalated' })).toBeVisible();
    // The lead's view covers entries about projects; semester-wide ones are for the HOD.
    await expect(lead.getByRole('cell', { name: 'meeting.recorded' })).toHaveCount(0);
    await hod.goto(`/semesters/${semesterId}/audit`);
    await expect(hod.getByRole('cell', { name: 'meeting.recorded' })).toBeVisible();
    await expect(hod.getByRole('cell', { name: 'project.escalated' })).toBeVisible();
    await screenshotAs(hod, 'p7-09-audit-log');
  });
});
