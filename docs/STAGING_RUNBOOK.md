# Staging runbook

Staging is where the HOD and faculty run the UAT checklist with fictional data. Everything in the repository is ready. The steps below are the ones that need an account owner.

## 1. Supabase (database, sign-in, Edge Function)

**Option A — reuse the current project as staging. ← Chosen on 2026-10-21.** The project `mini-project-tracker` (ref `utkekzbkdtcbmupbxmpp`, ap-south-1) is in sync, checked on 2026-10-21: all 37 migrations and the `admin-users` Edge Function (active) match the repository, and it has no users or data yet. Skip to step 1.4.

**Option B — a new free project "mpt-staging"** in region ap-south-1 (Mumbai):

1. Supabase dashboard → New project → note the **project ref** and the **database password**.
2. GitHub → repository → Settings → Secrets and variables → Actions. Add:
   - `SUPABASE_ACCESS_TOKEN`: from Supabase → Account → Access tokens;
   - `STAGING_PROJECT_REF`;
   - `STAGING_DB_PASSWORD`.
   
   Also create an environment named `staging` under Settings → Environments.
3. GitHub → Actions → **Deploy database to staging** → Run workflow. It lists the pending migrations, pushes them and deploys the `admin-users` Edge Function.
4. Then, in either case:
   1. Edge Function secrets (Supabase → Edge Functions → admin-users → Secrets): the function uses the project's service-role key, which Supabase provides automatically. Nothing goes into GitHub or the frontend.
   2. Auth settings (Supabase → Authentication):
      - turn public sign-up **off**;
      - minimum password length 10;
      - **Site URL** = the staging address from step 2, also added to the redirect allow-list;
      - SMTP: for staging, the built-in sender is acceptable for a handful of invitations, but it is rate-limited.
   3. Make the HOD: in the SQL editor run `select app.bootstrap_hod('<the HOD''s email>');` after she has signed in once from her invitation (or create her account under Authentication → Users first).

## 2. Frontend (static host)

The build is plain static files. `pnpm build` also writes the security headers and the single-page-app fallback for the host.

| Host | Setup |
|---|---|
| **Netlify** | Add new site → import from GitHub → this repository. `netlify.toml` sets the build command and folder. |
| **Vercel** | Add new project → import this repository. `vercel.json` sets the build, the SPA rewrite and the headers. |
| **Cloudflare Pages** | Create project → connect this repository. Build command `pnpm build`, output directory `dist`. `_headers` and `_redirects` are picked up from `dist`. |

On any host, set two **build environment variables**, both public values (Supabase → Project Settings → API):

- `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = the publishable (anon) key

**Never** set the service-role key on the host. The build fails if a secret key ends up in the bundle.

## 3. Check before UAT

- [ ] Open the staging address: the sign-in page loads, and a deep link (e.g. `/semesters`) does not show a 404.
- [ ] The browser's network tab shows the `Content-Security-Policy` header on the page.
- [ ] The HOD signs in and sees "Department setup".
- [ ] Invite one test faculty member: the email arrives and its link opens the staging site.
- [ ] Optional for session 3: create a fictional student named "UAT Student 05", then run `scripts/uat/prepare-s6.sql` for that student.
- [ ] Run `scripts/backup-drill.sh` against the staging database (PG* variables from Supabase → Project Settings → Database) as the staging backup drill.
