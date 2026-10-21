import { z } from 'zod';

// The site's Content-Security-Policy forbids eval (scripts/host-config.mjs), so Zod must
// not probe for or use its eval-based fast path. Imported first by main.tsx.
z.config({ jitless: true });
