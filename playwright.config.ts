import { defineConfig } from '@playwright/test';

// End-to-end tests run against the local stack (scripts/local-stack/start.sh), never the live project.
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 860 },
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? undefined },
  },
  webServer: {
    command: 'pnpm dev --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.LOCAL_ANON_KEY ?? '',
    },
  },
});
