# Deployment and Security

Status: Phase 0 — awaiting approval. Hosting provider and budget are still open (PRD O2/O3).

## 1. Environments

| Environment | Database / Auth | Frontend | Data |
|---|---|---|---|
| Local | Supabase CLI local stack (Docker) or the plain-Postgres test harness | `pnpm dev` | Fictional seed data |
| Staging | **Decided 2026-10-21:** the existing Supabase project `mini-project-tracker` (ref `utkekzbkdtcbmupbxmpp`, ap-south-1) | Static host — still to be decided | Fictional data for UAT |
| Production | A new Supabase project "mpt-prod", created in Phase 9 on a paid plan — region **ap-south-1 (Mumbai)** recommended for latency and data locality | Static host (Netlify / Vercel / Cloudflare Pages — to be decided) | Real data, entered by the HOD |

## 2. Configuration and secrets

| Name | Where | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend build environment | No (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable / legacy anon key) | Frontend build environment | No — it only grants what RLS allows |
| `SUPABASE_SERVICE_ROLE_KEY` (secret key) | **Edge Function secrets only** | **Yes — never in the frontend, the repository or CI logs** |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` | GitHub Actions secrets (for migrations) | Yes |
| SMTP credentials | Supabase Auth settings | Yes |

Rules:
- `.env*` files are git-ignored except `.env.example`.
- A CI step scans the build output for the service-role key pattern (SEC-11).
- Access to the Supabase dashboard is limited to the HOD and the developer, with MFA enabled on their Supabase accounts.

## 3. Deployment pipeline

1. A pull request runs CI: lint, typecheck, unit, DB/RLS tests, build.
2. Merge to `main`:
   - `supabase db push` to **staging** (migrations);
   - deploy the Edge Functions;
   - deploy the frontend preview.
3. A tagged release (`vX.Y.Z`) with manual approval:
   - same steps against **production**;
   - a manual backup is taken first.
4. Migrations are append-only and forward-only. A rollback is a new migration; there are no destructive edits to applied migrations.

## 4. Supabase Auth settings (production)

- Email/password sign-in; **public sign-up disabled** (accounts are created by invite only).
- Email confirmation on; secure password change on; minimum password length 10, with letters and digits required; leaked-password protection on (paid plans).
- Site URL and redirect allowlist limited to the production domain.
- **Custom SMTP** with the department's sending domain (the built-in sender is rate-limited and meant for testing only).
- JWT expiry 1 hour, with refresh-token rotation and reuse detection (the defaults).
- Rate limits on sign-in and recovery kept at the defaults or stricter.

## 5. Database security checklist

- [ ] RLS enabled on **every** table in `public` (also checked by a CI test that queries `pg_class.relrowsecurity`).
- [ ] No policies for `anon`.
- [ ] `security definer` functions have `set search_path = ''`, check `auth.uid()`, and do their own permission checks.
- [ ] No function is executable by `anon`, and only the allow-listed policy helpers in `app` are executable by `authenticated`. Supabase grants EXECUTE on every new function by default; migration `20261018081654_lock_internal_functions` removes that default, and `supabase/tests/998_function_privileges.sql` checks it.
- [ ] Supabase advisor warning *“Signed-in users can execute SECURITY DEFINER function”* for `public.app_*` RPCs is **expected**: these are the workflow API, and each one checks permissions itself.
- [ ] Views use `security_invoker = true`.
- [ ] `audit_log`: only `select` for `authenticated` (filtered by policy); no update or delete for anyone except the database owner.
- [ ] Supabase Security Advisor and Performance Advisor show no errors before each production release.
- [ ] `pg_graphql` disabled if unused (reduces the attack surface).

## 6. Application security

- Content Security Policy:
  - `default-src 'self'`;
  - `connect-src` limited to the Supabase URL;
  - no inline scripts;
  - `frame-ancestors 'none'`.
- Headers: HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- All user text is rendered as text (React escaping); no `dangerouslySetInnerHTML`.
- External links open with `rel="noopener noreferrer"`. Only `https:` URLs are accepted.
- Dependency audit (`pnpm audit`) in CI; Dependabot once the repository is on GitHub.

## 7. Backup and recovery

| Item | Plan |
|---|---|
| Daily backups | Included with the Supabase Pro plan (7-day retention). **The free plan has no usable backups and pauses inactive projects, so it is not suitable for production.** |
| Point-in-time recovery | Optional add-on; recommended during the final weeks of each semester |
| Off-site copy | Weekly `pg_dump` (schema + data) by a scheduled GitHub Action to encrypted storage owned by the department; 12-week retention |
| End-of-semester archive | Full dump after the semester is closed, kept for the period the institution requires |
| Restore drill | Before go-live and once per semester: restore into a scratch project, compare row counts, open three projects in the UI |
| RPO / RTO targets | RPO 24 h (≤ 2 min with PITR); RTO 4 h |

## 8. Monitoring

- Supabase dashboard: API error rate, database CPU and disk, auth events. Alerts by email to the developer.
- Frontend error reporting (an optional lightweight tool such as Sentry, with personal data scrubbed).
- A weekly automated report to the HOD: failed sign-ins, deactivated accounts and role changes (from `audit_log`).

## 9. Incident response

1. Contain: deactivate the affected accounts; rotate keys (Supabase dashboard → API keys) if a secret leaked.
2. Assess: query `audit_log` for the time window.
3. Recover: restore from backup or PITR into a scratch project, then repair the affected rows with an audited migration.
4. Inform the HOD; record the incident and its follow-up actions.

## 10. Data protection

- Personal data collected: name, email, institution ID, Drive links. Nothing else.
- Students see only their own data. Faculty see the data of their semester's students.
- Accounts are deactivated, not deleted, so history is kept. Deletion on request is done by the HOD through a documented SQL procedure that anonymises the profile.
- Drive permissions are never bypassed. The app stores links only, and evidence verification is a human check.
