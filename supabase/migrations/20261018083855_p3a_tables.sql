-- Phase 3 — Students, domains and assignments (part A: tables)
-- Specs: DATABASE_SPEC.md §3–§4, USER_ROLES_AND_PERMISSIONS.md §2.2.
-- Nothing here is ever hard-deleted: rows are deactivated (is_active), revoked or
-- withdrawn, so the history stays visible.

-- -----------------------------------------------------------------------------
-- Configuration: domains, evaluation criteria, faculty expertise
-- -----------------------------------------------------------------------------
create table public.domains (
  id          uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index domains_semester_name_key on public.domains (semester_id, lower(btrim(name)));

create table public.evaluation_criteria (
  id          uuid primary key default gen_random_uuid(),
  domain_id   uuid not null references public.domains (id),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index evaluation_criteria_domain_idx on public.evaluation_criteria (domain_id, sort_order);

create table public.faculty_expertise (
  id          uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id),
  user_id     uuid not null references public.profiles (id),
  domain_id   uuid not null references public.domains (id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, domain_id)
);
create index faculty_expertise_semester_idx on public.faculty_expertise (semester_id);
create index faculty_expertise_domain_idx on public.faculty_expertise (domain_id);

-- -----------------------------------------------------------------------------
-- Roster and projects
-- -----------------------------------------------------------------------------
create table public.students (
  id               uuid primary key default gen_random_uuid(),
  semester_id      uuid not null references public.semesters (id),
  slot_no          int not null check (slot_no between 1 and 999),
  institution_id   text check (institution_id is null or char_length(institution_id) between 1 and 40),
  full_name        text check (full_name is null or char_length(full_name) between 1 and 120),
  email            extensions.citext check (email is null or email::text ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  user_id          uuid references public.profiles (id),
  drive_folder_url text check (drive_folder_url is null or drive_folder_url ~* '^https://[^\s]+$'),
  status           public.roster_status not null default 'empty',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (semester_id, slot_no),
  check (status <> 'empty' or (user_id is null and full_name is null and email is null and institution_id is null))
);
create unique index students_semester_institution_key on public.students (semester_id, lower(institution_id))
  where institution_id is not null;
create unique index students_semester_email_key on public.students (semester_id, email) where email is not null;
create unique index students_semester_user_key on public.students (semester_id, user_id) where user_id is not null;
create index students_user_idx on public.students (user_id);

create table public.student_drive_folders (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  week_no    int not null check (week_no between 1 and 30),
  url        text not null check (url ~* '^https://[^\s]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, week_no)
);

create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  semester_id    uuid not null references public.semesters (id),
  student_id     uuid not null unique references public.students (id),
  domain_id      uuid references public.domains (id),
  title          text check (title is null or char_length(btrim(title)) between 1 and 300),
  guide_id       uuid references public.profiles (id),
  is_completed   boolean not null default false,
  completed_at   timestamptz,
  blocked        boolean not null default false,
  blocked_reason text check (blocked_reason is null or char_length(blocked_reason) <= 1000),
  blocked_at     timestamptz,
  blocked_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index projects_semester_idx on public.projects (semester_id);
create index projects_guide_idx on public.projects (guide_id);
create index projects_domain_idx on public.projects (domain_id);
create index projects_blocked_by_idx on public.projects (blocked_by);

create table public.project_stages (
  project_id       uuid not null references public.projects (id),
  stage_key        public.stage_key not null,
  status           public.stage_status not null default 'not_started',
  approved_by      uuid references public.profiles (id),
  approved_at      timestamptz,
  exception_reason text,
  updated_at       timestamptz not null default now(),
  primary key (project_id, stage_key)
);
create index project_stages_approved_by_idx on public.project_stages (approved_by);

create table public.project_reviewers (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id),
  user_id           uuid not null references public.profiles (id),
  is_active         boolean not null default true,
  added_via_request uuid,
  added_by          uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_reviewers_user_idx on public.project_reviewers (user_id);
create index project_reviewers_added_by_idx on public.project_reviewers (added_by);

create table public.assignment_requests (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id),
  type          public.assignment_type not null,
  faculty_id    uuid not null references public.profiles (id),
  requested_by  uuid not null references public.profiles (id),
  reason        text not null check (char_length(btrim(reason)) between 5 and 1000),
  status        public.request_status not null default 'pending',
  decided_by    uuid references public.profiles (id),
  decided_at    timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index assignment_requests_one_pending
  on public.assignment_requests (project_id, type, faculty_id) where status = 'pending';
create index assignment_requests_project_idx on public.assignment_requests (project_id);
create index assignment_requests_faculty_idx on public.assignment_requests (faculty_id);
create index assignment_requests_requested_by_idx on public.assignment_requests (requested_by);
create index assignment_requests_decided_by_idx on public.assignment_requests (decided_by);
create index assignment_requests_status_idx on public.assignment_requests (status);

alter table public.project_reviewers
  add constraint project_reviewers_request_fkey foreign key (added_via_request) references public.assignment_requests (id);
create index project_reviewers_request_idx on public.project_reviewers (added_via_request);

create table public.review_authorizations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id),
  faculty_id  uuid not null references public.profiles (id),
  granted_by  uuid not null references public.profiles (id),
  valid_until timestamptz,
  note        text check (note is null or char_length(note) <= 1000),
  revoked_at  timestamptz,
  revoked_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index review_authorizations_project_idx on public.review_authorizations (project_id);
create index review_authorizations_faculty_idx on public.review_authorizations (faculty_id);
create index review_authorizations_granted_by_idx on public.review_authorizations (granted_by);
create index review_authorizations_revoked_by_idx on public.review_authorizations (revoked_by);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger domains_updated_at before update on public.domains for each row execute function app.set_updated_at();
create trigger evaluation_criteria_updated_at before update on public.evaluation_criteria for each row execute function app.set_updated_at();
create trigger faculty_expertise_updated_at before update on public.faculty_expertise for each row execute function app.set_updated_at();
create trigger students_updated_at before update on public.students for each row execute function app.set_updated_at();
create trigger student_drive_folders_updated_at before update on public.student_drive_folders for each row execute function app.set_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function app.set_updated_at();
create trigger project_stages_updated_at before update on public.project_stages for each row execute function app.set_updated_at();
create trigger project_reviewers_updated_at before update on public.project_reviewers for each row execute function app.set_updated_at();
create trigger assignment_requests_updated_at before update on public.assignment_requests for each row execute function app.set_updated_at();

-- Roster status follows the data: empty / no account yet / account linked. Withdrawn is kept.
create or replace function app.derive_student_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'withdrawn' then
    return new;
  end if;
  new.status := case
    when new.user_id is not null then 'active'
    when new.full_name is null and new.email is null and new.institution_id is null then 'empty'
    else 'pending_invite'
  end::public.roster_status;
  return new;
end;
$$;

create trigger students_derive_status before insert or update on public.students
  for each row execute function app.derive_student_status();

-- Capacity: filled roster rows may not exceed the semester capacity. Checked at
-- commit so that one import can empty a slot and fill another.
create or replace function app.check_roster_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_filled int;
  v_capacity int;
begin
  select count(*) into v_filled from public.students
  where semester_id = new.semester_id and status <> 'empty';
  select max_students into v_capacity from public.semesters where id = new.semester_id;
  if v_filled > v_capacity then
    perform app.raise_error('CAPACITY_EXCEEDED',
      format('The roster has %s students but the semester capacity is %s', v_filled, v_capacity));
  end if;
  return null;
end;
$$;

create constraint trigger students_capacity after insert or update on public.students
  deferrable initially deferred
  for each row execute function app.check_roster_capacity();

select app.enable_audit('public.domains');
select app.enable_audit('public.evaluation_criteria');
select app.enable_audit('public.faculty_expertise');
select app.enable_audit('public.students');
select app.enable_audit('public.student_drive_folders');
select app.enable_audit('public.projects');
select app.enable_audit('public.project_stages');
select app.enable_audit('public.project_reviewers');
select app.enable_audit('public.assignment_requests');
select app.enable_audit('public.review_authorizations');
