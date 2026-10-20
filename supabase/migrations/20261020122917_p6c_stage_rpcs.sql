-- Phase 6 — S6–S9 (part C: the student's records for S6–S9, the checklist and panels)

-- S6 and S7 work needs approved objectives (or the HOD's objective_gate override) — WF-02.
create or replace function app.require_objectives_gate(p_project public.projects)
returns void language plpgsql set search_path = '' as $$
begin
  if not app.stage_done(p_project.id, 'objectives') and p_project.objective_gate_override_at is null then
    perform app.raise_error('GATE_NOT_MET', 'Objectives (S5) must be approved before this work is recorded');
  end if;
end;
$$;

-- An active member of the project's active panel.
create or replace function app.is_panel_member_for(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.is_active_user() and exists (
    select 1 from public.panel_projects pp
    join public.panels p on p.id = pp.panel_id and p.is_active
    join public.panel_members m on m.panel_id = p.id and m.is_active
    where pp.project_id = p_project_id and pp.is_active and m.user_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- S6 Implementation items
-- -----------------------------------------------------------------------------
create or replace function public.app_save_implementation_item(p_project_id uuid, p_data jsonb, p_item_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_title text;
  v_type text;
  v_status text;
  v_notes text;
  v_links text[];
  v_id uuid;
begin
  perform app.require_objectives_gate(v_project);
  perform app.check_keys(p_data, array['title', 'type', 'is_planned', 'status', 'commit_links', 'notes']);
  if app.stage_done(p_project_id, 'implementation') then
    perform app.raise_error('INVALID_STATE', 'Stage S6 is complete; its items can no longer change');
  end if;
  v_title := app.jtext(p_data, 'title', 'Title', 200);
  if v_title is null then
    perform app.raise_error('VALIDATION', 'Title is required', 'title');
  end if;
  v_type := app.jtext(p_data, 'type', 'Type', 40);
  if v_type is null or v_type <> all (enum_range(null::public.implementation_type)::text[]) then
    perform app.raise_error('VALIDATION', 'Choose the type of work', 'type');
  end if;
  v_status := coalesce(app.jtext(p_data, 'status', 'Status', 40), 'planned');
  if v_status <> all (enum_range(null::public.item_status)::text[]) then
    perform app.raise_error('VALIDATION', 'Unknown status', 'status');
  end if;
  v_notes := app.jtext(p_data, 'notes', 'Notes', 5000);
  if v_status = 'dropped' then
    v_notes := app.min_text(v_notes, 5, 'The reason for dropping it (in the notes)', 'notes');
  end if;
  v_links := app.jtext_array(p_data, 'commit_links', 'Commit links', 30, 2000);
  if exists (select 1 from unnest(v_links) l where l !~* '^https://[^\s]+$') then
    perform app.raise_error('VALIDATION', 'Commit links must start with https://', 'commit_links');
  end if;

  if p_item_id is null then
    insert into public.implementation_items (project_id, title, type)
    values (p_project_id, v_title, v_type::public.implementation_type) returning id into v_id;
  else
    select id into v_id from public.implementation_items where id = p_item_id and project_id = p_project_id;
    if v_id is null then
      perform app.raise_error('NOT_FOUND', 'Item not found');
    end if;
  end if;
  update public.implementation_items set
    title = v_title, type = v_type::public.implementation_type,
    is_planned = coalesce((p_data ->> 'is_planned')::boolean, true),
    status = v_status::public.item_status, commit_links = v_links, notes = v_notes
  where id = v_id;
  perform app.touch_stage(p_project_id, 'implementation');
  perform app.log_action('implementation_item.saved', 'implementation_items', v_id, p_project_id, v_project.semester_id,
    jsonb_build_object('status', v_status));
  return v_id;
exception when invalid_text_representation then
  perform app.raise_error('VALIDATION', '"Planned" must be true or false', 'is_planned');
end;
$$;

-- -----------------------------------------------------------------------------
-- S7 Evaluation results (DATA-08: evidence is required; baseline and proposed are separate)
-- -----------------------------------------------------------------------------
create or replace function public.app_save_evaluation_result(p_project_id uuid, p_data jsonb, p_result_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_result public.evaluation_results;
  v_kind text;
  v_test text;
  v_expected text;
  v_actual text;
  v_metric text;
  v_value text;
  v_passed text;
  v_action text;
  v_url text;
  v_description text;
  v_evidence uuid;
  v_id uuid;
begin
  perform app.require_objectives_gate(v_project);
  perform app.check_keys(p_data, array['kind', 'test_case', 'expected', 'actual', 'metric_name', 'metric_value',
    'passed', 'corrective_action', 'evidence_url', 'evidence_description']);
  if app.stage_done(p_project_id, 'evaluation') then
    perform app.raise_error('INVALID_STATE', 'Stage S7 is complete; results can no longer change');
  end if;
  if exists (select 1 from public.evaluation_results where project_id = p_project_id and status = 'submitted') then
    perform app.raise_error('INVALID_STATE', 'The results are locked while they are waiting for review');
  end if;
  if p_result_id is not null then
    select * into v_result from public.evaluation_results where id = p_result_id and project_id = p_project_id;
    if not found then
      perform app.raise_error('NOT_FOUND', 'Result not found');
    end if;
    if v_result.status not in ('draft', 'changes_requested') then
      perform app.raise_error('INVALID_STATE', 'This result is approved and can no longer change');
    end if;
  end if;

  v_kind := app.jtext(p_data, 'kind', 'Kind', 20);
  if v_kind is null or v_kind not in ('baseline', 'proposed') then
    perform app.raise_error('VALIDATION', 'Say whether this is a baseline (original work) or proposed (your work) result', 'kind');
  end if;
  v_test := app.jtext(p_data, 'test_case', 'Test case', 1000);
  v_expected := app.jtext(p_data, 'expected', 'Expected result', 2000);
  v_actual := app.jtext(p_data, 'actual', 'Actual result', 2000);
  if v_test is null or v_expected is null or v_actual is null then
    perform app.raise_error('VALIDATION', 'Give the test case, the expected result and the actual result', 'test_case');
  end if;
  v_metric := app.jtext(p_data, 'metric_name', 'Metric', 100);
  v_value := app.jtext(p_data, 'metric_value', 'Metric value', 40);
  if (v_metric is null) <> (v_value is null) then
    perform app.raise_error('VALIDATION', 'Give both the metric name and its value, or neither', 'metric_value');
  end if;
  if v_value is not null and v_value !~ '^-?[0-9]+(\.[0-9]+)?$' then
    perform app.raise_error('VALIDATION', 'The metric value must be a number', 'metric_value');
  end if;
  v_passed := lower(btrim(p_data ->> 'passed'));
  if v_passed is null or v_passed not in ('true', 'false') then
    perform app.raise_error('VALIDATION', 'Say whether the test passed', 'passed');
  end if;
  v_action := app.jtext(p_data, 'corrective_action', 'Corrective action', 2000);
  if v_passed = 'false' and v_action is null then
    perform app.raise_error('VALIDATION', 'A failed test needs the corrective action', 'corrective_action');
  end if;

  v_url := app.jurl(p_data, 'evidence_url', 'The evidence link');
  v_description := app.jtext(p_data, 'evidence_description', 'The evidence description', 1000);
  if v_url is not null then
    insert into public.evidence (project_id, category, url, description, stage_key, created_by)
    values (p_project_id, 'test_results', v_url,
            app.min_text(v_description, 10, 'The evidence description', 'evidence_description'), 'evaluation', auth.uid())
    returning id into v_evidence;
  elsif p_result_id is null then
    perform app.raise_error('VALIDATION', 'Every result needs an evidence link (DATA-08)', 'evidence_url');
  end if;

  if p_result_id is null then
    insert into public.evaluation_results (project_id, kind, test_case, expected, actual, passed, evidence_id, corrective_action)
    values (p_project_id, v_kind::public.evaluation_kind, v_test, v_expected, v_actual, v_passed::boolean, v_evidence, v_action)
    returning id into v_id;
  else
    v_id := p_result_id;
  end if;
  update public.evaluation_results set
    kind = v_kind::public.evaluation_kind, test_case = v_test, expected = v_expected, actual = v_actual,
    metric_name = v_metric, metric_value = v_value::numeric, passed = v_passed::boolean,
    corrective_action = v_action, evidence_id = coalesce(v_evidence, evidence_id)
  where id = v_id;
  perform app.touch_stage(p_project_id, 'evaluation');
  perform app.log_action('evaluation_result.saved', 'evaluation_results', v_id, p_project_id, v_project.semester_id,
    jsonb_build_object('kind', v_kind, 'passed', v_passed));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- S8 Paper draft sections (versioned per section)
-- -----------------------------------------------------------------------------
create or replace function public.app_save_draft(p_project_id uuid, p_section public.draft_section, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_latest public.paper_drafts;
  v_id uuid;
begin
  perform app.check_keys(p_data, array['doc_url', 'notes']);
  if p_section is null then
    perform app.raise_error('VALIDATION', 'Choose the section', 'section');
  end if;
  select * into v_latest from public.paper_drafts
  where project_id = p_project_id and section = p_section order by version desc limit 1;
  if not found then
    insert into public.paper_drafts (project_id, section, version) values (p_project_id, p_section, 1) returning id into v_id;
  elsif v_latest.status in ('draft', 'changes_requested') then
    v_id := v_latest.id;
  elsif v_latest.status = 'approved' then
    perform app.raise_error('INVALID_STATE', 'This section is approved. Start a new version to change it');
  else
    perform app.raise_error('INVALID_STATE', 'This section is locked while it is waiting for review');
  end if;
  update public.paper_drafts set
    doc_url = app.jurl(p_data, 'doc_url', 'The document link'),
    notes = app.jtext(p_data, 'notes', 'Notes', 5000)
  where id = v_id;
  perform app.touch_stage(p_project_id, 'paper_writing');
  perform app.log_action('draft.saved', 'paper_drafts', v_id, p_project_id, v_project.semester_id,
    jsonb_build_object('section', p_section));
  return v_id;
end;
$$;

create or replace function public.app_new_draft_version(p_project_id uuid, p_section public.draft_section)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_latest public.paper_drafts;
  v_id uuid;
begin
  select * into v_latest from public.paper_drafts
  where project_id = p_project_id and section = p_section order by version desc limit 1;
  if not found or v_latest.status <> 'approved' then
    perform app.raise_error('INVALID_STATE', 'A new version can be started only from the approved section');
  end if;
  insert into public.paper_drafts (project_id, section, version, doc_url, notes)
  values (p_project_id, p_section, v_latest.version + 1, v_latest.doc_url, v_latest.notes)
  returning id into v_id;
  perform app.log_action('draft.new_version', 'paper_drafts', v_id, p_project_id, v_project.semester_id,
    jsonb_build_object('section', p_section, 'version', v_latest.version + 1));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- S9 Final checklist
-- -----------------------------------------------------------------------------
create or replace function app.deliverable_category(p_item public.deliverable_item)
returns public.evidence_category language sql immutable set search_path = '' as $$
  select case p_item
    when 'final_paper' then 'paper_draft'
    when 'project_report' then 'final_report'
    when 'source_repository' then 'github_repository'
    when 'source_zip' then 'final_zip'
    when 'presentation' then 'presentation'
    when 'demo_evidence' then 'demo_evidence'
    else 'other'
  end::public.evidence_category;
$$;

-- Deliverables required for this project (the ZIP only when the semester requires it).
create or replace function app.required_deliverables(p_project_id uuid)
returns setof public.final_deliverables language sql stable set search_path = '' as $$
  select d.* from public.final_deliverables d
  join public.projects p on p.id = d.project_id
  join public.semesters s on s.id = p.semester_id
  where d.project_id = p_project_id and (d.item <> 'source_zip' or s.require_source_zip);
$$;

create or replace function public.app_set_deliverable(
  p_project_id uuid,
  p_item public.deliverable_item,
  p_url text,
  p_description text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects := app.require_student_project(p_project_id);
  v_deliverable public.final_deliverables;
  v_evidence uuid;
begin
  if exists (select 1 from public.project_stages where project_id = p_project_id and stage_key = 'final'
             and status in ('awaiting_approval', 'approved')) then
    perform app.raise_error('INVALID_STATE', 'The checklist is locked while the panel is reviewing it');
  end if;
  perform app.ensure_deliverables(p_project_id);
  select * into v_deliverable from app.required_deliverables(p_project_id) where item = p_item;
  if v_deliverable.id is null then
    perform app.raise_error('VALIDATION', 'This item is not part of the checklist for this semester', 'item');
  end if;
  if nullif(btrim(p_url), '') is null then
    perform app.raise_error('VALIDATION', 'The link is required', 'url');
  end if;
  if char_length(btrim(p_description)) > 1000 or char_length(btrim(p_notes)) > 2000 then
    perform app.raise_error('VALIDATION', 'The description or notes are too long');
  end if;
  insert into public.evidence (project_id, category, url, description, stage_key, created_by)
  values (p_project_id, app.deliverable_category(p_item), app.valid_url(btrim(p_url), 'The link', 'url'),
          app.min_text(p_description, 10, 'The description', 'description'), 'final', auth.uid())
  returning id into v_evidence;
  update public.final_deliverables
  set evidence_id = v_evidence, verification = 'unverified', verified_by = null, verified_at = null,
      verification_note = null, notes = nullif(btrim(p_notes), '')
  where id = v_deliverable.id;
  perform app.touch_stage(p_project_id, 'final');
  perform app.log_action('deliverable.set', 'final_deliverables', v_deliverable.id, p_project_id, v_project.semester_id,
    jsonb_build_object('item', p_item));
  return v_deliverable.id;
end;
$$;

-- A reviewer of the project or a member of its panel checks each checklist item.
create or replace function public.app_verify_deliverable(
  p_deliverable_id uuid,
  p_verification public.evidence_verification,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deliverable public.final_deliverables;
  v_note text := nullif(btrim(p_note), '');
begin
  perform app.require_active_user();
  select * into v_deliverable from public.final_deliverables where id = p_deliverable_id for update;
  if not found or not app.can_view_project(v_deliverable.project_id) then
    perform app.raise_error('NOT_FOUND', 'Checklist item not found');
  end if;
  if not (app.is_project_reviewer(v_deliverable.project_id) or app.is_panel_member_for(v_deliverable.project_id)) then
    perform app.raise_error('FORBIDDEN', 'Only a reviewer or a panel member of this project can verify the checklist');
  end if;
  perform app.require_open_semester(app.project_semester(v_deliverable.project_id));
  if v_deliverable.evidence_id is null then
    perform app.raise_error('INVALID_STATE', 'The student has not added this item yet');
  end if;
  if p_verification is null or p_verification = 'unverified' then
    perform app.raise_error('VALIDATION', 'Choose verified, rejected or not accessible', 'verification');
  end if;
  if p_verification in ('rejected', 'inaccessible') then
    v_note := app.min_text(v_note, 5, 'A note', 'note');
  end if;
  update public.final_deliverables
  set verification = p_verification, verified_by = auth.uid(), verified_at = now(), verification_note = v_note
  where id = p_deliverable_id;
  update public.evidence
  set verification = p_verification, verified_by = auth.uid(), verified_at = now(), verification_note = v_note
  where id = v_deliverable.evidence_id;
  perform app.log_action('deliverable.' || p_verification, 'final_deliverables', p_deliverable_id,
    v_deliverable.project_id, app.project_semester(v_deliverable.project_id), jsonb_build_object('note', v_note));
end;
$$;

-- -----------------------------------------------------------------------------
-- Panels (HOD): name, members and projects. Removed members and projects are switched off.
-- A project moved to this panel leaves its previous one.
-- -----------------------------------------------------------------------------
create or replace function public.app_set_panel(
  p_semester_id uuid,
  p_name text,
  p_member_ids uuid[],
  p_project_ids uuid[],
  p_panel_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := nullif(btrim(p_name), '');
  v_members uuid[] := array(select distinct m from unnest(coalesce(p_member_ids, '{}')) m);
  v_projects uuid[] := array(select distinct p from unnest(coalesce(p_project_ids, '{}')) p);
begin
  perform app.require_active_user();
  if not app.is_hod() then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can set up panels');
  end if;
  perform app.require_open_semester(p_semester_id);
  if v_name is null or char_length(v_name) > 120 then
    perform app.raise_error('VALIDATION', 'Panel name must be 1–120 characters', 'name');
  end if;
  if cardinality(v_members) = 0 then
    perform app.raise_error('VALIDATION', 'A panel needs at least one member', 'member_ids');
  end if;
  if exists (select 1 from unnest(v_members) m where not app.is_faculty_member(m, p_semester_id)) then
    perform app.raise_error('VALIDATION', 'Panel members must be faculty of this semester', 'member_ids');
  end if;
  if exists (select 1 from unnest(v_projects) p
             where not exists (select 1 from public.projects where id = p and semester_id = p_semester_id)) then
    perform app.raise_error('VALIDATION', 'Choose projects of this semester', 'project_ids');
  end if;

  begin
    if p_panel_id is null then
      insert into public.panels (semester_id, name) values (p_semester_id, v_name) returning id into v_id;
    else
      update public.panels set name = v_name, is_active = true
      where id = p_panel_id and semester_id = p_semester_id returning id into v_id;
      if v_id is null then
        perform app.raise_error('NOT_FOUND', 'Panel not found');
      end if;
    end if;
  exception when unique_violation then
    perform app.raise_error('VALIDATION', 'A panel with this name already exists', 'name');
  end;

  update public.panel_members set is_active = false where panel_id = v_id and is_active and user_id <> all (v_members);
  insert into public.panel_members (panel_id, user_id) select v_id, m from unnest(v_members) m
  on conflict (panel_id, user_id) do update set is_active = true;

  update public.panel_projects set is_active = false
  where is_active and ((panel_id = v_id and project_id <> all (v_projects))
                       or (panel_id <> v_id and project_id = any (v_projects)));
  insert into public.panel_projects (panel_id, project_id) select v_id, p from unnest(v_projects) p
  on conflict (panel_id, project_id) do update set is_active = true;

  perform app.log_action('panel.saved', 'panels', v_id, null, p_semester_id,
    jsonb_build_object('name', v_name, 'members', v_members, 'projects', v_projects));
  return v_id;
end;
$$;
