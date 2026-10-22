# Frontend audit and redesign

Date: 2026-10-22 · Scope: frontend only.

- **No changes** to migrations, SQL, RLS, the Edge Function, Supabase or authentication settings.
- **Not deployed.**
- **Functional change:** one, in UAT terms: students no longer see the generic "Project lifecycle" list on their home page, which their own journey timeline replaces.

## 1. Baseline audit (before any change)

- **Stack confirmed:** React 19, TypeScript, Vite 8, React Router 8 (browser history, lazy routes), Tailwind CSS v4, TanStack Query, Supabase JS. There was no UI component library and no icon library.
- **Checks:** lint, typecheck, 80 unit tests, all database tests and the production build passed. All 9 browser tests passed on the production build.
- **New visual tour** (`e2e/zz-visual-tour.spec.ts`): **39 screens** at **1440, 768 and 390 px**, as signed-out, HOD, lead, faculty, panel member and student, on the **local** stack with fictional demo data. It recorded **0** console errors, **0** page errors, **0** failed requests, **0** horizontal overflows and **0** blank screens.
- **Problems found** (presentation and usability, not breakage):
  1. **Phone navigation:** the top links wrapped, and the semester tabs scrolled sideways with no hint ("Assignme…" was cut off).
  2. **Overloaded overview:** the semester overview stacked the full settings form under the dashboard. The HOD's phone page was about 5,000 px tall.
  3. **No visual identity:** a plain text line as the brand; the sign-in page was a bare card; no sidebar or breadcrumbs.
  4. **Unconnected stages:** the research stages were a grid of separate boxes, so "what is done, waiting or mine to do" took reading rather than glancing.
  5. **Clipped labels:** stage-funnel labels were cut off on phones and on desktop.
  6. **Squeezed table columns:** on phones the student column of the projects table was a few characters wide.
  7. **A redundant list:** students saw a generic "Project lifecycle" list that said nothing about their own progress.

## 2. Design references

The environment blocks direct page loads, so **I could not visually browse** 21st.dev, Dribble or Canva. Their pages and components were studied through search results only.

| Source | What was taken | Decision |
|---|---|---|
| [21st.dev sidebar components](https://21st.dev/community/components/s/sidebar.md), e.g. [wensity/sidebar](https://21st.dev/@wensity/components/sidebar.md) | App sidebar with sections, active item and a user area | **Pattern adopted, packages not installed.** They need framer-motion, tailwind-merge or Radix and an API key to install, and some list their licence as "unknown". Built on the existing Tailwind setup instead |
| [WAI-ARIA APG: disclosure navigation](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/) | Links plus disclosure buttons, `aria-current`; not `role="menu"` | Sidebar, account menu and phone drawer |
| Dribbble (via search): [project dashboards](https://dribbble.com/annawangler/collections/1411595-UX-Board), [university dashboards](https://dribbble.com/Dbsquid/collections/5232794-dashboard?page=2) | Key figures first, then distribution, then lists of what needs attention | Dashboard order kept, made calmer and clearer |
| [Dashboard design study (Silesian University of Technology)](https://yadda.icm.edu.pl/baztech/element/bwmeta1.element.baztech-662d6498-ed06-4ef9-a18b-388b7da69021/c/143-Zdonek-2.pdf); [Canvas dashboard redesign (Univ. of Twente)](https://bachelorshowcase-eemcs.apps.utwente.nl/view/MoZebTUK) | Few charts, deadlines first, contrast checked for colour-blind users | No decorative charts; status shown with symbols as well as colour; overdue items prominent |
| Canva palette guidance (via search), e.g. [Navy Sky palette](https://www.canva.com/colors/color-palettes/navy-sky-complex/) | 3–5 colours, one dominant colour, a navy structural accent, checked contrast | Navy for structure, blue-700 for actions, amber, red and green for status, slate for neutrals |

## 3. Design decisions

See [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md). In short:

- **Shell:** a navy sidebar (desktop) and drawer (phone); the top bar has breadcrumbs, the bell and an account menu. The semester sections live in the sidebar, and also appear as tabs on phones.
- **Font:** Inter, self-hosted, so the strict CSP still blocks third-party requests.
- **Surfaces:** white cards with a 1 px border and a light shadow on a `slate-50` page, rounded-xl corners, and generous but not oversized spacing.
- **Research journey timeline:** connected horizontal steps on desktop and a vertical list on phones. Each step shows its number, name and status in words, with distinct markers. It's used on the project page and the student home.
- **Project header:** semester, student, title, domain, guide, "stages approved n of 9", and counts of stages waiting for review or with changes requested. All are real data.
- **Semester overview:** dashboard first. Settings sit in a "Semester settings" disclosure, open by default only for draft semesters.
- **Sign-in pages:** a brand panel listing the nine stages, and the form; a single column on phones.
- **Tables:** a quiet header and row hover; wide tables scroll inside their card.
- **Status:** symbol plus words everywhere; the amber "needs attention" tiles have an edge marker.

## 4. Files changed

- **New:**
  - `src/components/icons.tsx`
  - `src/components/JourneyTimeline.tsx`
  - `src/features/semesters/semesterSections.tsx`
  - `docs/DESIGN_SYSTEM.md`
  - `e2e/zz-visual-tour.spec.ts`
- **Restyled or restructured:**
  - `src/index.css` (tokens, focus, tables, reduced motion)
  - `src/components/ui.tsx` (button variants, inputs, cards, page header, skeleton loading, empty state)
  - `src/app/AppShell.tsx` (new shell)
  - `src/features/semesters/SemesterNav.tsx` (header plus phone tabs)
  - `src/features/auth/AuthLayout.tsx`
  - `src/features/research/ProjectWorkspacePage.tsx` (summary header plus timeline)
  - `src/features/projects/StudentProgress.tsx` (journey timeline)
  - `src/features/dashboard/SemesterDashboard.tsx` (tiles, funnel)
  - `src/features/semesters/SemesterDetailPage.tsx` (settings disclosure)
  - `src/app/HomePage.tsx`, `src/app/RouteError.tsx`
  - table classes in 8 screens
  - `index.html` (title "MiniTrack")
- **Robustness:**
  - Zod is now imported everywhere through `src/lib/z.ts` (was `zodSetup.ts`), so its "no eval" setting always runs first, wherever the bundler places code. The new layout had moved code so that the CSP check caught an `eval` probe again.
  - `e2e/phase6-final-signoff.spec.ts` now waits for the sign-off summary to refresh, fixing a timing race exposed by the faster build.
- **Dependencies:** added `@fontsource-variable/inter` (OFL-1.1, font files only). Nothing removed.
- **Unchanged:** `supabase/` (migrations, tests, functions, config), API calls, data fields, RLS and authentication flow.

## 5. Results after the redesign

| Check | Result |
|---|---|
| Format, lint, typecheck | Pass |
| Unit and component tests | 80/80 |
| Database tests (incl. the 897-cell permission matrix) | Pass |
| Production build (with secret scan and host headers) | Pass |
| Browser journeys on the **production build** with real security headers | **10/10**: accessibility, SEC-14, SEC-03, journeys 1–7, no CSP violations, visual tour |
| Accessibility (axe-core, WCAG 2.1 A/AA, 29 screens) plus keyboard-only task submission | **0 violations**. The redesign at first introduced a contrast issue on the current step, now fixed |
| Visual tour | 39 screens × 3 widths: **0** console errors, page errors, failed requests, horizontal overflows or blank screens. Phone drawer and account menu open, close with Escape, and return focus. Browser back and forward work. A long project title wraps |
| Phone page length (HOD overview) | about 5,000 px → about 2,800 px |

## 6. Known limits and not verified

- **Live backend not tested:** everything ran against the local Supabase stack with fictional data. The live project is unreachable from this environment over the network, and no live data may be created.
- **Design sources not browsed visually:** 21st.dev, Dribbble and Canva were studied through search results only (see §2).
- **Dark mode** follows the system setting and uses the same tokens, but it was not part of the screenshot tour.
- **Fixed sidebar in full-page screenshots:** it appears only at the top of very tall screenshots. In the browser it stays fixed while the page scrolls.

## 7. Before Cloudflare Pages deployment

1. Review the before and after screenshots, and tell me about anything to change.
2. Optionally, a dark-mode pass and a dark-mode tour.
3. Then Step 3 of the staging plan: the Cloudflare project and Supabase Auth settings, after your approval.
