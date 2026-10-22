# MiniTrack design system

A professional, data-dense academic project tool used daily by the HOD, four faculty and about 25 students. **Clarity over decoration:** no gradients, glassmorphism or ornamental charts; subtle transitions only, and none when the user prefers reduced motion.

Tokens live in `src/index.css` (Tailwind v4 `@theme`); components in `src/components/`.

## Colour

| Role | Token | Use |
|---|---|---|
| Brand / structure | `brand-900` `#0f1f3b` (navy) | Sidebar, sign-in panel, logo |
| Action | `blue-700` `#1d4ed8` (5.9:1 on white) | Primary buttons, links, the current step |
| Surface | white cards on `slate-50` | All content sits on cards with a 1px `slate-200` border and a light shadow |
| Text | `slate-900` body, `slate-600` secondary | Secondary text is `slate-600` on tinted backgrounds, so it stays above 4.5:1 |
| Success | `green-600/800` | Approved, verified |
| Warning | `amber-500/800` | Waiting for review, changes requested, needs attention |
| Danger | `red-700/800` | Overdue, rejected, destructive actions |
| Info | `blue-50/800` | In progress, submitted |

**Status is never conveyed by colour alone (WCAG 1.4.1):**

- `StatusChip` combines a symbol (✓ ! • ○ ✕) with words.
- The journey timeline uses a different marker per status: a check, "!", a ring, or the step number.
- Key-figure tiles that need attention get an amber edge and amber numbers, and their meaning is in the label text.

Dark mode follows the operating system (`prefers-color-scheme`), using the same tokens.

## Typography

- **Font:** Inter Variable, self-hosted from `@fontsource-variable/inter` (SIL OFL 1.1). No third-party font request is made, so the strict Content Security Policy holds.
- **Scale:**

  | Text | Style |
  |---|---|
  | Page title | `text-2xl` semibold, tight tracking |
  | Card title | `text-base` semibold |
  | Body | `text-sm` (14 px) |
  | Labels and metadata | `text-xs` |
  | Section eyebrows | `text-xs` uppercase |

- **Numbers:** tabular figures for every number, so columns line up.
- **Long text:** titles, names and URLs wrap (`overflow-wrap: break-word` on `main`).

## Layout and breakpoints

- **Desktop (`lg`, ≥ 1024 px):**
  - a fixed 256 px navy sidebar with the main links, plus the current semester's sections, each with an icon;
  - a sticky top bar with breadcrumbs, the notification bell and the account menu;
  - content up to `max-w-7xl`.
- **Tablet and phone:**
  - the sidebar becomes a drawer: an accessible dialog that closes with Escape, sends focus in and back out, and closes on navigation;
  - the semester sections also appear as a scrollable row of tabs under the semester title;
  - breadcrumbs collapse to the current page.
- **Spacing:** a 4 px base. Cards use 16 px padding, 20 px from `sm` up; sections are 24 px apart.
- **Tables:** `.data-table` gives a quiet header row, row dividers and hover feedback. Wide tables scroll inside their card (`overflow-x-auto`, `data-scroll-x`); the page itself never scrolls sideways.

## Components

| Component | Notes |
|---|---|
| `AppShell` | Sidebar, mobile drawer, top bar, skip link ("Skip to content") |
| `Button` | Variants: primary, secondary, danger, ghost; `busy` state with a spinner; visible focus outline |
| `TextField`, `SelectField`, `TextAreaField`, `ListField` | Label above the field; hint or error linked with `aria-describedby`; `aria-invalid` on errors |
| `Card` | `section` labelled by its title (a region landmark) |
| `PageHeader` | Optional eyebrow, title, description and actions |
| `LoadingState` | A skeleton placeholder plus a screen-reader status message ("Loading…") |
| `EmptyState` | An honest "nothing here yet" with an optional next step. **No placeholder or invented figures are ever shown.** |
| `JourneyTimeline` | The nine research stages: a vertical list on small screens, a connected horizontal timeline on large ones; buttons, links or plain items |
| `StatusChip`, `ProgressBar`, `KpiTile`, `ExportCsvButton` | As before, restyled |
| Icons (`components/icons.tsx`) | Hand-drawn 24 px line icons, decorative only (`aria-hidden`), always next to a text label |

## Accessibility rules

- Semantic landmarks: a banner, the main navigation, breadcrumbs, `main` and labelled sections.
- Every interactive element is reachable and usable by keyboard, with a visible focus outline. Menus use the disclosure pattern (`aria-expanded`), not `role="menu"`.
- Colour contrast is at least 4.5:1 for text, checked by axe-core on 29 screens in `e2e/accessibility.spec.ts`.
- Animation respects `prefers-reduced-motion`.
