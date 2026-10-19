import { expect, type Page } from '@playwright/test';

// Review steps shared by the journeys: record a review, address and verify corrections.

export async function review(
  page: Page,
  outcome: 'Accept' | 'Request changes',
  observations: string,
  correction?: string | string[],
) {
  const form = page.getByRole('form', { name: /^Review the / });
  await form.getByLabel('Outcome').selectOption({ label: outcome });
  await form.getByLabel('Observations').fill(observations);
  const corrections = correction === undefined ? [] : [correction].flat();
  for (const [i, text] of corrections.entries()) {
    if (i > 0) await form.getByRole('button', { name: '+ Add a correction' }).click();
    await form.getByLabel(`Corrections ${i + 1}`, { exact: true }).fill(text);
  }
  await form.getByRole('button', { name: 'Record review' }).click();
  await expect(page.getByText('Review recorded.')).toBeVisible();
}

export async function addressCorrection(page: Page, correction: string, response: string) {
  const item = page.getByRole('listitem').filter({ hasText: correction }).last();
  await item.getByRole('button', { name: 'Mark as addressed' }).click();
  await item.getByLabel('What did you change?').fill(response);
  await item.getByRole('button', { name: 'Save response' }).click();
  await expect(page.getByText('Correction marked as addressed.')).toBeVisible();
}

export async function verifyCorrection(page: Page, correction: string) {
  await page
    .getByRole('listitem')
    .filter({ hasText: correction })
    .last()
    .getByRole('button', { name: 'Verify' })
    .click();
  await expect(page.getByText('Correction verified.')).toBeVisible();
}
