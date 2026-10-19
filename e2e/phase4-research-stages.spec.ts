import { expect, test, type Page } from '@playwright/test';
import { createUser, screenshotAs, signIn, sql, sqlAs } from './helpers';
import { addressCorrection, review, verifyCorrection } from './review';

// TEST_PLAN.md journey 3 (Phase 4): a student takes S1–S5 from exploration to approved
// objectives while the guide reviews, with corrections on the way. Run on a freshly
// reset local stack. Every person, paper and link here is fictional demo data.
const HOD = 'demo.hod@example.test';
const LEAD = 'demo4.lead@example.test';
const GUIDE = 'demo4.guide@example.test';
const OTHER = 'demo4.faculty@example.test';
const STUDENT = 'demo4.student@example.test';
const SEMESTER = 'Demo Semester (Phase 4)';
const sem = `(select id from public.semesters where name = '${SEMESTER}')`;

const LONG =
  'In my own words: the fictional demo paper trains a small model on a public demo dataset, ' +
  'compares it with two baselines and reports accuracy; I understand where its limits are.';

async function stage(page: Page, name: RegExp) {
  await page.getByRole('button', { name }).click();
}

test('student completes S1–S5 with the guide reviewing (journey 3)', async ({
  browser,
  request,
}) => {
  let projectId = '';

  await test.step('seed: semester, faculty, one student, guide assigned', async () => {
    await createUser(request, HOD, 'Demo HOD');
    await createUser(request, LEAD, 'Demo Lead (P4)');
    await createUser(request, GUIDE, 'Demo Guide (P4)');
    await createUser(request, OTHER, 'Demo Faculty (P4)');
    await createUser(request, STUDENT, 'Demo Student 101');
    if (
      sql("select count(*) from public.system_roles where role = 'hod' and revoked_at is null") ===
      '0'
    ) {
      sql(`select app.bootstrap_hod('${HOD}')`);
    }
    const uid = (email: string) => `(select id from auth.users where email = '${email}')`;
    sqlAs(
      HOD,
      `select public.app_create_semester('${SEMESTER}', '2026-27',
         jsonb_build_object('start_date', current_date - 2, 'target_paper_year', 2026, 'max_students', 5))`,
    );
    sqlAs(HOD, `select public.app_set_lead(${sem}, ${uid(LEAD)})`);
    sqlAs(HOD, `select public.app_set_membership(${sem}, ${uid(GUIDE)}, 'faculty')`);
    sqlAs(HOD, `select public.app_set_membership(${sem}, ${uid(OTHER)}, 'faculty')`);
    sqlAs(HOD, `select public.app_upsert_domain(${sem}, 'Machine Learning')`);
    sqlAs(
      HOD,
      `select public.app_upsert_criterion((select id from public.domains where semester_id = ${sem}),
         'Accuracy over the baseline')`,
    );
    sqlAs(HOD, `select public.app_activate_semester(${sem})`);
    sqlAs(
      HOD,
      `select public.app_import_roster(${sem}, '[{"slot_no": 1, "institution_id": "DEMO101",
         "full_name": "Demo Student 101", "email": "${STUDENT}", "domain_name": "Machine Learning"}]'::jsonb, false)`,
    );
    sqlAs(
      HOD,
      `select public.app_link_student((select id from public.students where semester_id = ${sem} and slot_no = 1), ${uid(STUDENT)})`,
    );
    projectId = sql(`select id from public.projects where semester_id = ${sem}`);
    sqlAs(HOD, `select public.app_assign_guide('${projectId}', ${uid(GUIDE)})`);
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
  });

  const student = await (await browser.newContext()).newPage();
  const guide = await (await browser.newContext()).newPage();
  const openAsGuide = async () => {
    await guide.goto(`/projects/${projectId}`);
    await guide.getByRole('navigation', { name: 'Stages' }).waitFor();
  };

  // ------------------------------------------------------------------ S1 --------
  await test.step('S1: the student submits the exploration', async () => {
    await signIn(student, STUDENT);
    await student.getByRole('link', { name: 'Open my research stages' }).click();
    await expect(
      student.getByRole('heading', { name: 'S1 · Domain and research exploration' }),
    ).toBeVisible();
    await student
      .getByLabel('Candidate topics 1')
      .fill('Fictional demo topic: efficient image classifiers');
    await student.getByLabel('Research keywords 1').fill('image classification');
    await student.getByRole('button', { name: '+ Add a keyword' }).click();
    await student.getByLabel('Research keywords 2').fill('model compression');
    await student.getByLabel('Source 1 name').fill('Demo digital library');
    await student.getByLabel('Source 1 link').fill('https://library.example.test/search');
    await student
      .getByLabel('Proposed research problem')
      .fill('Can a small fictional demo model keep its accuracy when it is compressed for phones?');
    await student.getByRole('button', { name: 'Save and submit for review' }).click();
    await expect(
      student.getByText('Complete these before submitting: Research keywords (at least 3)'),
    ).toBeVisible();
    await student.getByRole('button', { name: '+ Add a keyword' }).click();
    await student.getByLabel('Research keywords 3').fill('edge devices');
    await screenshotAs(student, 'p4-01-student-exploration');
    await student.getByRole('button', { name: 'Save and submit for review' }).click();
    await expect(student.getByText('Exploration submitted for review.')).toBeVisible();
    await expect(student.getByLabel('Research keywords 1')).toBeDisabled();
  });

  await test.step('S1: the guide requests changes with a correction', async () => {
    await signIn(guide, GUIDE);
    await openAsGuide();
    await review(
      guide,
      'Request changes',
      'Good start; the sources are too few.',
      'Add one more source',
    );
    await screenshotAs(guide, 'p4-02-guide-requested-changes');
  });

  await test.step('S1: the student addresses the correction and resubmits; the guide accepts', async () => {
    await student.reload();
    await addressCorrection(student, 'Add one more source', 'Added a second demo source.');
    await student.getByRole('button', { name: '+ Add a source' }).click();
    await student.getByLabel('Source 2 name').fill('Demo preprint server');
    await student.getByLabel('Source 2 link').fill('https://preprints.example.test');
    await screenshotAs(student, 'p4-03-student-addressed-correction');
    await student.getByRole('button', { name: 'Save and submit for review' }).click();
    await expect(student.getByText('Exploration submitted for review.')).toBeVisible();

    await guide.reload();
    await verifyCorrection(guide, 'Add one more source');
    await review(guide, 'Accept', 'Exploration approved.');
    await expect(
      guide.getByRole('button', { name: /Domain and research exploration.*Approved/ }),
    ).toBeVisible();
  });

  // ------------------------------------------------------------------ S2 --------
  await test.step('S2: the student records, selects and submits a paper', async () => {
    await student.reload();
    await stage(student, /Research paper selection/);
    await student.getByRole('button', { name: 'Add a candidate paper' }).click();
    const form = student.getByRole('form', { name: 'New candidate paper' });
    await form.getByLabel('Title').fill('A Fictional Demo Study of Compressed Image Classifiers');
    await form.getByLabel('Authors 1').fill('Demo Author');
    await form.getByLabel('Publication year').fill('2026');
    await form.getByLabel('Venue (journal or conference)').fill('Demo Conference on Examples');
    await form.getByLabel('DOI', { exact: true }).fill('10.5555/demo.0001');
    await form
      .getByLabel('PDF link in your Google Drive')
      .fill('https://drive.google.com/file/d/demo-paper');
    await form.getByLabel('Abstract').fill('A fictional abstract used only for this demo.');
    await form
      .getByLabel('Research problem of the paper')
      .fill('Keeping accuracy after compression.');
    await form
      .getByLabel('Relevance to the project domain')
      .fill(
        'It is a machine learning paper about image classifiers, which is exactly the project domain.',
      );
    await form.getByLabel('Code availability').selectOption({ label: 'Public code available' });
    await form.getByRole('button', { name: 'Save paper' }).click();
    await expect(student.getByText('Paper saved.')).toBeVisible();
    await student.getByRole('button', { name: 'Select this paper' }).click();
    await expect(student.getByText('Paper selected.')).toBeVisible();
    await student.getByRole('button', { name: 'Submit for review' }).click();
    await expect(student.getByText('Paper submitted for review.')).toBeVisible();
    await screenshotAs(student, 'p4-04-student-paper-submitted');
  });

  await test.step('SEC-07: an unassigned faculty member may only comment', async () => {
    const other = await (await browser.newContext()).newPage();
    await signIn(other, OTHER);
    await other.goto(`/projects/${projectId}?stage=paper_selection`);
    const form = other.getByRole('form', { name: 'Review the selected paper' });
    await expect(
      form.getByRole('heading', { name: 'Comment on the selected paper' }),
    ).toBeVisible();
    await expect(form.getByLabel('Outcome')).toHaveCount(0);
    await form.getByLabel('Comments').fill('Interesting choice of paper.');
    await form.getByRole('button', { name: 'Save comment' }).click();
    await expect(other.getByText('Comment saved.')).toBeVisible();
    await screenshotAs(other, 'p4-05-unassigned-faculty-comment-only');
    await other.context().close();
  });

  await test.step('S2: the guide approves the paper', async () => {
    await openAsGuide();
    await stage(guide, /Research paper selection/);
    await review(guide, 'Accept', 'Suitable paper from the target year.');
    await expect(
      guide.getByRole('button', { name: /Research paper selection.*Approved/ }),
    ).toBeVisible();
  });

  // ------------------------------------------------------------------ S3 --------
  const analysisFields: [string, string][] = [
    ['Problem addressed', 'Compressed models lose accuracy.'],
    ['Research objectives', 'Keep accuracy within 1% after compression.'],
    ['Methodology', 'Pruning followed by fine-tuning.'],
    ['Datasets', 'A public demo image dataset.'],
    ['Tools', 'Python and a deep learning framework.'],
    ['Algorithms and models', 'A small convolutional network.'],
    ['Reported results and metrics', 'Top-1 accuracy before and after compression.'],
    ['Limitations', 'Only one dataset is used.'],
    ['Research gaps', 'No evaluation on real phones.'],
    ['Own understanding (at least 150 characters, in your own words)', LONG],
  ];

  await test.step('S3: analysis changes requested, resubmitted and approved', async () => {
    await student.reload();
    await stage(student, /Paper analysis/);
    for (const [label, value] of analysisFields)
      await student.getByLabel(label, { exact: true }).fill(value);
    await student.getByRole('button', { name: 'Save and submit for review' }).click();
    await expect(student.getByText('Analysis submitted for review.')).toBeVisible();

    await openAsGuide();
    await stage(guide, /Paper analysis/);
    await review(
      guide,
      'Request changes',
      'Explain the fine-tuning.',
      'Describe the fine-tuning schedule',
    );

    await student.reload();
    await stage(student, /Paper analysis/);
    await addressCorrection(
      student,
      'Describe the fine-tuning schedule',
      'Methodology now explains it.',
    );
    await student
      .getByLabel('Methodology')
      .fill('Pruning, then 10 epochs of fine-tuning at a low learning rate.');
    await student.getByRole('button', { name: 'Save and submit for review' }).click();
    await expect(student.getByText('Analysis submitted for review.')).toBeVisible();

    await guide.reload();
    await stage(guide, /Paper analysis/);
    await verifyCorrection(guide, 'Describe the fine-tuning schedule');
    await screenshotAs(guide, 'p4-06-guide-analysis-thread');
    await review(guide, 'Accept', 'Clear analysis.');
    await expect(guide.getByRole('button', { name: /Paper analysis.*Approved/ })).toBeVisible();
  });

  // ------------------------------------------------------------------ S4 --------
  await test.step('S4: a failed and a successful attempt, then verification (WF-01)', async () => {
    await student.reload();
    await stage(student, /Original code execution/);
    const repo: [string, string][] = [
      ['Repository link', 'https://github.com/example-demo/compressed-classifier'],
      ['Owner', 'example-demo'],
      ['Repository name', 'compressed-classifier'],
      ['Commit or release used (recommended)', 'v1.0.0'],
      ['Language', 'Python'],
      ['Framework', 'A deep learning framework'],
      ['Dataset requirements', 'The public demo image dataset (download script included).'],
      ['Environment and dependencies', 'Python 3.12, requirements.txt'],
      ['Setup instructions', 'pip install -r requirements.txt; python train.py'],
    ];
    for (const [label, value] of repo) await student.getByLabel(label, { exact: true }).fill(value);
    await student.getByRole('button', { name: 'Save draft' }).click();
    await expect(student.getByText('Repository saved.')).toBeVisible();

    await student.getByRole('button', { name: 'Save and ask for verification' }).click();
    await expect(
      student.getByText(
        'Record a successful execution attempt with evidence before asking for verification',
      ),
    ).toBeVisible();

    await student.getByRole('button', { name: 'Record an attempt' }).click();
    let attempt = student.getByRole('form', { name: 'Record an execution attempt' });
    await attempt.getByLabel('Outcome').selectOption({ label: 'It failed' });
    await attempt
      .getByLabel('Errors encountered')
      .fill('ModuleNotFoundError: demo_module is missing');
    await attempt.getByLabel('Debugging notes').fill('Installed the missing module.');
    await attempt.getByRole('button', { name: 'Save attempt' }).click();
    await expect(student.getByText('Attempt recorded.')).toBeVisible();

    await student.getByRole('button', { name: 'Record an attempt' }).click();
    attempt = student.getByRole('form', { name: 'Record an execution attempt' });
    await attempt
      .getByLabel('Evidence 1 link')
      .fill('https://drive.google.com/file/d/demo-run-log');
    await attempt.getByLabel('Evidence 1 description').fill('Full run log of the original code');
    await attempt.getByRole('button', { name: 'Save attempt' }).click();
    await expect(student.getByText('Attempt recorded.')).toBeVisible();
    await student.getByRole('button', { name: 'Save and ask for verification' }).click();
    await expect(student.getByText('Sent to your guide for verification.')).toBeVisible();
    await screenshotAs(student, 'p4-07-student-execution-attempts');

    await openAsGuide();
    await stage(guide, /Original code execution/);
    await review(guide, 'Accept', 'The original code runs; log checked.');
    await expect(
      guide.getByRole('button', { name: /Original code execution.*Approved/ }),
    ).toBeVisible();
  });

  // ------------------------------------------------------------------ S5 --------
  await test.step('S5: objectives changes requested, then approved', async () => {
    await student.reload();
    await stage(student, /Research gap and objectives/);
    const fields: [string, string][] = [
      ['Limitations of the original work', 'Evaluated only on desktop GPUs.'],
      ['Research gap', 'No measurement on low-cost phones.'],
      [
        'Proposed problem statement',
        'Measure and keep accuracy of the compressed model on phones.',
      ],
      ['Main objective', 'Run the compressed model on a phone within 1% of the original accuracy.'],
      ['Proposed contribution', 'A phone benchmark of the compressed model.'],
      ['Scope', 'One dataset, one phone class.'],
      ['Exclusions (what is out of scope)', 'Training new architectures.'],
    ];
    for (const [label, value] of fields)
      await student.getByLabel(label, { exact: true }).fill(value);
    await student.getByLabel('Specific objectives 1').fill('Port the model to a phone runtime.');
    await student.getByRole('button', { name: '+ Add an objective' }).click();
    await student
      .getByLabel('Specific objectives 2')
      .fill('Measure accuracy and latency on the phone.');
    await student.getByRole('button', { name: '+ Accuracy over the baseline' }).click();
    await student.getByRole('button', { name: 'Save and submit for review' }).click();
    await expect(student.getByText('Objectives submitted for review.')).toBeVisible();

    await openAsGuide();
    await stage(guide, /Research gap and objectives/);
    await review(
      guide,
      'Request changes',
      'Make the latency target explicit.',
      'Give a latency target',
    );

    await student.reload();
    await stage(student, /Research gap and objectives/);
    await addressCorrection(
      student,
      'Give a latency target',
      'Objective 2 now has a 100 ms target.',
    );
    await student
      .getByLabel('Specific objectives 2')
      .fill('Measure accuracy, and keep latency under 100 ms.');
    await student.getByRole('button', { name: 'Save and submit for review' }).click();
    await expect(student.getByText('Objectives submitted for review.')).toBeVisible();

    await guide.reload();
    await stage(guide, /Research gap and objectives/);
    await verifyCorrection(guide, 'Give a latency target');
    await review(guide, 'Accept', 'Objectives approved.');
    await expect(
      guide.getByRole('button', { name: /Research gap and objectives.*Approved/ }),
    ).toBeVisible();
    await screenshotAs(guide, 'p4-08-guide-objectives-approved');
  });

  await test.step('the student sees S1–S5 approved and S6 as the current stage', async () => {
    await student.goto('/');
    await expect(student.getByText('6. Proposed implementation')).toBeVisible();
    await student.getByRole('link', { name: 'Open my research stages' }).click();
    await stage(student, /Research gap and objectives/);
    await expect(student.getByLabel('Main objective')).toBeDisabled();
    await screenshotAs(student, 'p4-09-student-stages-approved');
    expect(
      sql(`select string_agg(status::text, ',' order by stage_key) from public.project_stages
           where project_id = '${projectId}' and stage_key <= 'objectives'`),
    ).toBe('approved,approved,approved,approved,approved');
  });
});
