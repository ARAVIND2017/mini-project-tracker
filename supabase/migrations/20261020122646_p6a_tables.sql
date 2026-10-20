-- Phase 6 — Implementation, evaluation, writing and final stages S6–S9 (part A: tables)
-- Specs: DATABASE_SPEC.md §5 (S6–S9) and §8 (panels and sign-off), WORKFLOW_SPEC.md §2.1 and §7.
-- As before: no table write privileges for API roles, nothing is deleted (items are
-- dropped, versions superseded, panel members and projects switched off).

-- -----------------------------------------------------------------------------
-- S6 Implementation items (planned vs completed work, with commit links)
-- -----------------------------------------------------------------------------
create table public.implementation_items (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id),
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  type         public.implementation_type not null,
  is_planned   boolean not null default true,
  status       public.item_status not null default 'planned',
  commit_links text[] not null default '{}',
  notes        text check (notes is null or char_length(notes) <= 5000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (status <> 'dropped' or notes is not null)
);
create index implementation_items_project_idx on public.implementation_items (project_id);

-- -----------------------------------------------------------------------------
-- S7 Evaluation results: baseline (the original work) vs proposed (the student's own),
-- each with required evidence (DATA-08). Reviewed together as one set per project.
-- -----------------------------------------------------------------------------
create table public.evaluation_results (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id),
  kind              public.evaluation_kind not null,
  test_case         text not null check (char_length(btrim(test_case)) between 1 and 1000),
  expected          text not null check (char_length(btrim(expected)) between 1 and 2000),
  actual            text not null check (char_length(btrim(actual)) between 1 and 2000),
  metric_name       text check (metric_name is null or char_length(metric_name) <= 100),
  metric_value      numeric,
  passed            boolean not null,
  evidence_id       uuid not null references public.evidence (id),
  corrective_action text check (corrective_action is null or char_length(corrective_action) <= 2000),
  status            public.record_status not null default 'draft',
  submitted_at      timestamptz,
  decided_by        uuid references public.profiles (id),
  decided_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (passed or corrective_action is not null),
  check ((metric_name is null) = (metric_value is null))
);
create index evaluation_results_project_idx on public.evaluation_results (project_id, kind);
create index evaluation_results_evidence_idx on public.evaluation_results (evidence_id);
create index evaluation_results_decided_by_idx on public.evaluation_results (decided_by);

-- -----------------------------------------------------------------------------
-- S8 Paper draft sections (versioned, each approved on its own)
-- -----------------------------------------------------------------------------
create table public.paper_drafts (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id),
  section      public.draft_section not null,
  version      int not null check (version >= 1),
  doc_url      text check (doc_url is null or (doc_url ~* '^https://[^\s]+$' and char_length(doc_url) <= 2000)),
  notes        text check (notes is null or char_length(notes) <= 5000),
  status       public.record_status not null default 'draft',
  submitted_at timestamptz,
  decided_by   uuid references public.profiles (id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, section, version)
);
create unique index paper_drafts_one_approved on public.paper_drafts (project_id, section) where status = 'approved';
create index paper_drafts_decided_by_idx on public.paper_drafts (decided_by);

-- -----------------------------------------------------------------------------
-- S9 Final checklist (one row per deliverable; the source ZIP only if the semester requires it)
-- -----------------------------------------------------------------------------
create table public.final_deliverables (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id),
  item              public.deliverable_item not null,
  evidence_id       uuid references public.evidence (id),
  verification      public.evidence_verification not null default 'unverified',
  verified_by       uuid references public.profiles (id),
  verified_at       timestamptz,
  verification_note text check (verification_note is null or char_length(verification_note) <= 1000),
  notes             text check (notes is null or char_length(notes) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (project_id, item)
);
create index final_deliverables_evidence_idx on public.final_deliverables (evidence_id);
create index final_deliverables_verified_by_idx on public.final_deliverables (verified_by);

-- -----------------------------------------------------------------------------
-- Panels and sign-off
-- -----------------------------------------------------------------------------
create table public.panels (
  id          uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index panels_semester_name_key on public.panels (semester_id, lower(btrim(name)));

create table public.panel_members (
  id         uuid primary key default gen_random_uuid(),
  panel_id   uuid not null references public.panels (id),
  user_id    uuid not null references public.profiles (id),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (panel_id, user_id)
);
create index panel_members_user_idx on public.panel_members (user_id);

create table public.panel_projects (
  id         uuid primary key default gen_random_uuid(),
  panel_id   uuid not null references public.panels (id),
  project_id uuid not null references public.projects (id),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (panel_id, project_id)
);
-- A project sits on at most one active panel.
create unique index panel_projects_one_active on public.panel_projects (project_id) where is_active;

create table public.final_signoffs (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects (id),
  panel_member_id    uuid not null references public.profiles (id),
  decision           public.signoff_decision not null,
  originality_remark text not null check (char_length(btrim(originality_remark)) between 10 and 2000),
  comments           text check (comments is null or char_length(comments) <= 5000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (project_id, panel_member_id)
);
create index final_signoffs_member_idx on public.final_signoffs (panel_member_id);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger implementation_items_updated_at before update on public.implementation_items for each row execute function app.set_updated_at();
create trigger evaluation_results_updated_at before update on public.evaluation_results for each row execute function app.set_updated_at();
create trigger paper_drafts_updated_at before update on public.paper_drafts for each row execute function app.set_updated_at();
create trigger final_deliverables_updated_at before update on public.final_deliverables for each row execute function app.set_updated_at();
create trigger panels_updated_at before update on public.panels for each row execute function app.set_updated_at();
create trigger panel_members_updated_at before update on public.panel_members for each row execute function app.set_updated_at();
create trigger panel_projects_updated_at before update on public.panel_projects for each row execute function app.set_updated_at();
create trigger final_signoffs_updated_at before update on public.final_signoffs for each row execute function app.set_updated_at();

-- Every project has its final checklist rows.
create or replace function app.ensure_deliverables(p_project_id uuid)
returns void language sql set search_path = '' as $$
  insert into public.final_deliverables (project_id, item)
  select p.id, i
  from public.projects p
  join public.semesters s on s.id = p.semester_id
  cross join unnest(enum_range(null::public.deliverable_item)) i
  where p.id = p_project_id and (i <> 'source_zip' or s.require_source_zip)
  on conflict (project_id, item) do nothing;
$$;

create or replace function app.project_ensure_deliverables()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform app.ensure_deliverables(new.id);
  return null;
end;
$$;
create trigger projects_ensure_deliverables after insert on public.projects
  for each row execute function app.project_ensure_deliverables();

select app.ensure_deliverables(id) from public.projects;

select app.enable_audit('public.implementation_items');
select app.enable_audit('public.evaluation_results');
select app.enable_audit('public.paper_drafts');
select app.enable_audit('public.final_deliverables');
select app.enable_audit('public.panels');
select app.enable_audit('public.panel_members');
select app.enable_audit('public.panel_projects');
select app.enable_audit('public.final_signoffs');
