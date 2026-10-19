-- Phase 4 — Research stages S1–S5 (part A: tables)
-- Specs: DATABASE_SPEC.md §5–§7, WORKFLOW_SPEC.md §2.1 and §3.
-- Students write only through workflow functions (parts D–E); there are no write
-- grants on these tables. Business records are never deleted: papers are withdrawn,
-- versions are superseded, repositories are replaced (is_current = false).

-- -----------------------------------------------------------------------------
-- S1 Exploration
-- -----------------------------------------------------------------------------
create table public.research_explorations (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null unique references public.projects (id),
  candidate_topics text[] not null default '{}',
  keywords         text[] not null default '{}',
  sources          jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  proposed_problem text check (proposed_problem is null or char_length(proposed_problem) <= 5000),
  status           public.record_status not null default 'draft',
  submitted_at     timestamptz,
  decided_by       uuid references public.profiles (id),
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index research_explorations_decided_by_idx on public.research_explorations (decided_by);

-- -----------------------------------------------------------------------------
-- S2 Papers
-- -----------------------------------------------------------------------------
create table public.papers (
  id                         uuid primary key default gen_random_uuid(),
  project_id                 uuid not null references public.projects (id),
  title                      text not null check (char_length(btrim(title)) between 1 and 500),
  -- Lower-case, punctuation and repeated spaces removed: used by the duplicate check.
  title_normalized           text generated always as
                               (btrim(regexp_replace(lower(title), '[^[:alnum:]]+', ' ', 'g'))) stored,
  authors                    text[] not null default '{}',
  pub_year                   int check (pub_year is null or pub_year between 1900 and 2100),
  venue                      text check (venue is null or char_length(venue) <= 300),
  doi                        extensions.citext check (doi is null or doi::text ~ '^10\.[0-9]{4,9}/\S+$'),
  url                        text check (url is null or url ~* '^https://[^\s]+$'),
  pdf_drive_url              text check (pdf_drive_url is null or pdf_drive_url ~* '^https://[^\s]+$'),
  abstract                   text check (abstract is null or char_length(abstract) <= 10000),
  research_problem           text check (research_problem is null or char_length(research_problem) <= 5000),
  relevance_note             text check (relevance_note is null or char_length(relevance_note) <= 5000),
  code_availability          public.code_availability not null default 'unknown',
  foundational_justification text check (foundational_justification is null or char_length(foundational_justification) <= 5000),
  is_selected                boolean not null default false,
  status                     public.paper_status not null default 'candidate',
  selected_at                timestamptz,
  submitted_at               timestamptz,
  decided_by                 uuid references public.profiles (id),
  decided_at                 timestamptz,
  duplicate_override_reason  text,
  duplicate_override_by      uuid references public.profiles (id),
  duplicate_override_at      timestamptz,
  withdrawn_reason           text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  check (not is_selected or status in ('candidate', 'submitted', 'approved'))
);
create unique index papers_one_selected on public.papers (project_id) where is_selected;
create index papers_project_idx on public.papers (project_id);
create index papers_doi_idx on public.papers (doi) where doi is not null;
create index papers_title_normalized_idx on public.papers (title_normalized);
create index papers_decided_by_idx on public.papers (decided_by);
create index papers_override_by_idx on public.papers (duplicate_override_by);

-- -----------------------------------------------------------------------------
-- S3 Paper analysis (versioned)
-- -----------------------------------------------------------------------------
create table public.paper_analyses (
  id                  uuid primary key default gen_random_uuid(),
  paper_id            uuid not null references public.papers (id),
  project_id          uuid not null references public.projects (id),
  version             int not null check (version >= 1),
  problem_addressed   text check (problem_addressed is null or char_length(problem_addressed) <= 10000),
  research_objectives text check (research_objectives is null or char_length(research_objectives) <= 10000),
  methodology         text check (methodology is null or char_length(methodology) <= 10000),
  datasets            text check (datasets is null or char_length(datasets) <= 10000),
  tools               text check (tools is null or char_length(tools) <= 10000),
  algorithms          text check (algorithms is null or char_length(algorithms) <= 10000),
  reported_results    text check (reported_results is null or char_length(reported_results) <= 10000),
  limitations         text check (limitations is null or char_length(limitations) <= 10000),
  research_gaps       text check (research_gaps is null or char_length(research_gaps) <= 10000),
  own_understanding   text check (own_understanding is null or char_length(own_understanding) <= 10000),
  status              public.record_status not null default 'draft',
  submitted_at        timestamptz,
  decided_by          uuid references public.profiles (id),
  decided_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (paper_id, version)
);
create unique index paper_analyses_one_approved on public.paper_analyses (project_id) where status = 'approved';
create index paper_analyses_project_idx on public.paper_analyses (project_id);
create index paper_analyses_decided_by_idx on public.paper_analyses (decided_by);

-- -----------------------------------------------------------------------------
-- S4 Repository and execution attempts
-- -----------------------------------------------------------------------------
create table public.code_repositories (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects (id),
  paper_id             uuid not null references public.papers (id),
  repo_url             text not null check (repo_url ~* '^https://[^\s]+$'),
  owner                text check (owner is null or char_length(owner) <= 200),
  name                 text check (name is null or char_length(name) <= 200),
  commit_ref           text check (commit_ref is null or char_length(commit_ref) <= 200),
  language             text check (language is null or char_length(language) <= 200),
  framework            text check (framework is null or char_length(framework) <= 500),
  dataset_requirements text check (dataset_requirements is null or char_length(dataset_requirements) <= 5000),
  environment          text check (environment is null or char_length(environment) <= 5000),
  setup_instructions   text check (setup_instructions is null or char_length(setup_instructions) <= 10000),
  status               public.execution_status not null default 'repository_identified',
  is_current           boolean not null default true,
  submitted_at         timestamptz,
  decided_by           uuid references public.profiles (id),
  decided_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index code_repositories_one_current on public.code_repositories (project_id) where is_current;
create index code_repositories_project_idx on public.code_repositories (project_id);
create index code_repositories_paper_idx on public.code_repositories (paper_id);
create index code_repositories_decided_by_idx on public.code_repositories (decided_by);
create index code_repositories_url_idx on public.code_repositories (lower(repo_url));

create table public.execution_attempts (
  id              uuid primary key default gen_random_uuid(),
  repository_id   uuid not null references public.code_repositories (id),
  project_id      uuid not null references public.projects (id),
  attempted_at    timestamptz not null,
  outcome         public.attempt_outcome not null,
  errors          text check (errors is null or char_length(errors) <= 10000),
  debugging_notes text check (debugging_notes is null or char_length(debugging_notes) <= 10000),
  notes           text check (notes is null or char_length(notes) <= 5000),
  recorded_by     uuid not null references public.profiles (id),
  created_at      timestamptz not null default now()
);
create index execution_attempts_repository_idx on public.execution_attempts (repository_id, attempted_at);
create index execution_attempts_project_idx on public.execution_attempts (project_id);
create index execution_attempts_recorded_by_idx on public.execution_attempts (recorded_by);

-- -----------------------------------------------------------------------------
-- S5 Objective versions
-- -----------------------------------------------------------------------------
create table public.objective_versions (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects (id),
  version              int not null check (version >= 1),
  original_limitations text check (original_limitations is null or char_length(original_limitations) <= 10000),
  research_gap         text check (research_gap is null or char_length(research_gap) <= 10000),
  problem_statement    text check (problem_statement is null or char_length(problem_statement) <= 10000),
  main_objective       text check (main_objective is null or char_length(main_objective) <= 5000),
  specific_objectives  text[] not null default '{}',
  contribution         text check (contribution is null or char_length(contribution) <= 10000),
  scope                text check (scope is null or char_length(scope) <= 10000),
  exclusions           text check (exclusions is null or char_length(exclusions) <= 10000),
  evaluation_criteria  text[] not null default '{}',
  status               public.record_status not null default 'draft',
  submitted_at         timestamptz,
  decided_by           uuid references public.profiles (id),
  decided_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (project_id, version)
);
create unique index objective_versions_one_approved on public.objective_versions (project_id) where status = 'approved';
create index objective_versions_decided_by_idx on public.objective_versions (decided_by);

-- -----------------------------------------------------------------------------
-- Evidence links (Google Drive, GitHub, …). Only https links are stored (SEC-12).
-- -----------------------------------------------------------------------------
create table public.evidence (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id),
  category          public.evidence_category not null,
  url               text not null check (url ~* '^https://[^\s]+$' and char_length(url) <= 2000),
  description       text not null check (char_length(btrim(description)) between 10 and 1000),
  stage_key         public.stage_key not null,
  task_id           uuid,
  linked_type       text check (linked_type is null or linked_type in ('execution_attempt')),
  linked_id         uuid,
  verification      public.evidence_verification not null default 'unverified',
  verified_by       uuid references public.profiles (id),
  verified_at       timestamptz,
  verification_note text check (verification_note is null or char_length(verification_note) <= 1000),
  created_by        uuid not null references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((linked_type is null) = (linked_id is null))
);
create index evidence_project_idx on public.evidence (project_id, category);
create index evidence_stage_idx on public.evidence (project_id, stage_key);
create index evidence_linked_idx on public.evidence (linked_id);
create index evidence_verified_by_idx on public.evidence (verified_by);
create index evidence_created_by_idx on public.evidence (created_by);

-- -----------------------------------------------------------------------------
-- Reviews (immutable) and corrections
-- -----------------------------------------------------------------------------
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id),
  target_type  public.review_target not null,
  target_id    uuid not null,
  reviewer_id  uuid not null references public.profiles (id),
  outcome      public.review_outcome not null,
  observations text check (observations is null or char_length(observations) <= 10000),
  comments     text check (comments is null or char_length(comments) <= 10000),
  created_at   timestamptz not null default now()
);
create index reviews_target_idx on public.reviews (target_type, target_id);
create index reviews_project_idx on public.reviews (project_id, created_at);
create index reviews_reviewer_idx on public.reviews (reviewer_id, created_at);

create table public.corrections (
  id                uuid primary key default gen_random_uuid(),
  review_id         uuid not null references public.reviews (id),
  project_id        uuid not null references public.projects (id),
  target_type       public.review_target not null,
  target_id         uuid not null,
  description       text not null check (char_length(btrim(description)) between 3 and 2000),
  status            public.correction_status not null default 'open',
  student_response  text check (student_response is null or char_length(student_response) <= 5000),
  response_evidence uuid[] not null default '{}',
  addressed_at      timestamptz,
  resolved_by       uuid references public.profiles (id),
  resolved_at       timestamptz,
  resolution_note   text check (resolution_note is null or char_length(resolution_note) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index corrections_project_idx on public.corrections (project_id, status);
create index corrections_target_idx on public.corrections (target_type, target_id);
create index corrections_review_idx on public.corrections (review_id);
create index corrections_resolved_by_idx on public.corrections (resolved_by);

-- -----------------------------------------------------------------------------
-- HOD override of the "objectives approved" gate for S6 (used from Phase 5)
-- -----------------------------------------------------------------------------
alter table public.projects
  add column objective_gate_override_reason text,
  add column objective_gate_override_by uuid references public.profiles (id),
  add column objective_gate_override_at timestamptz;
create index projects_objective_override_by_idx on public.projects (objective_gate_override_by);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger research_explorations_updated_at before update on public.research_explorations for each row execute function app.set_updated_at();
create trigger papers_updated_at before update on public.papers for each row execute function app.set_updated_at();
create trigger paper_analyses_updated_at before update on public.paper_analyses for each row execute function app.set_updated_at();
create trigger code_repositories_updated_at before update on public.code_repositories for each row execute function app.set_updated_at();
create trigger objective_versions_updated_at before update on public.objective_versions for each row execute function app.set_updated_at();
create trigger evidence_updated_at before update on public.evidence for each row execute function app.set_updated_at();
create trigger corrections_updated_at before update on public.corrections for each row execute function app.set_updated_at();

-- History that must never change.
create trigger reviews_immutable before update or delete on public.reviews
  for each row execute function app.prevent_mutation();
create trigger execution_attempts_immutable before update or delete on public.execution_attempts
  for each row execute function app.prevent_mutation();

select app.enable_audit('public.research_explorations');
select app.enable_audit('public.papers');
select app.enable_audit('public.paper_analyses');
select app.enable_audit('public.code_repositories');
select app.enable_audit('public.execution_attempts');
select app.enable_audit('public.objective_versions');
select app.enable_audit('public.evidence');
select app.enable_audit('public.reviews');
select app.enable_audit('public.corrections');
