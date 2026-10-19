-- Phase 5 — Weekly tasks, submissions, reviews and resubmissions (part A: tables)
-- Specs: DATABASE_SPEC.md §3 (milestones, task templates) and §6 (tasks, submissions),
-- WORKFLOW_SPEC.md §3.4 and §4, WEEKLY_MILESTONE_PLAN.md.

-- -----------------------------------------------------------------------------
-- The semester plan: one milestone per week and the task templates
-- -----------------------------------------------------------------------------
create table public.milestones (
  id                  uuid primary key default gen_random_uuid(),
  semester_id         uuid not null references public.semesters (id),
  week_no             int not null check (week_no between 1 and 30),
  title               text not null check (char_length(btrim(title)) between 1 and 200),
  stage_key           public.stage_key not null,
  description         text check (description is null or char_length(description) <= 2000),
  is_gate             boolean not null default false,
  checkpoint          text check (checkpoint is null or char_length(checkpoint) <= 300),
  start_date_override date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (semester_id, week_no)
);

create table public.task_templates (
  id                   uuid primary key default gen_random_uuid(),
  semester_id          uuid not null references public.semesters (id),
  week_no              int not null check (week_no between 1 and 30),
  stage_key            public.stage_key not null,
  -- null = every domain; otherwise only projects in this domain.
  domain_id            uuid references public.domains (id),
  -- A domain template can replace a generic one for that domain.
  replaces_template_id uuid references public.task_templates (id),
  title                text not null check (char_length(btrim(title)) between 1 and 200),
  description          text check (description is null or char_length(description) <= 5000),
  acceptance_criteria  text[] not null check (cardinality(acceptance_criteria) >= 1),
  required_evidence    public.evidence_category[] not null default '{}',
  sort_order           int not null default 0,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (replaces_template_id is null or domain_id is not null),
  check (replaces_template_id is distinct from id)
);
create index task_templates_semester_idx on public.task_templates (semester_id, week_no, sort_order);
create index task_templates_domain_idx on public.task_templates (domain_id);
create index task_templates_replaces_idx on public.task_templates (replaces_template_id);

-- -----------------------------------------------------------------------------
-- Tasks (one per project and template) and their submissions
-- -----------------------------------------------------------------------------
create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id),
  template_id         uuid references public.task_templates (id),
  week_no             int not null check (week_no between 1 and 30),
  stage_key           public.stage_key not null,
  title               text not null check (char_length(btrim(title)) between 1 and 200),
  description         text,
  acceptance_criteria text[] not null default '{}',
  required_evidence   public.evidence_category[] not null default '{}',
  due_at              timestamptz not null,
  status              public.task_status not null default 'not_started',
  -- A task whose template no longer applies (and that has no submission) is switched off.
  is_active           boolean not null default true,
  blocked             boolean not null default false,
  blocked_reason      text check (blocked_reason is null or char_length(blocked_reason) <= 1000),
  blocked_at          timestamptz,
  blocked_by          uuid references public.profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (not blocked or blocked_reason is not null)
);
create unique index tasks_project_template_key on public.tasks (project_id, template_id) where template_id is not null;
create index tasks_project_week_idx on public.tasks (project_id, week_no);
create index tasks_status_due_idx on public.tasks (status, due_at);
create index tasks_template_idx on public.tasks (template_id);
create index tasks_blocked_by_idx on public.tasks (blocked_by);

create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks (id),
  project_id      uuid not null references public.projects (id),
  version         int not null check (version >= 1),
  progress_report text not null check (char_length(btrim(progress_report)) between 100 and 10000),
  submitted_by    uuid not null references public.profiles (id),
  submitted_at    timestamptz not null default now(),
  -- Recorded once, against the deadline at the moment of submission (FUN-10).
  is_late         boolean not null,
  due_at_snapshot timestamptz not null,
  unique (task_id, version)
);
create index submissions_project_idx on public.submissions (project_id, submitted_at);
create index submissions_submitted_by_idx on public.submissions (submitted_by);

create table public.submission_evidence (
  submission_id uuid not null references public.submissions (id),
  evidence_id   uuid not null references public.evidence (id),
  primary key (submission_id, evidence_id)
);
create index submission_evidence_evidence_idx on public.submission_evidence (evidence_id);

alter table public.evidence
  add constraint evidence_task_fkey foreign key (task_id) references public.tasks (id);
create index evidence_task_idx on public.evidence (task_id);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger milestones_updated_at before update on public.milestones for each row execute function app.set_updated_at();
create trigger task_templates_updated_at before update on public.task_templates for each row execute function app.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function app.set_updated_at();

-- Submissions are history (DATA-07).
create trigger submissions_immutable before update or delete on public.submissions
  for each row execute function app.prevent_mutation();
create trigger submission_evidence_immutable before update or delete on public.submission_evidence
  for each row execute function app.prevent_mutation();

select app.enable_audit('public.milestones');
select app.enable_audit('public.task_templates');
select app.enable_audit('public.tasks');
select app.enable_audit('public.submissions');
