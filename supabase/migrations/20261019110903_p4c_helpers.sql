-- Phase 4 — Research stages S1–S5 (part C: internal helpers)
-- Input parsing, permission checks for the student and the reviewers, the stage
-- dependency graph (WORKFLOW_SPEC.md §2) and the stage status updates (§3.6).

-- -----------------------------------------------------------------------------
-- Form input. Forms send every field; a missing or empty field means "no value".
-- -----------------------------------------------------------------------------
create or replace function app.check_keys(p_data jsonb, p_allowed text[])
returns void language plpgsql set search_path = '' as $$
declare
  v_unknown text;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    perform app.raise_error('VALIDATION', 'The form data is not valid');
  end if;
  select string_agg(k, ', ' order by k) into v_unknown
  from jsonb_object_keys(p_data) k where k <> all (p_allowed);
  if v_unknown is not null then
    perform app.raise_error('VALIDATION', format('Unknown field(s): %s', v_unknown));
  end if;
end;
$$;

create or replace function app.jtext(p_data jsonb, p_key text, p_label text, p_max int default 10000)
returns text language plpgsql set search_path = '' as $$
declare
  v jsonb := p_data -> p_key;
  v_text text;
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return null;
  end if;
  if jsonb_typeof(v) not in ('string', 'number') then
    perform app.raise_error('VALIDATION', format('%s must be text', p_label), p_key);
  end if;
  v_text := nullif(btrim(v #>> '{}'), '');
  if char_length(v_text) > p_max then
    perform app.raise_error('VALIDATION', format('%s is longer than %s characters', p_label, p_max), p_key);
  end if;
  return v_text;
end;
$$;

-- A list of short texts: trimmed, empty entries dropped.
create or replace function app.jtext_array(p_data jsonb, p_key text, p_label text, p_max_items int default 30, p_max_len int default 500)
returns text[] language plpgsql set search_path = '' as $$
declare
  v jsonb := p_data -> p_key;
  v_result text[];
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return '{}';
  end if;
  if jsonb_typeof(v) <> 'array' or exists (select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'string') then
    perform app.raise_error('VALIDATION', format('%s must be a list of texts', p_label), p_key);
  end if;
  select coalesce(array_agg(btrim(e) order by n), '{}') into v_result
  from jsonb_array_elements_text(v) with ordinality as t(e, n) where btrim(e) <> '';
  if cardinality(v_result) > p_max_items then
    perform app.raise_error('VALIDATION', format('%s can have at most %s entries', p_label, p_max_items), p_key);
  end if;
  if exists (select 1 from unnest(v_result) x where char_length(x) > p_max_len) then
    perform app.raise_error('VALIDATION', format('Each entry of %s must be at most %s characters', p_label, p_max_len), p_key);
  end if;
  return v_result;
end;
$$;

-- Only https links are accepted (SEC-12: no javascript:, data: or http:).
create or replace function app.valid_url(p_url text, p_label text, p_field text)
returns text language plpgsql set search_path = '' as $$
begin
  if p_url is not null and (p_url !~* '^https://[^\s]+$' or char_length(p_url) > 2000) then
    perform app.raise_error('VALIDATION', format('%s must be a link starting with https://', p_label), p_field);
  end if;
  return p_url;
end;
$$;

create or replace function app.jurl(p_data jsonb, p_key text, p_label text)
returns text language sql set search_path = '' as $$
  select app.valid_url(app.jtext(p_data, p_key, p_label, 2000), p_label, p_key);
$$;

create or replace function app.jint(p_data jsonb, p_key text, p_label text, p_min int, p_max int)
returns int language plpgsql set search_path = '' as $$
declare
  v_text text := app.jtext(p_data, p_key, p_label, 20);
begin
  if v_text is null then
    return null;
  end if;
  if v_text !~ '^-?[0-9]+$' or v_text::numeric not between p_min and p_max then
    perform app.raise_error('VALIDATION', format('%s must be a whole number from %s to %s', p_label, p_min, p_max), p_key);
  end if;
  return v_text::int;
end;
$$;

-- Submission checks collect every missing field into one message.
create or replace function app.missing_text(p_value text, p_min int, p_label text)
returns text language sql immutable set search_path = '' as $$
  select case
    when char_length(coalesce(btrim(p_value), '')) = 0 then p_label
    when char_length(btrim(p_value)) < p_min then format('%s (at least %s characters)', p_label, p_min)
  end;
$$;

create or replace function app.missing_items(p_value text[], p_min int, p_label text)
returns text language sql immutable set search_path = '' as $$
  select case when coalesce(cardinality(p_value), 0) < p_min
    then case when p_min = 1 then p_label else format('%s (at least %s)', p_label, p_min) end end;
$$;

create or replace function app.require_complete(p_missing text[])
returns void language plpgsql set search_path = '' as $$
declare
  v_missing text[] := array_remove(p_missing, null);
begin
  if cardinality(v_missing) > 0 then
    perform app.raise_error('VALIDATION', 'Complete these before submitting: ' || array_to_string(v_missing, '; '), 'fields');
  end if;
end;
$$;

create or replace function app.min_text(p_value text, p_min int, p_label text, p_field text)
returns text language plpgsql set search_path = '' as $$
declare
  v_text text := nullif(btrim(p_value), '');
begin
  if char_length(coalesce(v_text, '')) < p_min then
    perform app.raise_error('VALIDATION', format('%s needs at least %s characters', p_label, p_min), p_field);
  end if;
  return v_text;
end;
$$;

-- -----------------------------------------------------------------------------
-- Who may act
-- -----------------------------------------------------------------------------
-- The project's own student, in a semester that is not closed. Locks the project row
-- so that concurrent workflow actions on one project run one after another.
create or replace function app.require_student_project(p_project_id uuid)
returns public.projects language plpgsql set search_path = '' as $$
declare
  v_project public.projects;
begin
  perform app.require_active_user();
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or not app.can_view_project(p_project_id) then
    perform app.raise_error('NOT_FOUND', 'Project not found');
  end if;
  if not app.is_project_student(p_project_id) then
    perform app.raise_error('FORBIDDEN', 'Only the project''s student can change its content');
  end if;
  perform app.require_open_semester(v_project.semester_id);
  return v_project;
end;
$$;

-- A reviewer of the project (HOD, lead, guide, co-reviewer, active authorization).
create or replace function app.require_reviewer(p_project_id uuid, p_message text default 'Only a reviewer of this project can do this')
returns public.projects language plpgsql set search_path = '' as $$
declare
  v_project public.projects;
begin
  perform app.require_active_user();
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or not app.can_view_project(p_project_id) then
    perform app.raise_error('NOT_FOUND', 'Project not found');
  end if;
  if not app.is_project_reviewer(p_project_id) then
    perform app.raise_error('FORBIDDEN', p_message);
  end if;
  perform app.require_open_semester(v_project.semester_id);
  return v_project;
end;
$$;

-- Teaching week (1-based) in the semester's time zone; 0 before the start or without a start date.
create or replace function app.semester_week(p_semester_id uuid)
returns int language sql stable set search_path = '' as $$
  select case when s.start_date is null then 0
              else greatest(0, ((now() at time zone s.timezone)::date - s.start_date) / 7 + 1) end
  from public.semesters s where s.id = p_semester_id;
$$;

-- -----------------------------------------------------------------------------
-- Stages
-- -----------------------------------------------------------------------------
create or replace function app.stage_label(p_stage public.stage_key)
returns text language sql immutable set search_path = '' as $$
  select case p_stage
    when 'exploration' then 'S1 Domain and research exploration'
    when 'paper_selection' then 'S2 Research paper selection'
    when 'paper_analysis' then 'S3 Paper analysis'
    when 'code_execution' then 'S4 Repository and original code execution'
    when 'objectives' then 'S5 Research gap and objectives'
    when 'implementation' then 'S6 Proposed implementation'
    when 'evaluation' then 'S7 Testing and evaluation'
    when 'paper_writing' then 'S8 Research paper writing'
    when 'final' then 'S9 Final documentation and demonstration'
  end;
$$;

-- WORKFLOW_SPEC.md §2: 2→1, 3→2, 4→2, 5→3 and 5→4, 6→5, 7→6, 8→5, 9→7 and 9→8.
create or replace function app.stage_dependencies(p_stage public.stage_key)
returns public.stage_key[] language sql immutable set search_path = '' as $$
  select case p_stage
    when 'paper_selection' then array['exploration']
    when 'paper_analysis' then array['paper_selection']
    when 'code_execution' then array['paper_selection']
    when 'objectives' then array['paper_analysis', 'code_execution']
    when 'implementation' then array['objectives']
    when 'evaluation' then array['implementation']
    when 'paper_writing' then array['objectives']
    when 'final' then array['evaluation', 'paper_writing']
    else array[]::text[]
  end::public.stage_key[];
$$;

create or replace function app.stage_done(p_project_id uuid, p_stage public.stage_key)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.project_stages
                 where project_id = p_project_id and stage_key = p_stage
                   and status in ('approved', 'exception_approved'));
$$;

-- First content in a stage: not_started → in_progress.
create or replace function app.touch_stage(p_project_id uuid, p_stage public.stage_key)
returns void language sql set search_path = '' as $$
  update public.project_stages set status = 'in_progress'
  where project_id = p_project_id and stage_key = p_stage and status = 'not_started';
$$;

-- Sets a stage status. Approval requires every stage it depends on (GATE_NOT_MET).
create or replace function app.set_stage_status(
  p_project_id uuid,
  p_stage public.stage_key,
  p_status public.stage_status,
  p_reason text default null
)
returns void language plpgsql set search_path = '' as $$
declare
  v_dep public.stage_key;
begin
  if p_status in ('approved', 'exception_approved') then
    foreach v_dep in array app.stage_dependencies(p_stage) loop
      if not app.stage_done(p_project_id, v_dep) then
        perform app.raise_error('GATE_NOT_MET',
          format('%s must be approved before %s', app.stage_label(v_dep), app.stage_label(p_stage)));
      end if;
    end loop;
    update public.project_stages
    set status = p_status, approved_by = auth.uid(), approved_at = now(),
        exception_reason = case when p_status = 'exception_approved' then p_reason end
    where project_id = p_project_id and stage_key = p_stage;
  else
    update public.project_stages
    set status = p_status, approved_by = null, approved_at = null, exception_reason = null
    where project_id = p_project_id and stage_key = p_stage;
  end if;
end;
$$;

-- Corrections that still need work before a resubmission (open) or before approval (open or addressed).
create or replace function app.count_corrections(p_target_id uuid, p_statuses public.correction_status[])
returns int language sql stable set search_path = '' as $$
  select count(*)::int from public.corrections where target_id = p_target_id and status = any (p_statuses);
$$;

-- The project's selected paper (candidate, submitted or approved), if any.
create or replace function app.selected_paper(p_project_id uuid)
returns public.papers language sql stable set search_path = '' as $$
  select * from public.papers where project_id = p_project_id and is_selected;
$$;
