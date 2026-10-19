-- Phase 4 — Research stages S1–S5 (part B: row-level security)
-- Reads only: whoever may view the project (faculty-level users of the semester,
-- admins, and the project's own student). Every write goes through the workflow
-- functions, so API roles get SELECT and nothing else (SEC-08, SEC-09).

alter table public.research_explorations enable row level security;
alter table public.papers enable row level security;
alter table public.paper_analyses enable row level security;
alter table public.code_repositories enable row level security;
alter table public.execution_attempts enable row level security;
alter table public.objective_versions enable row level security;
alter table public.evidence enable row level security;
alter table public.reviews enable row level security;
alter table public.corrections enable row level security;

revoke all on public.research_explorations, public.papers, public.paper_analyses, public.code_repositories,
  public.execution_attempts, public.objective_versions, public.evidence, public.reviews, public.corrections
from anon, authenticated;

grant select on public.research_explorations, public.papers, public.paper_analyses, public.code_repositories,
  public.execution_attempts, public.objective_versions, public.evidence, public.reviews, public.corrections
to authenticated;

create policy research_explorations_select on public.research_explorations for select to authenticated
  using (app.can_view_project(project_id));
create policy papers_select on public.papers for select to authenticated
  using (app.can_view_project(project_id));
create policy paper_analyses_select on public.paper_analyses for select to authenticated
  using (app.can_view_project(project_id));
create policy code_repositories_select on public.code_repositories for select to authenticated
  using (app.can_view_project(project_id));
create policy execution_attempts_select on public.execution_attempts for select to authenticated
  using (app.can_view_project(project_id));
create policy objective_versions_select on public.objective_versions for select to authenticated
  using (app.can_view_project(project_id));
create policy evidence_select on public.evidence for select to authenticated
  using (app.can_view_project(project_id));
create policy reviews_select on public.reviews for select to authenticated
  using (app.can_view_project(project_id));
create policy corrections_select on public.corrections for select to authenticated
  using (app.can_view_project(project_id));
