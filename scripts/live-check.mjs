// Read-only checks against a deployed Supabase project, using only the PUBLIC values the
// browser app also has (URL + publishable key). It never signs anyone up and never
// writes: every request is a read, or one that must be refused.
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_… node scripts/live-check.mjs
import { readFileSync } from 'node:fs';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (public values only).');
  process.exit(2);
}
const headers = { apikey: KEY, 'Content-Type': 'application/json' };
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✕'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// Tables, views and functions as the app knows them (src/lib/database.types.ts).
const types = readFileSync('src/lib/database.types.ts', 'utf8');
const section = (name) => {
  const start = types.indexOf(`    ${name}: {`, types.indexOf('  public: {'));
  const body = types.slice(start, types.indexOf('\n    };', start));
  return [...body.matchAll(/^ {6}([a-z_]+): \{/gm)].map((m) => m[1]);
};
const tables = section('Tables');
const views = section('Views');
const functions = section('Functions');

const health = await fetch(`${URL_}/auth/v1/health`, { headers });
check('sign-in service is up', health.ok, `HTTP ${health.status}`);

const settings = await (await fetch(`${URL_}/auth/v1/settings`, { headers })).json();
check(
  'public sign-up is disabled (invite only)',
  settings.disable_signup === true,
  `disable_signup = ${settings.disable_signup}`,
);
check('email sign-in is enabled', settings.external?.email === true);
check(
  'new accounts must confirm their email',
  settings.mailer_autoconfirm === false,
  `mailer_autoconfirm = ${settings.mailer_autoconfirm}`,
);

let exposed = [];
for (const t of [...tables, ...views]) {
  const res = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1`, { headers });
  const body = await res.text();
  if (res.ok && body.trim() !== '[]') exposed.push(`${t} (${res.status})`);
}
check(
  `anonymous visitors read nothing from ${tables.length} tables and ${views.length} views`,
  exposed.length === 0,
  exposed.join(', ') || 'all refused or empty',
);

let callable = [];
for (const fn of functions) {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: '{}' });
  // Refused (401/403), or not even resolvable without arguments (404/400) — never 200.
  if (res.ok) callable.push(fn);
}
check(
  `anonymous visitors can call none of the ${functions.length} workflow functions`,
  callable.length === 0,
  callable.join(', ') || 'all refused',
);

const fnNoAuth = await fetch(`${URL_}/functions/v1/admin-users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
check(
  'the admin-users function refuses requests without a token',
  fnNoAuth.status === 401,
  `HTTP ${fnNoAuth.status}`,
);
const fnAnon = await fetch(`${URL_}/functions/v1/admin-users`, {
  method: 'POST',
  headers: { ...headers, Authorization: `Bearer ${KEY}` },
  body: '{"action":"invite_faculty"}',
});
check(
  'the admin-users function refuses the public key (not a user)',
  fnAnon.status === 401,
  `HTTP ${fnAnon.status}`,
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
