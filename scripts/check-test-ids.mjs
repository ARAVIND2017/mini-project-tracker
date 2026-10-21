// Traceability check: every requirement ID in docs/PRD.md and docs/TEST_PLAN.md
// (SEC-, DATA-, WF-, FUN-, UI-, AUD-, VAL-) must be named by at least one test:
// supabase/tests, e2e, src/**/*.test.ts(x) or scripts that run in CI. Prints the map.
//   node scripts/check-test-ids.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ID = /\b(SEC|DATA|WF|FUN|UI|AUD|VAL)-(\d+)\b/g;
const expand = (text) => {
  const ids = new Set();
  for (const m of text.matchAll(ID)) ids.add(`${m[1]}-${m[2].padStart(2, '0')}`);
  // "FUN-01..18" style ranges in the test plan.
  for (const m of text.matchAll(/\b(SEC|DATA|WF|FUN|UI|AUD|VAL)-(\d+)\.\.(\d+)\b/g))
    for (let i = Number(m[2]); i <= Number(m[3]); i++)
      ids.add(`${m[1]}-${String(i).padStart(2, '0')}`);
  return ids;
};
const required = new Set([
  ...expand(readFileSync('docs/PRD.md', 'utf8')),
  ...expand(readFileSync('docs/TEST_PLAN.md', 'utf8')),
]);

const files = [];
const walk = (dir, keep) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, keep);
    else if (keep(p)) files.push(p);
  }
};
walk('supabase/tests', (p) => p.endsWith('.sql') || p.endsWith('.json'));
walk('e2e', (p) => p.endsWith('.ts'));
walk('src', (p) => /\.test\.tsx?$/.test(p));
walk('scripts', (p) => p.endsWith('.mjs') && !p.endsWith('check-test-ids.mjs'));

const where = new Map();
for (const f of files) {
  for (const id of expand(readFileSync(f, 'utf8'))) {
    if (!where.has(id)) where.set(id, new Set());
    where.get(id).add(relative(root, f));
  }
}
const sorted = [...required].sort();
const missing = sorted.filter((id) => !where.has(id));
for (const id of sorted)
  console.log(`${id.padEnd(8)} ${[...(where.get(id) ?? ['— MISSING'])].join(', ')}`);
if (missing.length) {
  console.error(`✕ ${missing.length} requirement(s) with no test: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`✓ all ${sorted.length} requirement IDs are covered by tests`);
