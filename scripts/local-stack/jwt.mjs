// LOCAL STACK ONLY. Prints an HS256 JWT for the given role (anon | service_role).
import { createHmac } from 'node:crypto';

const [, , secret, role] = process.argv;
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const header = b64({ alg: 'HS256', typ: 'JWT' });
const payload = b64({ iss: 'supabase-local', role, iat: 1700000000, exp: 2000000000 });
const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
console.log(`${header}.${payload}.${sig}`);
