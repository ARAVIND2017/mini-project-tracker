-- Phase 3 — Students, domains and assignments (part D1: roster import)
-- Specs: API_SPEC.md §4.1 (app_import_roster), PRD F3 (AC3.1–AC3.5).
-- Roster values are stored exactly as supplied (only surrounding spaces are trimmed;
-- an empty cell means "no value"). Nothing is ever invented.

-- Every filled roster entry has exactly one project with its nine stages.
create or replace function app.ensure_project(p_student_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_student public.students;
  v_project_id uuid;
begin
  select * into v_student from public.students where id = p_student_id;
  if v_student.status = 'empty' then
    return null;
  end if;
  select id into v_project_id from public.projects where student_id = p_student_id;
  if v_project_id is null then
    insert into public.projects (semester_id, student_id) values (v_student.semester_id, p_student_id)
    returning id into v_project_id;
    insert into public.project_stages (project_id, stage_key)
    select v_project_id, k from unnest(enum_range(null::public.stage_key)) k;
  end if;
  return v_project_id;
end;
$$;

-- Validates one roster field set; returns an error message or null.
create or replace function app.roster_field_error(
  p_institution_id text, p_full_name text, p_email text, p_drive_url text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_full_name is not null and char_length(p_full_name) > 120 then 'Name is longer than 120 characters'
    when p_institution_id is not null and char_length(p_institution_id) > 40 then 'Student ID is longer than 40 characters'
    when p_email is not null and p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then format('"%s" is not a valid email', p_email)
    when p_drive_url is not null and p_drive_url !~* '^https://[^\s]+$' then 'Drive link must start with https://'
    when (p_email is not null or p_institution_id is not null or p_drive_url is not null) and p_full_name is null
      then 'A filled slot needs the student''s name'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Roster import. p_rows: [{slot_no, institution_id?, full_name?, email?,
-- drive_folder_url?, domain_name?}]. With p_dry_run (default) nothing is written:
-- the report shows what would happen. A real import is all-or-nothing.
-- -----------------------------------------------------------------------------
create or replace function public.app_import_roster(
  p_semester_id uuid,
  p_rows jsonb,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semester public.semesters;
  v_row record;
  v_obj jsonb;
  v_slot int;
  v_inst text;
  v_name text;
  v_email text;
  v_drive text;
  v_domain_name text;
  v_domain_id uuid;
  v_existing public.students;
  v_error text;
  v_action text;
  v_errors jsonb := '[]'::jsonb;
  v_plan jsonb := '[]'::jsonb;
  v_slots int[] := '{}';
  v_insts text[] := '{}';
  v_emails text[] := '{}';
  v_filled_after int;
  v_counts jsonb;
  v_step jsonb;
  v_student_id uuid;
  v_project_id uuid;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_roster') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can import the roster');
  end if;
  v_semester := app.require_open_semester(p_semester_id);
  if jsonb_typeof(p_rows) is distinct from 'array' then
    perform app.raise_error('VALIDATION', 'Rows must be a list');
  end if;
  if jsonb_array_length(p_rows) = 0 then
    perform app.raise_error('VALIDATION', 'The file has no rows');
  end if;
  if jsonb_array_length(p_rows) > 999 then
    perform app.raise_error('VALIDATION', 'At most 999 rows can be imported at once');
  end if;

  for v_row in select ordinality::int as n, value from jsonb_array_elements(p_rows) with ordinality loop
    v_obj := v_row.value;
    v_error := null;
    v_action := null;
    v_domain_id := null;

    if jsonb_typeof(v_obj) <> 'object' then
      v_errors := v_errors || jsonb_build_object('row', v_row.n, 'message', 'Row is not an object');
      continue;
    end if;

    -- Slot number: required whole number 1–999, unique in the file.
    begin
      v_slot := (btrim(v_obj ->> 'slot_no'))::int;
    exception when others then
      v_slot := null;
    end;
    if v_slot is null or v_slot < 1 or v_slot > 999 then
      v_errors := v_errors || jsonb_build_object('row', v_row.n, 'message', 'Slot number must be a whole number from 1 to 999');
      continue;
    end if;
    if v_slot = any (v_slots) then
      v_errors := v_errors || jsonb_build_object('row', v_row.n, 'slot_no', v_slot, 'message', format('Slot %s appears more than once in the file', v_slot));
      continue;
    end if;
    v_slots := v_slots || v_slot;

    v_inst := nullif(btrim(v_obj ->> 'institution_id'), '');
    v_name := nullif(btrim(v_obj ->> 'full_name'), '');
    v_email := nullif(btrim(v_obj ->> 'email'), '');
    v_drive := nullif(btrim(v_obj ->> 'drive_folder_url'), '');
    v_domain_name := nullif(btrim(v_obj ->> 'domain_name'), '');

    v_error := app.roster_field_error(v_inst, v_name, v_email, v_drive);

    if v_error is null and v_domain_name is not null then
      select id into v_domain_id from public.domains
      where semester_id = p_semester_id and is_active and lower(btrim(name)) = lower(v_domain_name);
      if v_domain_id is null then
        v_error := format('Unknown domain "%s" (add it under Domains first)', v_domain_name);
      elsif v_name is null then
        v_error := 'An empty slot cannot have a domain';
      end if;
    end if;

    -- Duplicates inside the file and against other slots already on the roster.
    if v_error is null and v_inst is not null then
      if lower(v_inst) = any (v_insts) then
        v_error := format('Student ID "%s" appears more than once in the file', v_inst);
      elsif exists (select 1 from public.students where semester_id = p_semester_id and slot_no <> v_slot
                      and lower(institution_id) = lower(v_inst)) then
        v_error := format('Student ID "%s" is already used by another slot', v_inst);
      end if;
      v_insts := v_insts || lower(v_inst);
    end if;
    if v_error is null and v_email is not null then
      if lower(v_email) = any (v_emails) then
        v_error := format('Email "%s" appears more than once in the file', v_email);
      elsif exists (select 1 from public.students where semester_id = p_semester_id and slot_no <> v_slot
                      and lower(email::text) = lower(v_email)) then
        v_error := format('Email "%s" is already used by another slot', v_email);
      end if;
      v_emails := v_emails || lower(v_email);
    end if;

    select * into v_existing from public.students where semester_id = p_semester_id and slot_no = v_slot;

    if v_error is null and v_existing.id is not null then
      if v_existing.status = 'withdrawn' then
        v_error := format('Slot %s belongs to a withdrawn student and cannot be changed', v_slot);
      elsif v_name is null and v_existing.status <> 'empty' then
        v_error := format('Slot %s already has a student; an import cannot empty it', v_slot);
      elsif v_existing.user_id is not null and lower(coalesce(v_existing.email::text, '')) <> lower(coalesce(v_email, '')) then
        v_error := format('Slot %s: the email of a student who already has an account cannot change', v_slot);
      end if;
    end if;

    if v_error is not null then
      v_errors := v_errors || jsonb_build_object('row', v_row.n, 'slot_no', v_slot, 'message', v_error);
      continue;
    end if;

    if v_existing.id is null then
      v_action := 'create';
    elsif v_existing.institution_id is not distinct from v_inst
      and v_existing.full_name is not distinct from v_name
      and lower(coalesce(v_existing.email::text, '')) = lower(coalesce(v_email, ''))
      and v_existing.drive_folder_url is not distinct from v_drive
      and (v_domain_id is null or exists (select 1 from public.projects
                                          where student_id = v_existing.id and domain_id = v_domain_id)) then
      v_action := 'unchanged';
    else
      v_action := 'update';
    end if;

    v_plan := v_plan || jsonb_build_object(
      'row', v_row.n, 'slot_no', v_slot, 'action', v_action, 'filled', v_name is not null,
      'institution_id', v_inst, 'full_name', v_name, 'email', v_email,
      'drive_folder_url', v_drive, 'domain_id', v_domain_id, 'domain_name', v_domain_name);
  end loop;

  -- Capacity after the import: filled slots outside the file + filled rows in the file.
  select count(*) into v_filled_after from public.students
  where semester_id = p_semester_id and status <> 'empty' and slot_no <> all (v_slots);
  v_filled_after := v_filled_after
    + (select count(*) from jsonb_array_elements(v_plan) p where (p ->> 'filled')::boolean);

  select jsonb_build_object(
    'create', count(*) filter (where p ->> 'action' = 'create'),
    'update', count(*) filter (where p ->> 'action' = 'update'),
    'unchanged', count(*) filter (where p ->> 'action' = 'unchanged'))
  into v_counts from jsonb_array_elements(v_plan) p;

  if p_dry_run or jsonb_array_length(v_errors) > 0 or v_filled_after > v_semester.max_students then
    if not p_dry_run then
      if jsonb_array_length(v_errors) > 0 then
        perform app.raise_error('VALIDATION',
          format('%s row(s) have problems. Preview the import and fix them first.', jsonb_array_length(v_errors)));
      end if;
      perform app.raise_error('CAPACITY_EXCEEDED',
        format('The roster would have %s students but the semester capacity is %s', v_filled_after, v_semester.max_students));
    end if;
    return jsonb_build_object(
      'dry_run', true,
      'ok', jsonb_array_length(v_errors) = 0 and v_filled_after <= v_semester.max_students,
      'counts', v_counts, 'errors', v_errors, 'rows', v_plan,
      'filled_after', v_filled_after, 'capacity', v_semester.max_students);
  end if;

  -- Write the plan.
  for v_step in select value from jsonb_array_elements(v_plan) loop
    if v_step ->> 'action' = 'unchanged' then
      continue;
    end if;
    begin
      insert into public.students (semester_id, slot_no, institution_id, full_name, email, drive_folder_url)
      values (p_semester_id, (v_step ->> 'slot_no')::int, v_step ->> 'institution_id', v_step ->> 'full_name',
              v_step ->> 'email', v_step ->> 'drive_folder_url')
      on conflict (semester_id, slot_no) do update
        set institution_id = excluded.institution_id, full_name = excluded.full_name,
            email = excluded.email, drive_folder_url = excluded.drive_folder_url
      returning id into v_student_id;
    exception when unique_violation then
      perform app.raise_error('VALIDATION',
        format('Slot %s: student ID or email is already used by another slot', v_step ->> 'slot_no'));
    end;
    v_project_id := app.ensure_project(v_student_id);
    if v_project_id is not null and v_step ->> 'domain_id' is not null then
      update public.projects set domain_id = (v_step ->> 'domain_id')::uuid
      where id = v_project_id and domain_id is distinct from (v_step ->> 'domain_id')::uuid;
    end if;
  end loop;

  perform app.log_action('roster.imported', 'students', null, null, p_semester_id,
    jsonb_build_object('counts', v_counts, 'rows', jsonb_array_length(p_rows)));
  return jsonb_build_object(
    'dry_run', false, 'ok', true, 'counts', v_counts, 'errors', '[]'::jsonb, 'rows', v_plan,
    'filled_after', v_filled_after, 'capacity', v_semester.max_students);
end;
$$;

