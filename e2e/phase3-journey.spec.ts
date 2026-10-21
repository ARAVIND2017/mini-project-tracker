import { expect, test, type Page } from '@playwright/test';
import {
  acceptInvitation,
  answerNextDialog,
  createUser,
  linkFromLatestEmail,
  screenshot,
  signIn,
  sql,
} from './helpers';

// End-to-end journey through Phases 1–3 on the local stack. Every person and
// record here is fictional demo data (example.test addresses).
const HOD = 'demo.hod@example.test';
const LEAD = 'demo.lead@example.test';
const FACULTY = 'demo.faculty.a@example.test';
const STUDENT = 'demo.student01@example.test';

const BAD_CSV =
  'slot_no,institution_id,full_name,email,domain\n' +
  '1,DEMO001,Demo Student 01,demo.student01@example.test,Machine Learning\n' +
  '2,DEMO002,Demo Student 02,not-an-email,Web and Cloud Systems\n';

const ROSTER_CSV =
  'slot_no,institution_id,full_name,email,drive_folder_url,domain\n' +
  '1,DEMO001,Demo Student 01,demo.student01@example.test,https://drive.google.com/drive/folders/demo-01,Machine Learning\n' +
  '2,DEMO002,Demo Student 02,demo.student02@example.test,,Web and Cloud Systems\n' +
  '3,DEMO003,Demo Student 03,demo.student03@example.test,,Machine Learning\n' +
  '4,DEMO004,Demo Student 04,demo.student04@example.test,,Web and Cloud Systems\n' +
  '5,DEMO005,Demo Student 05,demo.student05@example.test,,Machine Learning\n' +
  '6,DEMO006,Demo Student 06,demo.student06@example.test,,\n' +
  '7,,,,,\n' +
  '8,,,,,\n';

const section = (page: Page, heading: string) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: heading, exact: true }) });

test.describe.configure({ mode: 'serial' });

test('HOD sets up a semester, faculty and students take part (Phases 1–3)', async ({
  browser,
  request,
}) => {
  // ---------------------------------------------------------------- setup -------
  await test.step('one-time setup: the HOD account (dashboard invite + SQL editor step)', async () => {
    await createUser(request, HOD, 'Demo HOD');
    if (
      sql("select count(*) from public.system_roles where role = 'hod' and revoked_at is null") ===
      '0'
    ) {
      sql(`select app.bootstrap_hod('${HOD}')`);
    }
  });

  const hodContext = await browser.newContext();
  const hod = await hodContext.newPage();

  await test.step('HOD signs in', async () => {
    await hod.goto('/login');
    await screenshot(hod, 'sign-in');
    await signIn(hod, HOD);
    await expect(hod.getByText('HOD', { exact: true })).toBeVisible();
    await screenshot(hod, 'hod-home');
  });

  let semesterUrl = '';
  await test.step('HOD creates the semester', async () => {
    await hod.getByRole('link', { name: 'Manage semesters →' }).click();
    await hod.getByRole('button', { name: 'New semester' }).click();
    await hod.getByLabel('Name').first().fill('Demo Semester 2026-27');
    await hod.getByLabel('Academic year').fill('2026-27');
    await hod.getByLabel('Start date (first lab day)').fill('2027-01-05');
    await screenshot(hod, 'create-semester-form');
    await hod.getByRole('button', { name: 'Create semester' }).click();
    await expect(hod.getByRole('heading', { name: 'Activation checklist' })).toBeVisible();
    semesterUrl = new URL(hod.url()).pathname;
    await screenshot(hod, 'semester-overview-checklist');
  });

  await test.step('HOD adds project domains and evaluation criteria', async () => {
    await hod.getByRole('link', { name: 'Domains' }).click();
    for (const [name, description] of [
      ['Machine Learning', 'Models, datasets and evaluation'],
      ['Web and Cloud Systems', 'Web applications, APIs and cloud deployment'],
    ]) {
      await section(hod, 'Add a domain').getByLabel('Name').fill(name);
      await section(hod, 'Add a domain').getByLabel('Description (optional)').fill(description);
      await hod.getByRole('button', { name: 'Add domain' }).click();
      await expect(hod.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    const ml = section(hod, 'Machine Learning');
    await ml.getByLabel('New criterion').fill('Accuracy improvement over the baseline');
    await ml.getByRole('button', { name: 'Add' }).click();
    await expect(ml.getByText('Accuracy improvement over the baseline')).toBeVisible();
    await screenshot(hod, 'domains');
  });

  await test.step('HOD invites the lead faculty and a faculty member', async () => {
    await hod.getByRole('link', { name: 'People & roles' }).click();
    const invite = section(hod, 'Invite faculty');
    for (const [name, email, role] of [
      ['Demo Lead Faculty', LEAD, 'lead_faculty'],
      ['Demo Faculty A', FACULTY, 'faculty'],
    ]) {
      await invite.getByLabel('Full name').fill(name);
      await invite.getByLabel('Email').fill(email);
      await invite.getByLabel('Role in this semester').selectOption(role);
      await invite.getByRole('button', { name: 'Send invitation' }).click();
      await expect(hod.getByText(`Invitation sent to ${email}.`)).toBeVisible();
    }
    await expect(hod.getByText('Lead faculty: Demo Lead Faculty')).toBeVisible();
    await screenshot(hod, 'people-and-roles');
  });

  await test.step('FUN-04 invitation emails arrive (local email catcher)', async () => {
    const mail = await browser.newPage();
    await mail.goto('http://localhost:54324/');
    await expect(mail.getByText(LEAD).first()).toBeVisible();
    await screenshot(mail, 'invitation-emails');
    await mail.close();
  });

  const leadContext = await browser.newContext();
  const lead = await leadContext.newPage();
  await test.step('the lead faculty accepts the invitation and chooses a password', async () => {
    await lead.goto(await linkFromLatestEmail(request, LEAD));
    await lead.getByRole('heading', { name: 'Choose your password' }).waitFor();
    await screenshot(lead, 'choose-password');
    await lead.getByLabel('New password').fill('DemoPassword2026');
    await lead.getByLabel('Confirm password').fill('DemoPassword2026');
    await lead.getByRole('button', { name: 'Save password' }).click();
    await expect(lead.getByRole('heading', { name: 'Welcome, Demo Lead Faculty' })).toBeVisible();
    await screenshot(lead, 'lead-home');
  });

  const facultyContext = await browser.newContext();
  const faculty = await facultyContext.newPage();
  await test.step('faculty A accepts the invitation', async () => {
    await acceptInvitation(faculty, await linkFromLatestEmail(request, FACULTY));
  });

  await test.step('HOD imports the roster: preview catches a bad row', async () => {
    await hod.goto(`${semesterUrl}/roster`);
    await hod
      .getByLabel('Choose CSV file')
      .setInputFiles({ name: 'roster.csv', mimeType: 'text/csv', buffer: Buffer.from(BAD_CSV) });
    await expect(
      hod.getByText('"not-an-email" is not a valid email', { exact: false }),
    ).toBeVisible();
    await expect(hod.getByRole('button', { name: /Import \d+ row/ })).toBeDisabled();
    await screenshot(hod, 'roster-preview-with-problem');
  });

  await test.step('HOD imports the corrected roster (6 students, 2 empty slots)', async () => {
    await hod
      .getByLabel('Choose CSV file')
      .setInputFiles({ name: 'roster.csv', mimeType: 'text/csv', buffer: Buffer.from(ROSTER_CSV) });
    await expect(hod.getByText(/Preview:.*8 new/)).toBeVisible();
    await screenshot(hod, 'roster-preview-ok');
    await hod.getByRole('button', { name: 'Import 8 row(s)' }).click();
    await expect(hod.getByText(/Imported: 8 new/)).toBeVisible();
    await expect(hod.getByText('6 of 30 places filled', { exact: false })).toBeVisible();
    await screenshot(hod, 'roster-imported');
  });

  await test.step('HOD invites a student', async () => {
    const row = hod.getByRole('row').filter({ hasText: 'Demo Student 01' });
    await row.getByRole('button', { name: 'Invite' }).click();
    await expect(hod.getByText(`Invitation sent to ${STUDENT}.`)).toBeVisible();
    await expect(row.getByText('Account active')).toBeVisible();
  });

  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await test.step('the student accepts and sees their project (no guide yet)', async () => {
    await acceptInvitation(student, await linkFromLatestEmail(request, STUDENT));
    const card = section(student, 'My project');
    await expect(card.getByText('Machine Learning')).toBeVisible();
    await expect(card.getByText('Not assigned yet')).toBeVisible();
    await card
      .getByLabel('Working title')
      .fill('Robust image classification under distribution shift');
    await card.getByRole('button', { name: 'Save title' }).click();
    await expect(student.getByText('Working title saved.')).toBeVisible();
    await screenshot(student, 'student-my-project-before-guide');
  });

  await test.step('faculty A records expertise and requests to guide a student', async () => {
    await faculty.reload();
    await faculty.getByRole('link', { name: /Demo Semester 2026-27/ }).click();
    await faculty.getByRole('link', { name: 'Assignments' }).click();
    await faculty.getByRole('checkbox', { name: 'Machine Learning' }).check();
    await faculty.getByRole('button', { name: 'Save expertise' }).click();
    await expect(faculty.getByText('Your domains of expertise are saved.')).toBeVisible();
    const project = faculty.getByRole('listitem').filter({ hasText: 'Demo Student 01' });
    answerNextDialog(faculty, 'My research area is robust computer vision');
    await project.getByRole('button', { name: 'Request to guide' }).click();
    await expect(faculty.getByText('Request sent to the HOD.')).toBeVisible();
    await screenshot(faculty, 'faculty-assignments-request');
  });

  await test.step('the lead proposes faculty A as co-reviewer for another student (needs HOD approval)', async () => {
    await lead.reload();
    await lead.getByRole('link', { name: /Demo Semester 2026-27/ }).click();
    await lead.getByRole('link', { name: 'Assignments' }).click();
    const propose = section(lead, 'Propose a guide or co-reviewer');
    await propose
      .getByLabel('Project')
      .selectOption({ label: 'Slot 3 · Demo Student 03 (Machine Learning)' });
    await propose.getByLabel('Role').selectOption('co_reviewer');
    await propose.getByLabel('Faculty member').selectOption({ label: 'Demo Faculty A' });
    await propose.getByLabel('Reason').fill('Second opinion on evaluation design');
    await propose.getByRole('button', { name: 'Send proposal' }).click();
    await expect(lead.getByText('Proposal sent to the HOD.')).toBeVisible();
  });

  await test.step('HOD approves both requests', async () => {
    await hod.goto(`${semesterUrl}/assignments`);
    const waiting = section(hod, 'Requests waiting for the HOD (2)');
    await expect(waiting).toBeVisible();
    await screenshot(hod, 'hod-requests-waiting');
    for (let i = 0; i < 2; i++) {
      answerNextDialog(hod, 'Approved at the review meeting');
      await hod.getByRole('button', { name: 'Approve' }).first().click();
      await expect(hod.getByText('Request approved.')).toBeVisible();
    }
    await expect(section(hod, 'Requests waiting for the HOD (0)')).toBeVisible();
  });

  await test.step('the lead grants a one-off review authorization', async () => {
    await lead.reload();
    const auth = section(lead, 'Review authorizations');
    await auth.getByLabel('Project').selectOption({ label: 'Slot 2 · Demo Student 02' });
    await auth.getByLabel('Faculty member').selectOption({ label: 'Demo Faculty A' });
    await auth.getByLabel('Note (optional)').fill('Covering the week-4 review');
    await auth.getByRole('button', { name: 'Grant authorization' }).click();
    await expect(lead.getByText('Review authorization granted.')).toBeVisible();
    await screenshot(lead, 'lead-review-authorization');
  });

  await test.step('projects list shows the guide and co-reviewer', async () => {
    await hod.goto(`${semesterUrl}/projects`);
    const row = hod.getByRole('row').filter({ hasText: 'Demo Student 01' });
    await expect(row.getByRole('combobox', { name: 'Guide for Demo Student 01' })).toHaveValue(
      /.+/,
    );
    const row3 = hod.getByRole('row').filter({ hasText: 'Demo Student 03' });
    await expect(row3.getByRole('cell', { name: 'Demo Faculty A' })).toBeVisible();
    await screenshot(hod, 'projects-list');
  });

  await test.step('HOD activates the semester', async () => {
    await hod.goto(semesterUrl);
    answerNextDialog(hod);
    await hod.getByRole('button', { name: 'Activate semester' }).click();
    await expect(hod.getByRole('heading', { name: 'Close semester' })).toBeVisible();
    await screenshot(hod, 'semester-activated');
  });

  await test.step('the student now sees their guide', async () => {
    await student.reload();
    const card = section(student, 'My project');
    await expect(card.getByText('Demo Faculty A')).toBeVisible();
    await screenshot(student, 'student-my-project-with-guide');
  });

  await test.step('privacy (journey 7): the student cannot open another student’s data', async () => {
    await student.goto(`${semesterUrl}/roster`);
    await expect(student.getByText('This page is for faculty.', { exact: false })).toBeVisible();
    await expect(student.getByText('Demo Student 02')).toHaveCount(0);
    // Even reading the table directly returns only the student's own row (RLS).
    const rows = await student.evaluate(async () => {
      const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
      const token = key ? JSON.parse(localStorage.getItem(key) ?? '{}').access_token : '';
      const res = await fetch('http://localhost:54321/rest/v1/students?select=full_name', {
        headers: { apikey: token, Authorization: `Bearer ${token}` },
      });
      return (await res.json()) as { full_name: string }[];
    });
    expect(rows.map((r) => r.full_name)).toEqual(['Demo Student 01']);
    await screenshot(student, 'student-cannot-see-roster');

    // Journey 7: opening another student's project by its address shows "Not found",
    // without confirming the project exists.
    const otherProject = sql(
      "select p.id from public.projects p join public.students s on s.id = p.student_id where s.full_name = 'Demo Student 02'",
    );
    await student.goto(`/projects/${otherProject}`);
    await expect(
      student.getByText('Project not found, or you do not have access to it.'),
    ).toBeVisible();
    await expect(student.getByText('Demo Student 02')).toHaveCount(0);
  });

  await test.step('the audit trail recorded every action', async () => {
    const count = Number(
      sql(
        "select count(*) from public.audit_log where action in ('semester.created','roster.imported','assignment.approved','semester.activated','review_authorization.granted')",
      ),
    );
    expect(count).toBeGreaterThanOrEqual(6);
  });

  await Promise.all([
    hodContext.close(),
    leadContext.close(),
    facultyContext.close(),
    studentContext.close(),
  ]);
});
