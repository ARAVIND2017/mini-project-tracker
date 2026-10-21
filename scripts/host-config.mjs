// Static-host configuration for the built app (DEPLOYMENT_AND_SECURITY.md §1, ADR-004).
// One source for the security headers and the single-page-app fallback, written as:
//   dist/_headers, dist/_redirects  — Netlify and Cloudflare Pages
//   vercel.json                     — Vercel (checked, not written: it lives in the repo)
// Run after `vite build`:  node scripts/host-config.mjs dist [--check-vercel]
// CSP_EXTRA_CONNECT adds origins to connect-src (only for local testing against the local stack).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const extra = (process.env.CSP_EXTRA_CONNECT ?? '').split(/\s+/).filter(Boolean);
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  ["connect-src 'self' https://*.supabase.co wss://*.supabase.co", ...extra].join(' '),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const dist = process.argv[2] ?? 'dist';
const headerLines = ['/*', ...Object.entries(HEADERS).map(([k, v]) => `  ${k}: ${v}`)];
// Hashed assets never change; the page itself must always be revalidated.
headerLines.push('/assets/*', '  Cache-Control: public, max-age=31536000, immutable');
headerLines.push('/index.html', '  Cache-Control: no-cache');
writeFileSync(join(dist, '_headers'), headerLines.join('\n') + '\n');
writeFileSync(join(dist, '_redirects'), '/*  /index.html  200\n');
console.log(`✓ wrote ${dist}/_headers and ${dist}/_redirects`);

if (process.argv.includes('--check-vercel') && extra.length === 0) {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const got = Object.fromEntries(
    (vercel.headers?.find((h) => h.source === '/(.*)')?.headers ?? []).map((h) => [h.key, h.value]),
  );
  if (JSON.stringify(got) !== JSON.stringify(HEADERS)) {
    console.error('✕ vercel.json headers differ from scripts/host-config.mjs. Expected:');
    console.error(
      JSON.stringify(
        Object.entries(HEADERS).map(([key, value]) => ({ key, value })),
        null,
        2,
      ),
    );
    process.exit(1);
  }
  console.log('✓ vercel.json headers match');
}
