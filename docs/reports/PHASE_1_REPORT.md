# Phase 1 Report — Repository and Application Foundation

Date: 2026-10-16 · Status: **complete, awaiting approval to start Phase 2**

## Scope delivered

| Item | Where |
|---|---|
| Vite + React 19 + TypeScript (strict) + Tailwind v4 + React Router + TanStack Query | `package.json`, `vite.config.ts`, `src/` |
| ESLint (strict TS rules; `dangerouslySetInnerHTML` banned), Prettier, Vitest | `eslint.config.js`, `.prettierrc.json` |
| Validated environment loading; refuses a secret/service-role key in the browser | `src/lib/env.ts` |
| Supabase client and connection check | `src/lib/supabase.ts`, `/status` page |
| App shell, home, friendly error and not-found pages | `src/app/` |
| Workflow constants (25 enums, 9 stages, default weights, semester defaults) and status labels | `src/domain/` |
| `StatusChip` component (text + icon, not colour only) | `src/components/StatusChip.tsx` |
| Foundation migration: `app` helper schema, 25 enum types, `raise_error`, `guard_protected_columns`, `prevent_mutation`, `set_updated_at`, append-only `audit_log` with generic audit trigger | `supabase/migrations/20261016162119_foundation.sql` |
| Database test harness (throwaway Postgres + Supabase shim) | `scripts/db-test.sh`, `supabase/tests/` |
| Bundle secret scan (SEC-11) | `scripts/scan-bundle.mjs` (runs inside `pnpm build`) |
| Supabase local config (sign-up disabled, password rules) | `supabase/config.toml` |
| CI workflow (lint, format, typecheck, unit, build + scan, audit, DB tests) | `.github/workflows/ci.yml` |

## Test results (local)

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm test`: 4 files, 13 tests pass. These include the **enum sync test**, which fails if the TypeScript constants and the SQL enums drift apart. I verified that it does fail by introducing a deliberate mismatch.
- `pnpm test:db`: pass. It covers:
  - the enum types;
  - the error format;
  - that protected columns can't be changed by API roles but can be changed by a `security definer` workflow function;
  - that the audit log records the actor, the project and before/after values, and skips no-op updates;
  - that `audit_log` can't be read, updated or deleted by API roles (including service_role);
  - that the `app` helpers are private;
  - that RLS is enabled on every public table.

  I also checked that a deliberately failing test makes the harness exit with code 1.
- `pnpm build`: passes. The secret scan is clean, and I confirmed it flags a planted service_role JWT.
- Visual check: the home and `/status` pages render. Without `.env.local`, `/status` explains what is missing.

## Deviations and notes

- **Column-protection mechanism.** The docs originally described a session flag (`app.workflow`). I replaced it with a check of `current_user`, because inside `security definer` workflow functions the current role is the owner and clients can't fake that. DATABASE_SPEC.md and USER_ROLES_AND_PERMISSIONS.md are updated.
- **TypeScript pinned to 6.0.** TypeScript 7 is the latest release, but `typescript-eslint` supports only versions below 6.1.
- **Bundle size.** The bundle is 645 kB (188 kB gzipped), mostly supabase-js and the router. Route-level code splitting is planned with the feature screens (Phase 3 onwards).
- **CI not yet run.** The workflow file exists, but GitHub CI hasn't run because the repository isn't on GitHub yet (decision D14).
- **Two kinds of database test.** Tests run on plain Postgres 16 with a shim. When Docker/Supabase CLI is available, the same migrations will also be checked with `supabase start` + `supabase test db`, starting in Phase 2.

## Open items carried forward

- PRD O1–O5 (admin delegate, hosting/budget, SMTP, real data entry, panel rules).
- The HOD's login email is needed to bootstrap the first account in Phase 2. It will be entered at run time, not committed.

## Next: Phase 2 — Authentication and faculty hierarchy

Profiles, system roles, semesters, memberships, permission helper functions with RLS, semester and role RPCs, the `admin-users` Edge Function (invite/deactivate), HOD bootstrap, and screens for sign-in, password reset, invite acceptance, semester setup and People & roles.
