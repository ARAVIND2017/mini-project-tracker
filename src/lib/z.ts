import { z } from 'zod';

// The site's Content-Security-Policy forbids eval (scripts/host-config.mjs), so Zod must
// not probe for or use its eval-based fast path. Every module imports Zod from here, so
// this runs before any schema is used, wherever the bundler places the code.
z.config({ jitless: true });

export { z };
