# Research-Based Mini-Project Tracker

A web application for the HOD, faculty and students to track undergraduate research mini-projects. It covers every step from choosing a research paper to final panel sign-off, and progress is based on evidence and faculty approvals.

- **Status:** Phase 1 (foundation). See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).
- **Stack:** React + TypeScript + Tailwind (Vite) · Supabase (Postgres, Auth, Row-Level Security, Edge Functions).

## Planning documents

| Document                                                  | Contents                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| [PRD](docs/PRD.md)                                        | Requirements, user stories, acceptance criteria, recorded decisions |
| [TRD](docs/TRD.md)                                        | Architecture and engineering decisions                              |
| [Roles & permissions](docs/USER_ROLES_AND_PERMISSIONS.md) | Hierarchy and authorization matrix                                  |
| [Workflow](docs/WORKFLOW_SPEC.md)                         | Stages, statuses, transitions, review loop                          |
| [Database](docs/DATABASE_SPEC.md)                         | Tables, fields, indexes, integrity rules                            |
| [API](docs/API_SPEC.md)                                   | RPC functions, endpoints, error codes                               |
| [UI/UX](docs/UI_UX_SPEC.md)                               | Screens, dashboards, components                                     |
| [16-week plan](docs/WEEKLY_MILESTONE_PLAN.md)             | Default milestones, tasks and gates                                 |
| [Test plan](docs/TEST_PLAN.md)                            | Test levels and the catalogue of test IDs                           |
| [Deployment & security](docs/DEPLOYMENT_AND_SECURITY.md)  | Environments, secrets, backups, monitoring                          |
| [AI features](docs/AI_FEATURE_SPEC.md)                    | Future, optional AI assistance and its limits                       |

## Supabase project

| | |
|---|---|
| Project | `mini-project-tracker` (ref `utkekzbkdtcbmupbxmpp`) |
| Region | ap-south-1 (Mumbai) |
| Plan | Free (upgrade before production — see DEPLOYMENT_AND_SECURITY.md §7) |
| API URL | `https://utkekzbkdtcbmupbxmpp.supabase.co` |

Put the URL and the **publishable** key (Dashboard → Project Settings → API Keys) in `.env.local`.

## Getting started

Requirements: Node 22+, pnpm 10, and PostgreSQL 15+ server binaries (for the database tests).

```bash
pnpm install
cp .env.example .env.local   # fill in the Supabase URL and publishable key
pnpm dev                     # http://localhost:5173 — "System status" shows the connection
```

## Checks

```bash
pnpm lint          # ESLint
pnpm typecheck     # TypeScript (strict)
pnpm test          # unit and component tests (Vitest)
pnpm test:db       # migrations + RLS/workflow SQL tests on a throwaway Postgres
pnpm build         # production build + scan for leaked secret keys
pnpm check         # all of the above
```

`pnpm test:db` applies `supabase/migrations/*.sql` to a temporary Postgres cluster with a small Supabase shim (`supabase/tests/_support`) and runs `supabase/tests/*.sql`. Nothing is kept afterwards.

## Repository layout

```
docs/                 planning documents and phase reports
src/app/              router, layout, error pages
src/components/       reusable UI components
src/domain/           workflow constants and business logic (mirrors the SQL enums)
src/features/         feature screens
src/lib/              Supabase client, environment validation
supabase/migrations/  database schema, RLS, workflow functions (append-only)
supabase/tests/       SQL tests and the local test shim
scripts/              developer scripts
```

## Security notes

- The browser only gets the **publishable** key. The service-role or secret key lives only in Edge Function secrets. The app refuses to start with a secret key, and the build fails if one is found in the bundle.
- Every table has row-level security enabled. A test enforces this.
