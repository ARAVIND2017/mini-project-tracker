-- Phase 3 — Students, domains and assignments (part C: domains, criteria, expertise)
-- Specs: API_SPEC.md §4.1–§4.2, PRD F4.

-- Shared guard: the semester exists and is not closed.
create or replace function app.require_open_semester(p_semester_id uuid)
returns public.semesters language plpgsql stable set search_path = '' as $$
declare
  v_semester public.semesters;
begin
  select * into v_semester from public.semesters where id = p_semester_id;
  if not found then
    perform app.raise_error('NOT_FOUND', 'Semester not found');
  end if;
  if v_semester.status = 'closed' then
    perform app.raise_error('INVALID_STATE', 'A closed semester cannot be changed');
  end if;
  return v_semester;
end;
$$;

-- -----------------------------------------------------------------------------
-- Domains (HOD, or admin with manage_config)
-- -----------------------------------------------------------------------------
create or replace function public.app_upsert_domain(
  p_semester_id uuid,
  p_name text,
  p_description text default null,
  p_is_active boolean default true,
  p_domain_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_config') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can manage domains');
  end if;
  perform app.require_open_semester(p_semester_id);
  begin
    if p_domain_id is null then
      insert into public.domains (semester_id, name, description, is_active)
      values (p_semester_id, btrim(p_name), nullif(btrim(p_description), ''), coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.domains
      set name = btrim(p_name), description = nullif(btrim(p_description), ''), is_active = coalesce(p_is_active, true)
      where id = p_domain_id and semester_id = p_semester_id
      returning id into v_id;
      if v_id is null then
        perform app.raise_error('NOT_FOUND', 'Domain not found');
      end if;
    end if;
  exception
    when unique_violation then
      perform app.raise_error('VALIDATION', 'A domain with this name already exists in the semester', 'name');
    when check_violation or not_null_violation then
      perform app.raise_error('VALIDATION', 'Domain name must be 1–120 characters', 'name');
  end;
  perform app.log_action('domain.saved', 'domains', v_id, null, p_semester_id,
    jsonb_build_object('name', p_name, 'is_active', p_is_active));
  return v_id;
end;
$$;

create or replace function public.app_upsert_criterion(
  p_domain_id uuid,
  p_name text,
  p_description text default null,
  p_sort_order int default 0,
  p_is_active boolean default true,
  p_criterion_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester_id uuid;
  v_id uuid;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_config') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can manage evaluation criteria');
  end if;
  select semester_id into v_semester_id from public.domains where id = p_domain_id;
  if v_semester_id is null then
    perform app.raise_error('NOT_FOUND', 'Domain not found');
  end if;
  perform app.require_open_semester(v_semester_id);
  begin
    if p_criterion_id is null then
      insert into public.evaluation_criteria (domain_id, name, description, sort_order, is_active)
      values (p_domain_id, btrim(p_name), nullif(btrim(p_description), ''), coalesce(p_sort_order, 0), coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.evaluation_criteria
      set name = btrim(p_name), description = nullif(btrim(p_description), ''),
          sort_order = coalesce(p_sort_order, 0), is_active = coalesce(p_is_active, true)
      where id = p_criterion_id and domain_id = p_domain_id
      returning id into v_id;
      if v_id is null then
        perform app.raise_error('NOT_FOUND', 'Criterion not found');
      end if;
    end if;
  exception when check_violation or not_null_violation then
    perform app.raise_error('VALIDATION', 'Criterion name must be 1–120 characters', 'name');
  end;
  perform app.log_action('criterion.saved', 'evaluation_criteria', v_id, null, v_semester_id,
    jsonb_build_object('domain_id', p_domain_id, 'name', p_name, 'is_active', p_is_active));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Faculty expertise: a faculty-level user sets their own; the HOD may set anyone's.
-- Domains not listed are switched off (not deleted).
-- -----------------------------------------------------------------------------
create or replace function public.app_set_expertise(
  p_semester_id uuid,
  p_domain_ids uuid[],
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_target uuid := coalesce(p_user_id, v_uid);
  v_ids uuid[] := coalesce(p_domain_ids, '{}');
begin
  perform app.require_open_semester(p_semester_id);
  if v_target <> v_uid and not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'You can only set your own expertise');
  end if;
  if not app.is_faculty_member(v_target, p_semester_id) then
    perform app.raise_error('FORBIDDEN', 'Only faculty of this semester can record expertise');
  end if;
  if exists (select 1 from unnest(v_ids) d(id)
             where not exists (select 1 from public.domains x
                               where x.id = d.id and x.semester_id = p_semester_id and x.is_active)) then
    perform app.raise_error('VALIDATION', 'Choose active domains of this semester', 'domain_ids');
  end if;

  update public.faculty_expertise
  set is_active = (domain_id = any (v_ids))
  where user_id = v_target and semester_id = p_semester_id
    and is_active is distinct from (domain_id = any (v_ids));

  insert into public.faculty_expertise (semester_id, user_id, domain_id)
  select p_semester_id, v_target, d.id from unnest(v_ids) d(id)
  on conflict (user_id, domain_id) do update set is_active = true;

  perform app.log_action('expertise.set', 'faculty_expertise', v_target, null, p_semester_id,
    jsonb_build_object('user_id', v_target, 'domain_ids', to_jsonb(v_ids)));
end;
$$;

-- -----------------------------------------------------------------------------
-- Semester rules extended for Phase 3
-- -----------------------------------------------------------------------------
-- Capacity cannot be lowered below the number of students already on the roster.
create or replace function app.validate_semester()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_keys text[];
  v_expected text[] := array(select unnest(enum_range(null::public.stage_key))::text order by 1);
  v_total numeric;
  v_filled int;
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

  if tg_op = 'UPDATE' and new.max_students < old.max_students then
    select count(*) into v_filled from public.students where semester_id = new.id and status <> 'empty';
    if new.max_students < v_filled then
      perform app.raise_error('VALIDATION',
        format('Capacity cannot be lower than the %s students already on the roster', v_filled), 'max_students');
    end if;
  end if;
  return new;
end;
$$;

-- Activation now also needs at least one active domain.
create or replace function public.app_activate_semester(p_semester_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester public.semesters;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_config') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can activate a semester');
  end if;
  v_semester := app.semester_for_update(p_semester_id);
  if v_semester.status <> 'draft' then
    perform app.raise_error('INVALID_STATE', 'Only a draft semester can be activated');
  end if;
  if v_semester.start_date is null then
    perform app.raise_error('GATE_NOT_MET', 'Set the semester start date (first lab day) first', 'start_date');
  end if;
  if app.active_lead_membership(p_semester_id) is null then
    perform app.raise_error('GATE_NOT_MET', 'Appoint a lead faculty first', 'lead_faculty');
  end if;
  if not exists (select 1 from public.domains where semester_id = p_semester_id and is_active) then
    perform app.raise_error('GATE_NOT_MET', 'Add at least one project domain first', 'domains');
  end if;
  update public.semesters set status = 'active' where id = p_semester_id;
  perform app.log_action('semester.activated', 'semesters', p_semester_id, null, p_semester_id);
end;
$$;
