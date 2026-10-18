import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { APIRequestContext, Page } from '@playwright/test';

export const API = 'http://localhost:54321';
export const MAILPIT = 'http://localhost:54324';
export const PASSWORD = 'DemoPassword2026';
const serviceKey = () => readFileSync('.local-stack/service.jwt', 'utf8').trim();

/** Creates a confirmed account through the GoTrue admin API (local stack only). */
export async function createUser(request: APIRequestContext, email: string, fullName: string) {
  const res = await request.post(`${API}/auth/v1/admin/users`, {
    headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}` },
    data: {
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    },
  });
  if (!res.ok() && res.status() !== 422)
    throw new Error(`createUser ${res.status()}: ${await res.text()}`);
}

/** Runs SQL as the database owner (the "SQL editor" step of the real setup). */
export function sql(statement: string): string {
  const pgBin = execFileSync('bash', ['-c', 'ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1'])
    .toString()
    .trim();
  return execFileSync(`${pgBin}/psql`, [
    '-h',
    '127.0.0.1',
    '-p',
    '54322',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-tAc',
    statement,
  ])
    .toString()
    .trim();
}

/** Finds the newest email to `to` in Mailpit and returns the Supabase link in it. */
export async function linkFromLatestEmail(request: APIRequestContext, to: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await (
      await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
    ).json();
    const id = list.messages?.[0]?.ID;
    if (id) {
      const message = await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json();
      const match = /(http:\/\/localhost:54321\/auth\/v1\/verify[^"'\s<>]+)/.exec(
        `${message.HTML} ${message.Text}`,
      );
      if (match?.[1]) return match[1].replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email for ${to}`);
}

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: /^Welcome,/ }).waitFor();
}

/** Opens an invitation link and chooses a password, as the invited person would. */
export async function acceptInvitation(page: Page, link: string) {
  await page.goto(link);
  await page.getByRole('heading', { name: 'Choose your password' }).waitFor();
  await page.getByLabel('New password').fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Save password' }).click();
  await page.getByRole('heading', { name: /^Welcome,/ }).waitFor();
}

/** Answers the next browser prompt/confirm dialog. */
export function answerNextDialog(page: Page, text = '') {
  page.once('dialog', (dialog) => dialog.accept(text));
}

let shot = 0;
export async function screenshot(page: Page, name: string) {
  shot += 1;
  await page.screenshot({
    path: `docs/demo/${String(shot).padStart(2, '0')}-${name}.png`,
    fullPage: true,
  });
}
