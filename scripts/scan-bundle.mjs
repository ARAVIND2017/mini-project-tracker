// SEC-11: fail if a Supabase secret key ends up in the built frontend.
// Looks for real key shapes, not the words themselves (libraries mention "service_role").
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'dist';
const SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{20,}/g;
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

const findings = [];
for (const file of files(root)) {
  const text = readFileSync(file, 'utf8');
  if (SECRET_KEY.test(text)) findings.push(`${file}: sb_secret_ key`);
  for (const [, payload] of text.matchAll(JWT)) {
    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (claims.role === 'service_role') findings.push(`${file}: service_role JWT`);
    } catch {
      // not a JWT payload
    }
  }
}

if (findings.length > 0) {
  console.error('✕ Secret keys found in the frontend bundle:\n' + findings.join('\n'));
  process.exit(1);
}
console.log(`✓ No secret keys in ${root}`);
