-- =============================================================================
-- Phase 1 — Foundation
-- Extensions, the private `app` helper schema, all workflow enum types,
-- shared trigger functions, and the append-only audit log.
-- Specs: DATABASE_SPEC.md §1, §9, §11; TRD.md ADR-002, ADR-006.
-- =============================================================================

create extension if not exists citext with schema extensions;

-- Helper schema. Not exposed through PostgREST (only `public` is), but API roles
-- need USAGE so that RLS policies evaluated as the caller can call the helpers.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;
-- Functions created in `app` by later migrations are private unless granted explicitly.
alter default privileges in schema app revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Enum types (must match src/domain/constants.ts — see constants.sync.test.ts)
-- -----------------------------------------------------------------------------
create type public.system_role as enum ('hod', 'admin');
create type public.semester_role as enum ('lead_faculty', 'faculty', 'student');
create type public.semester_status as enum ('draft', 'active', 'closed');
create type public.roster_status as enum ('empty', 'pending_invite', 'active', 'withdrawn');
create type public.stage_key as enum (
  'exploration', 'paper_selection', 'paper_analysis', 'code_execution', 'objectives',
  'implementation', 'evaluation', 'paper_writing', 'final'
);
create type public.stage_status as enum (
  'not_started', 'in_progress', 'awaiting_approval', 'changes_requested', 'approved',
  'exception_approved'
);
create type public.task_status as enum (
  'not_started', 'in_progress', 'submitted', 'under_review', 'changes_requested',
  'resubmitted', 'verified'
);
create type public.record_status as enum (
  'draft', 'submitted', 'changes_requested', 'approved', 'superseded'
);
create type public.paper_status as enum ('candidate', 'submitted', 'approved', 'rejected', 'withdrawn');
create type public.code_availability as enum ('unknown', 'available', 'not_available');
create type public.execution_status as enum (
  'not_started', 'repository_identified', 'environment_setup', 'execution_successful',
  'execution_failed', 'blocked_dependency_dataset', 'verification_pending', 'verified'
);
create type public.attempt_outcome as enum ('success', 'failed', 'blocked');
create type public.review_target as enum (
  'exploration', 'paper', 'paper_analysis', 'repository', 'objective', 'task_submission',
  'draft_section', 'evaluation', 'final'
);
create type public.review_outcome as enum ('accepted', 'changes_requested', 'rejected', 'comment_only');
create type public.correction_status as enum ('open', 'addressed', 'verified', 'waived');
create type public.evidence_category as enum (
  'research_paper_pdf', 'paper_analysis', 'github_repository', 'execution_screenshot',
  'execution_log', 'result_file', 'objective_document', 'implementation_evidence',
  'test_results', 'paper_draft', 'final_report', 'presentation', 'final_zip',
  'demo_evidence', 'other'
);
create type public.evidence_verification as enum ('unverified', 'verified', 'rejected', 'inaccessible');
create type public.implementation_type as enum (
  'feature', 'dataset', 'model_change', 'frontend', 'backend', 'integration', 'bug'
);
create type public.item_status as enum ('planned', 'in_progress', 'done', 'blocked', 'dropped');
create type public.evaluation_kind as enum ('baseline', 'proposed');
create type public.draft_section as enum (
  'title_abstract', 'introduction', 'literature_review', 'problem_objectives', 'methodology',
  'proposed_approach', 'implementation', 'results_discussion', 'conclusion_future_work',
  'references'
);
create type public.deliverable_item as enum (
  'final_paper', 'project_report', 'source_repository', 'source_zip', 'readme',
  'dataset_references', 'presentation', 'demo_evidence'
);
create type public.assignment_type as enum ('guide', 'co_reviewer');
create type public.request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.signoff_decision as enum ('approve', 'changes_required');

-- -----------------------------------------------------------------------------
-- Errors: every business-rule failure is raised as P0001 "<CODE>: <message>"
-- (API_SPEC.md §1). The frontend maps CODE to a friendly message.
-- -----------------------------------------------------------------------------
create or replace function app.raise_error(p_code text, p_message text, p_details text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_code not in ('FORBIDDEN', 'NOT_FOUND', 'VALIDATION', 'INVALID_STATE', 'GATE_NOT_MET',
                    'DUPLICATE_PAPER', 'CAPACITY_EXCEEDED') then
    raise exception 'app.raise_error: unknown error code %', p_code;
  end if;
  raise exception using
    errcode = 'P0001',
    message = p_code || ': ' || p_message,
    detail = coalesce(p_details, '');
end;
$$;

-- True when the current statement runs as a PostgREST API role. Workflow RPCs are
-- SECURITY DEFINER, so inside them current_user is the function owner instead.
create or replace function app.is_api_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated');
$$;

create or replace function app.try_uuid(p_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then p_value::uuid
  end;
$$;

-- -----------------------------------------------------------------------------
-- Shared trigger functions
-- -----------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Protects workflow columns from direct writes by API roles (ADR-002).
-- Arguments are 'column=initial' pairs: on INSERT the column must hold the
-- initial value (empty = NULL); on UPDATE it must not change.
--   create trigger guard before insert or update on public.papers
--     for each row execute function app.guard_protected_columns('status=candidate', 'approved_by=');
create or replace function app.guard_protected_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_arg text;
  v_col text;
  v_initial text;
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
begin
  if not app.is_api_role() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
  end if;
  foreach v_arg in array tg_argv loop
    v_col := split_part(v_arg, '=', 1);
    v_initial := nullif(substr(v_arg, length(v_col) + 2), '');
    if not v_new ? v_col then
      raise exception 'guard_protected_columns: % has no column %', tg_table_name, v_col;
    end if;
    if tg_op = 'INSERT' and (v_new ->> v_col) is distinct from v_initial then
      perform app.raise_error('FORBIDDEN',
        format('%s.%s is set by workflow actions only', tg_table_name, v_col));
    elsif tg_op = 'UPDATE' and (v_new -> v_col) is distinct from (v_old -> v_col) then
      perform app.raise_error('FORBIDDEN',
        format('%s.%s can only be changed through workflow actions', tg_table_name, v_col));
    end if;
  end loop;
  return new;
end;
$$;

-- For immutable history tables (submissions, reviews): no API role may update or delete.
create or replace function app.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated', 'service_role') then
    perform app.raise_error('FORBIDDEN', format('%s records cannot be changed or deleted', tg_table_name));
  end if;
  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- Audit log (append-only) — ADR-006
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  table_name  text not null,
  row_id      uuid,
  project_id  uuid,
  semester_id uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_row_idx on public.audit_log (row_id);
create index audit_log_project_idx on public.audit_log (project_id, created_at desc);
create index audit_log_semester_idx on public.audit_log (semester_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;
-- Supabase grants table privileges to API roles by default; take them all back.
-- Phase 2 grants SELECT to `authenticated` together with the HOD/lead read policy.
revoke all on public.audit_log from anon, authenticated, service_role;

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function app.prevent_mutation();

create or replace function app.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return null;
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, project_id, semester_id, old_data, new_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    app.try_uuid(v_row ->> 'id'),
    coalesce(app.try_uuid(v_row ->> 'project_id'),
             case when tg_table_name = 'projects' then app.try_uuid(v_row ->> 'id') end),
    coalesce(app.try_uuid(v_row ->> 'semester_id'),
             case when tg_table_name = 'semesters' then app.try_uuid(v_row ->> 'id') end),
    v_old,
    v_new
  );
  return null;
end;
$$;

-- Named workflow events (e.g. 'review.recorded'), written by RPC functions in addition
-- to the row-level entries.
create or replace function app.log_action(
  p_action text,
  p_table text,
  p_row_id uuid,
  p_project_id uuid default null,
  p_semester_id uuid default null,
  p_data jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, table_name, row_id, project_id, semester_id, new_data)
  values (auth.uid(), p_action, p_table, p_row_id, p_project_id, p_semester_id, p_data);
$$;

-- Attaches the audit trigger to a table: select app.enable_audit('public.papers');
create or replace function app.enable_audit(p_table regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create trigger audit_changes after insert or update or delete on %s '
    'for each row execute function app.audit_trigger()', p_table);
end;
$$;

-- Helpers are internal: only workflow functions (owned by postgres) and triggers call them.
revoke execute on all functions in schema app from public, anon, authenticated, service_role;
-- Policies and triggers evaluated as the caller need these two.
grant execute on function app.is_api_role() to anon, authenticated, service_role;
grant execute on function app.raise_error(text, text, text) to anon, authenticated, service_role;
