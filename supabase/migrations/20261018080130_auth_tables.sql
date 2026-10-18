-- =============================================================================
-- Phase 2 — Authentication and faculty hierarchy
-- profiles, system_roles, semesters, memberships; permission helpers; RLS;
-- workflow RPCs for semesters, roles and accounts.
-- Specs: USER_ROLES_AND_PERMISSIONS.md, DATABASE_SPEC.md §2, API_SPEC.md §4.1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 120),
  email       extensions.citext not null unique,
  designation text check (designation is null or char_length(designation) <= 80),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.system_roles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  role              public.system_role not null,
  admin_permissions text[] not null default '{}'
    check (admin_permissions <@ array['manage_users', 'manage_config', 'manage_roster']::text[]),
  granted_by        uuid references public.profiles (id),
  granted_at        timestamptz not null default now(),
  unique (user_id, role),
  check (role = 'admin' or admin_permissions = '{}')
);

create table public.semesters (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null check (char_length(btrim(name)) between 1 and 120),
  academic_year            text check (academic_year is null or char_length(academic_year) <= 20),
  status                   public.semester_status not null default 'draft',
  start_date               date,
  week_count               int not null default 16 check (week_count between 1 and 30),
  timezone                 text not null default 'Asia/Kolkata',
  lab_weekday              smallint not null default 2 check (lab_weekday between 1 and 7),
  lab_start                time not null default '14:00',
  lab_end                  time not null default '16:40',
  submission_weekday       smallint not null default 1 check (submission_weekday between 1 and 7),
  submission_time          time not null default '23:59',
  review_weekday           smallint not null default 4 check (review_weekday between 1 and 7),
  review_time              time not null default '23:59',
  target_paper_year        int not null default 2026 check (target_paper_year between 2000 and 2100),
  max_students             int not null default 30 check (max_students between 1 and 500),
  stage_weights            jsonb not null default '{"exploration": 5, "paper_selection": 10,
    "paper_analysis": 10, "code_execution": 15, "objectives": 10, "implementation": 20,
    "evaluation": 10, "paper_writing": 10, "final": 10}'::jsonb,
  panel_quorum             int check (panel_quorum is null or panel_quorum >= 1),
  paper_change_cutoff_week int not null default 4 check (paper_change_cutoff_week >= 1),
  require_source_zip       boolean not null default true,
  created_by               uuid references public.profiles (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint semesters_lab_time_order check (lab_end > lab_start),
  constraint semesters_cutoff_within_weeks check (paper_change_cutoff_week <= week_count)
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id),
  user_id     uuid not null references public.profiles (id),
  role        public.semester_role not null,
  reports_to  uuid references public.memberships (id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (semester_id, user_id),
  check (role = 'faculty' or reports_to is null)
);

create unique index memberships_one_active_lead
  on public.memberships (semester_id) where role = 'lead_faculty' and is_active;
create index memberships_user_idx on public.memberships (user_id);
create index memberships_reports_to_idx on public.memberships (reports_to);
create index system_roles_granted_by_idx on public.system_roles (granted_by);
create index semesters_created_by_idx on public.semesters (created_by);

-- -----------------------------------------------------------------------------
-- Integrity triggers
-- -----------------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();
create trigger semesters_updated_at before update on public.semesters
  for each row execute function app.set_updated_at();
create trigger memberships_updated_at before update on public.memberships
  for each row execute function app.set_updated_at();

-- Users may edit their own name/designation; activity and email are system-managed.
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function app.guard_protected_columns('is_active=true', 'email=');

create or replace function app.validate_semester()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_keys text[];
  v_expected text[] := array(select unnest(enum_range(null::public.stage_key))::text order by 1);
  v_total numeric;
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    perform app.raise_error('VALIDATION', format('Unknown timezone "%s"', new.timezone), 'timezone');
  end if;

  if jsonb_typeof(new.stage_weights) <> 'object' then
    perform app.raise_error('VALIDATION', 'Stage weights must be an object', 'stage_weights');
  end if;
  v_keys := array(select jsonb_object_keys(new.stage_weights) order by 1);
  if v_keys is distinct from v_expected then
    perform app.raise_error('VALIDATION', 'Stage weights must list each of the nine stages exactly once', 'stage_weights');
  end if;
  if exists (select 1 from jsonb_each(new.stage_weights) w
             where jsonb_typeof(w.value) <> 'number' or (w.value)::numeric < 0
                or (w.value)::numeric <> trunc((w.value)::numeric)) then
    perform app.raise_error('VALIDATION', 'Stage weights must be whole numbers of 0 or more', 'stage_weights');
  end if;
  select sum((w.value)::numeric) into v_total from jsonb_each(new.stage_weights) w;
  if v_total <> 100 then
    perform app.raise_error('VALIDATION', format('Stage weights must total 100 (currently %s)', v_total), 'stage_weights');
  end if;
  return new;
end;
$$;

create trigger semesters_validate before insert or update on public.semesters
  for each row execute function app.validate_semester();

create or replace function app.protect_last_hod()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'hod' and not exists (
    select 1 from public.system_roles r join public.profiles p on p.id = r.user_id
    where r.role = 'hod' and r.id <> old.id and p.is_active
  ) then
    perform app.raise_error('INVALID_STATE', 'The last active HOD cannot be removed');
  end if;
  return old;
end;
$$;

create trigger system_roles_protect_last_hod before delete on public.system_roles
  for each row execute function app.protect_last_hod();

-- New auth user → profile. Invites pass full_name in user metadata.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, designation)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'designation'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

select app.enable_audit('public.profiles');
select app.enable_audit('public.system_roles');
select app.enable_audit('public.semesters');
select app.enable_audit('public.memberships');

