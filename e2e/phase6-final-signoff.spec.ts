import { expect, test, type Page } from '@playwright/test';
import { createUser, screenshotAs, signIn, sql, sqlAs } from './helpers';
import { addressCorrection, review, verifyCorrection } from './review';

// TEST_PLAN.md journey 6 (Phase 6): S7 and S8 approved → checklist → panel of two → one
// approves, one requires changes → corrections fixed → both approve → completed.
// Run on a freshly reset local stack. Everything here is fictional demo data.
const HOD = 'demo.hod@example.test';
const LEAD = 'demo6.lead@example.test';
const GUIDE = 'demo6.guide@example.test';
const MEMBER = 'demo6.panel@example.test';
const STUDENT = 'demo6.student@example.test';
const SEMESTER = 'Demo Semester (Phase 6)';
const sem = `(select id from public.semesters where name = '${SEMESTER}')`;
const uid = (email: string) => `(select id from auth.users where email = '${email}')`;

const checklist = (page: Page) => page.getByRole('region', { name: 'Final checklist' });

async function signOff(
  page: Page,
  decision: 'Approve' | 'Changes required',
  remark: string,
  correction?: string,
) {
  const form = page.getByRole('form', { name: 'Panel sign-off' });
  await form.getByLabel('Decision').selectOption({ label: decision });
  await form.getByLabel('Originality remark').fill(remark);
  if (correction) await form.getByLabel('Corrections 1', { exact: true }).fill(correction);
  await form.getByRole('button', { name: 'Record sign-off' }).click();
  await expect(page.getByText('Sign-off recorded.')).toBeVisible();
}

test('final stages and panel sign-off (journey 6)', async ({ browser, request }) => {
  let projectId = '';
  let semesterId = '';

  await test.step('seed: a project with S1–S6 approved', async () => {
    await createUser(request, HOD, 'Demo HOD');
    await createUser(request, LEAD, 'Demo Lead (P6)');
    await createUser(request, GUIDE, 'Demo Guide (P6)');
    await createUser(request, MEMBER, 'Demo Panel Member (P6)');
    await createUser(request, STUDENT, 'Demo Student 301');
    if (
      sql("select count(*) from public.system_roles where role = 'hod' and revoked_at is null") ===
      '0'
    ) {
      sql(`select app.bootstrap_hod('${HOD}')`);
    }
    sqlAs(
      HOD,
      `select public.app_create_semester('${SEMESTER}', '2026-27', jsonb_build_object('start_date', current_date))`,
    );
    sqlAs(HOD, `select public.app_set_lead(${sem}, ${uid(LEAD)})`);
    sqlAs(HOD, `select public.app_set_membership(${sem}, ${uid(GUIDE)}, 'faculty')`);
    sqlAs(HOD, `select public.app_set_membership(${sem}, ${uid(MEMBER)}, 'faculty')`);
    sqlAs(HOD, `select public.app_upsert_domain(${sem}, 'Machine Learning')`);
    sqlAs(
      HOD,
      `select public.app_import_roster(${sem}, '[{"slot_no": 1, "institution_id": "DEMO301",
         "full_name": "Demo Student 301", "email": "${STUDENT}", "domain_name": "Machine Learning"}]'::jsonb, false)`,
    );
    sqlAs(
      HOD,
      `select public.app_link_student((select id from public.students where semester_id = ${sem} and slot_no = 1), ${uid(STUDENT)})`,
    );
    sqlAs(HOD, `select public.app_activate_semester(${sem})`);
    semesterId = sql(`select ${sem}`);
    projectId = sql(`select id from public.projects where semester_id = ${sem}`);
    sqlAs(HOD, `select public.app_assign_guide('${projectId}', ${uid(GUIDE)})`);
    // S1–S6 were exercised by the earlier journeys; here they start approved.
    sql(`update public.project_stages set status = 'approved' where project_id = '${projectId}'
         and stage_key in ('exploration', 'paper_selection', 'paper_analysis', 'code_execution', 'objectives', 'implementation')`);
  });

  const student = await (await browser.newContext()).newPage();
  const guide = await (await browser.newContext()).newPage();
  const member = await (await browser.newContext()).newPage();
  const open = (page: Page, stage: string) => page.goto(`/projects/${projectId}?stage=${stage}`);

  await test.step('S7: baseline and proposed results, each with evidence; the guide accepts', async () => {
    await signIn(student, STUDENT);
    await open(student, 'evaluation');
    for (const r of [
      {
        kind: 'Baseline (original work)',
        test: 'Accuracy of the original code',
        actual: '88.7%',
        link: 'baseline',
      },
      {
        kind: 'Proposed (your work)',
        test: 'Accuracy of the compressed model',
        actual: '91.2%',
        link: 'proposed',
      },
    ]) {
      await student.getByRole('button', { name: 'Add a result' }).click();
      const form = student.getByRole('form', { name: 'New result' });
      await form.getByLabel('Kind').selectOption({ label: r.kind });
      await form.getByLabel('Test case').fill(r.test);
      await form.getByLabel('Expected result').fill('At least 88%');
      await form.getByLabel('Actual result').fill(r.actual);
      await form.getByLabel('Evidence link').fill(`https://drive.google.com/file/d/demo-${r.link}`);
      await form.getByLabel('What the evidence shows').fill('Test output for this result');
      await form.getByRole('button', { name: 'Save result' }).click();
      await expect(student.getByText('Result saved.')).toBeVisible();
    }
    await student.getByRole('button', { name: 'Submit the results for review' }).click();
    await expect(student.getByText('Results submitted for review.')).toBeVisible();
    await screenshotAs(student, 'p6-01-student-evaluation-results');

    await signIn(guide, GUIDE);
    await open(guide, 'evaluation');
    await review(guide, 'Accept', 'Baseline and proposed results are clear.');
    await expect(
      guide.getByRole('button', { name: /Testing and evaluation.*Approved/ }),
    ).toBeVisible();
  });

  await test.step('S8: ten sections; the last one is submitted and approved on screen', async () => {
    const sections = [
      'title_abstract',
      'introduction',
      'literature_review',
      'problem_objectives',
      'methodology',
      'proposed_approach',
      'implementation',
      'results_discussion',
      'conclusion_future_work',
    ];
    for (const s of sections) {
      sqlAs(
        STUDENT,
        `select public.app_submit_record('draft_section',
        public.app_save_draft('${projectId}', '${s}', '{"doc_url": "https://docs.google.com/document/d/demo-${s}"}'))`,
      );
      sqlAs(
        GUIDE,
        `select public.app_record_review('draft_section',
        (select id from public.paper_drafts where project_id = '${projectId}' and section = '${s}'), 'accepted', 'Approved')`,
      );
    }
    await open(student, 'paper_writing');
    await student.getByRole('button', { name: /^References/ }).click();
    await student
      .getByLabel('References: document link')
      .fill('https://docs.google.com/document/d/demo-references');
    await student.getByRole('button', { name: 'Save and submit for review' }).click();
    await expect(student.getByText('Section submitted for review.')).toBeVisible();

    await open(guide, 'paper_writing');
    await guide.getByRole('button', { name: /^References/ }).click();
    await review(guide, 'Accept', 'References are complete and verifiable.');
    await expect(
      guide.getByRole('button', { name: /Research paper writing.*Approved/ }),
    ).toBeVisible();
    await screenshotAs(guide, 'p6-02-guide-paper-sections');
  });

  await test.step('the HOD forms a panel of two for the project', async () => {
    const hod = await (await browser.newContext()).newPage();
    await signIn(hod, HOD);
    await hod.goto(`/semesters/${semesterId}/panels`);
    await hod.getByRole('button', { name: 'Create a panel' }).click();
    const form = hod.getByRole('form', { name: 'New panel' });
    await form.getByLabel('Panel name').fill('Panel A');
    await form.getByLabel('Demo Guide (P6)', { exact: true }).check();
    await form.getByLabel('Demo Panel Member (P6)', { exact: true }).check();
    await form.getByLabel(/Slot 1 · Demo Student 301/).check();
    await form.getByRole('button', { name: 'Save panel' }).click();
    await expect(hod.getByText('Panel saved.')).toBeVisible();
    await screenshotAs(hod, 'p6-03-hod-panels');
    await hod.context().close();
  });

  await test.step('S9: the student completes the checklist and submits for sign-off', async () => {
    for (const item of [
      'final_paper',
      'project_report',
      'source_repository',
      'source_zip',
      'readme',
      'dataset_references',
      'presentation',
    ]) {
      sqlAs(
        STUDENT,
        `select public.app_set_deliverable('${projectId}', '${item}',
        'https://drive.google.com/file/d/demo-${item}', 'Final ${item.replace(/_/g, ' ')} link')`,
      );
    }
    await open(student, 'final');
    const row = checklist(student).getByRole('listitem').filter({ hasText: 'Demo evidence' });
    await row.getByRole('button', { name: 'Add link' }).click();
    await row
      .getByLabel('Demo evidence (video or screenshots) link')
      .fill('https://drive.google.com/file/d/demo-screens');
    await row
      .getByLabel('Demo evidence (video or screenshots) description')
      .fill('Screenshots of the demo');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(student.getByText(/Demo evidence .* saved\./)).toBeVisible();
    await student.getByRole('button', { name: 'Submit for final sign-off' }).click();
    await expect(student.getByText('Submitted for the panel sign-off.')).toBeVisible();
  });

  await test.step('the guide verifies the checklist and approves; the other member requires changes', async () => {
    await open(guide, 'final');
    for (const label of [
      'Final paper',
      'Project report',
      'Source code repository',
      'Source code ZIP',
      'README with setup instructions',
      'Dataset references and usage permissions',
      'Presentation',
      'Demo evidence (video or screenshots)',
    ]) {
      await checklist(guide)
        .getByRole('listitem')
        .filter({ hasText: label })
        .getByRole('button', { name: 'Verify' })
        .click();
      await expect(guide.getByText(`${label} verified.`)).toBeVisible();
    }
    await expect(checklist(guide).getByRole('button', { name: 'Verify' })).toHaveCount(0);
    await signOff(guide, 'Approve', 'Clear contribution beyond the original paper.');
    await expect(guide.getByText('no decision yet')).toBeVisible();

    await signIn(member, MEMBER);
    await open(member, 'final');
    await expect(member.getByRole('form', { name: 'Panel sign-off' })).toBeVisible();
    await expect(member.getByText(/Approved · /)).toBeVisible();
    await screenshotAs(member, 'p6-04-panel-signoff-screen');
    await signOff(
      member,
      'Changes required',
      'Original work; the demo needs a video.',
      'Add a demo video link',
    );
    await expect(
      member.getByRole('button', {
        name: /Final documentation and demonstration.*Changes requested/,
      }),
    ).toBeVisible();
  });

  await test.step('the student fixes it and resubmits; the member verifies and approves; the project completes', async () => {
    await open(student, 'final');
    const row = checklist(student).getByRole('listitem').filter({ hasText: 'Demo evidence' });
    await row.getByRole('button', { name: 'Replace link' }).click();
    await row
      .getByLabel('Demo evidence (video or screenshots) link')
      .fill('https://drive.google.com/file/d/demo-video');
    await row
      .getByLabel('Demo evidence (video or screenshots) description')
      .fill('Demo video of the final system');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(student.getByText(/Demo evidence .* saved\./)).toBeVisible();
    await addressCorrection(
      student,
      'Add a demo video link',
      'The demo video is linked in the checklist.',
    );
    await student.getByRole('button', { name: 'Submit for final sign-off' }).click();
    await expect(student.getByText('Submitted for the panel sign-off.')).toBeVisible();

    await open(member, 'final');
    await checklist(member)
      .getByRole('listitem')
      .filter({ hasText: 'Demo evidence' })
      .getByRole('button', { name: 'Verify' })
      .click();
    await expect(member.getByText('Demo evidence (video or screenshots) verified.')).toBeVisible();
    await verifyCorrection(member, 'Add a demo video link');
    await signOff(member, 'Approve', 'Original work; the demo video confirms it runs.');
    await expect(member.getByText('The panel signed off. This project is complete.')).toBeVisible();
    await screenshotAs(member, 'p6-05-project-completed');
    expect(sql(`select is_completed from public.projects where id = '${projectId}'`)).toBe('t');
  });
});
