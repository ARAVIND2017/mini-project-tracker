-- Phase 8 — completeness review: app_copy_semester_config (API_SPEC.md §4.1) was in the
-- specification but had not been built. It copies a semester's setup — domains,
-- evaluation criteria, milestones and task templates — into a new semester that is
-- still a draft. People, roster and projects are never copied.
create or replace function public.app_copy_semester_config(p_from_semester uuid, p_to_semester uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.semesters;
  v_to public.semesters;
  v_domain_map jsonb := '{}';
  v_template_map jsonb := '{}';
  r record;
  v_id uuid;
  v_domains int := 0;
  v_criteria int := 0;
  v_milestones int := 0;
  v_templates int := 0;
  v_switched_off int := 0;
begin
  perform app.require_active_user();
  if not app.has_admin_permission('manage_config') then
    perform app.raise_error('FORBIDDEN', 'Only the HOD can copy a semester''s setup');
  end if;
  select * into v_from from public.semesters where id = p_from_semester;
  if not found then perform app.raise_error('NOT_FOUND', 'Source semester not found'); end if;
  select * into v_to from public.semesters where id = p_to_semester for update;
  if not found then perform app.raise_error('NOT_FOUND', 'Target semester not found'); end if;
  if v_from.id = v_to.id then
    perform app.raise_error('VALIDATION', 'Choose a different semester to copy from', 'from_semester');
  end if;
  if v_to.status <> 'draft' then
    perform app.raise_error('INVALID_STATE', 'The setup can be copied only into a semester that is still a draft');
  end if;

  -- Domains, matched by name; existing ones are kept as they are.
  for r in select * from public.domains where semester_id = v_from.id order by name loop
    select id into v_id from public.domains
    where semester_id = v_to.id and lower(btrim(name)) = lower(btrim(r.name));
    if v_id is null then
      insert into public.domains (semester_id, name, description, is_active)
      values (v_to.id, r.name, r.description, r.is_active) returning id into v_id;
      v_domains := v_domains + 1;
    end if;
    v_domain_map := v_domain_map || jsonb_build_object(r.id::text, v_id);
  end loop;

  -- Evaluation criteria of those domains, skipping names the target domain already has.
  insert into public.evaluation_criteria (domain_id, name, description, sort_order, is_active)
  select (v_domain_map ->> c.domain_id::text)::uuid, c.name, c.description, c.sort_order, c.is_active
  from public.evaluation_criteria c
  join public.domains d on d.id = c.domain_id and d.semester_id = v_from.id
  where not exists (select 1 from public.evaluation_criteria t
                    where t.domain_id = (v_domain_map ->> c.domain_id::text)::uuid
                      and lower(btrim(t.name)) = lower(btrim(c.name)));
  get diagnostics v_criteria = row_count;

  -- Milestones, week by week (date overrides belong to the old calendar and are dropped).
  insert into public.milestones (semester_id, week_no, title, stage_key, description, is_gate, checkpoint)
  select v_to.id, m.week_no, m.title, m.stage_key, m.description, m.is_gate, m.checkpoint
  from public.milestones m
  where m.semester_id = v_from.id and m.week_no <= v_to.week_count
  on conflict (semester_id, week_no) do update
    set title = excluded.title, stage_key = excluded.stage_key, description = excluded.description,
        is_gate = excluded.is_gate, checkpoint = excluded.checkpoint, start_date_override = null,
        updated_at = now();
  get diagnostics v_milestones = row_count;

  -- Task templates: the target's current plan is switched off (kept for the record) and
  -- the source's active templates are copied; generic ones first, so that domain
  -- templates can point at the generic template they replace.
  update public.task_templates set is_active = false, updated_at = now()
  where semester_id = v_to.id and is_active;
  get diagnostics v_switched_off = row_count;
  for r in select * from public.task_templates
           where semester_id = v_from.id and is_active and week_no <= v_to.week_count
           order by (replaces_template_id is not null), week_no, sort_order, created_at loop
    insert into public.task_templates (semester_id, week_no, stage_key, domain_id, replaces_template_id, title,
                                       description, acceptance_criteria, required_evidence, sort_order, is_active)
    values (v_to.id, r.week_no, r.stage_key, (v_domain_map ->> r.domain_id::text)::uuid,
            (v_template_map ->> r.replaces_template_id::text)::uuid, r.title, r.description,
            r.acceptance_criteria, r.required_evidence, r.sort_order, true)
    returning id into v_id;
    v_template_map := v_template_map || jsonb_build_object(r.id::text, v_id);
    v_templates := v_templates + 1;
  end loop;

  perform app.log_action('semester.config_copied', 'semesters', v_to.id, null, v_to.id,
    jsonb_build_object('from_semester', v_from.id, 'from_name', v_from.name, 'domains_added', v_domains,
                       'criteria_added', v_criteria, 'milestones', v_milestones, 'templates', v_templates,
                       'templates_switched_off', v_switched_off));
  return jsonb_build_object('domains_added', v_domains, 'criteria_added', v_criteria,
                            'milestones', v_milestones, 'templates', v_templates,
                            'templates_switched_off', v_switched_off);
end;
$$;

revoke execute on function public.app_copy_semester_config(uuid, uuid) from public, anon;
grant execute on function public.app_copy_semester_config(uuid, uuid) to authenticated;
