# TRD — Technical Requirements and Architecture

Status: Phase 0 — awaiting approval.

## 1. Architecture overview

```
 Browser (React SPA)
   │  supabase-js (HTTPS, user JWT)
   ▼
 Supabase project
   ├─ Auth ............ email/password, invites, password recovery, JWT sessions
   ├─ PostgREST ....... auto REST API over tables and views (reads, simple content writes)
   ├─ Postgres ........ schema, RLS policies, workflow RPC functions, audit triggers, views
   └─ Edge Functions .. privileged operations that need the service-role key (invite/deactivate users)
 Google Drive ......... documents stay here; the app stores links only
```

There is no separate application server. Authorization is enforced **in the database** by RLS and by `security definer` workflow functions. That is server-side by construction: the browser cannot bypass it.

## 2. Architecture decisions (ADRs)

**ADR-001 — Supabase instead of MongoDB + Express (decision D1).**
- Supabase provides managed Postgres, authentication (hashing, invites, recovery), a REST layer and RLS.
- The data is highly relational (projects ↔ tasks ↔ submissions ↔ reviews ↔ corrections). Postgres foreign keys, unique and partial indexes, and transactions enforce integrity that MongoDB would leave to application code.
- *Consequence:* the "collections" in the original brief become tables. The Express REST API becomes PostgREST endpoints plus RPC functions. "Server-side validation and authorization" is implemented with constraints, triggers, RLS and RPC functions.

**ADR-002 — Workflow changes only through RPC functions.**
- Students and faculty may edit content columns through PostgREST, subject to RLS.
- Status, approval, lateness and assignment columns are protected by a trigger and can only change inside workflow functions such as `app_submit_record`, `app_record_review` or `app_decide_assignment_request`.
- This keeps each state machine in one place and makes it auditable.

**ADR-003 — Edge Function for account administration.** Creating or inviting users requires the service-role key. One Edge Function (`admin-users`) handles invite, resend invite, deactivate and reactivate, after verifying that the caller is the HOD or an admin with that permission.

**ADR-004 — Single-page app on static hosting.** Vite builds the React app into static files. They can be served by any static host (Netlify, Vercel or Cloudflare Pages — to be decided). No server-side rendering is needed.

**ADR-005 — Links, not files.** Evidence is stored as URL plus metadata (D13). Storing a link does not prove the file is accessible or correct, so evidence has a separate verification status set by reviewers.

**ADR-006 — Audit by trigger.** A generic `AFTER INSERT/UPDATE/DELETE` trigger writes to `audit_log` with the before/after row as JSON, the actor (`auth.uid()`) and the time. `audit_log` has no update or delete grants for any API role.

**ADR-007 — Shared constants.** Enum values exist in SQL enums and in `src/domain/constants.ts`. An automated test parses the migrations and fails if the two drift apart.

## 3. Technology stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript (strict), Vite, Tailwind CSS v4, React Router, TanStack Query, React Hook Form + Zod |
| Backend | Supabase (Postgres 15+/17, Auth, PostgREST, Edge Functions in Deno/TypeScript) |
| Database tooling | Supabase CLI migrations (`supabase/migrations/*.sql`); generated TypeScript types (`supabase gen types`) |
| Tests | Vitest + Testing Library (frontend); SQL test scripts with an assertion helper (database/RLS); Playwright (end-to-end against a local Supabase stack) |
| Quality | ESLint, Prettier, `tsc --noEmit`, GitHub Actions CI |
| Package manager | pnpm |

## 4. Repository layout

```
mini-project-tracker/
├─ docs/                     planning documents (this folder)
├─ src/
│  ├─ app/                   router, layouts, providers
│  ├─ components/            reusable UI (StatusBadge, StageStepper, DataTable, Timeline, ...)
│  ├─ domain/                constants, pure business logic (progress, deadlines), Zod schemas
│  ├─ features/<feature>/    screens + hooks per feature (auth, semesters, roster, projects, reviews, ...)
│  └─ lib/                   supabase client, env, query helpers
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/            ordered SQL migrations (schema, RLS, functions, views)
│  ├─ functions/admin-users/ Edge Function
│  ├─ seed.sql               reference data only (no people)
│  └─ tests/                 SQL tests (RLS + workflow) and the local auth shim
├─ scripts/                  db-test.sh and other developer scripts
├─ e2e/                      Playwright tests
└─ .github/workflows/ci.yml
```

## 5. Validation layers

1. **Browser:** Zod schemas give immediate feedback. This is for usability only.
2. **Database constraints:** `NOT NULL`, `CHECK` (for example URL must start with `https://`, text length limits, weights total 100), foreign keys, unique and partial unique indexes.
3. **Triggers:** lock rules (no edits once submitted or approved), protected workflow columns, capacity limit, stage dependency checks.
4. **RPC functions:** permission checks, state-transition validity and cross-row rules (duplicate paper, open corrections before sign-off).

**Errors** are raised as `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '<CODE>: <human message>'`, with codes `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE`, `VALIDATION`, `DUPLICATE_PAPER`, `CAPACITY_EXCEEDED`, `GATE_NOT_MET`. The frontend maps each code to a friendly message. Internal details (SQL text, stack traces) are never shown.

## 6. Time and dates

- All timestamps are stored as `timestamptz` (UTC).
- The semester timezone (default `Asia/Kolkata`) is used to compute week boundaries and deadlines, and for display.
- `week_start(semester, n) = start_date + 7·(n−1)`.
- The default task deadline is the configured submission weekday/time (default Monday 23:59) that falls in the 7-day window starting at `week_start(n)`, in the semester timezone.
- Each task stores its own `due_at`, so a later change to the settings does not silently move existing deadlines. Regeneration is an explicit HOD action.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Scale | About 35 users per semester; data kept for multiple semesters. Every list of fewer than 500 rows renders without pagination. |
| Performance | Dashboard views < 1 s at p95 on Supabase's smallest compute. Indexes on every foreign key and on queue filters. |
| Availability | Managed Supabase SLA; no self-hosting. |
| Accessibility | WCAG 2.1 AA: keyboard navigation, labels, contrast; status is never shown by colour alone. |
| Browser support | Last 2 versions of Chrome, Edge, Firefox and Safari; responsive down to 360 px width. |
| Privacy | Students never see other students' data. Personal data is limited to name, email, institution ID and Drive links. |
| Maintainability | Strict TypeScript; no `any` in domain code; migrations are append-only once deployed. |

## 8. Future-semester readiness

Nothing is hardcoded:

- student count (capacity setting);
- domains;
- number of faculty;
- lead (membership);
- weeks (`week_count`);
- deadlines;
- stage weights;
- task templates.

A new semester is created by copying the configuration of the previous one (domains, milestones, templates, criteria). People are not copied.
