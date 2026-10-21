-- Phase 7 — Dashboards, reports, notifications, meetings and audit (part A: notifications and meetings)
-- Specs: PRD F10 (AC10.1, FUN-18), DATABASE_SPEC.md §7 (meetings) and §9 (notifications),
-- UI_UX_SPEC.md (L1 "Escalate to HOD", M1 meetings, N1 inbox).
-- Notifications are created from the named workflow events in the audit log, so every
-- workflow function produces them without being changed, inside the same transaction.

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id),
  type       text not null check (char_length(type) between 1 and 60),
  title      text not null check (char_length(title) between 1 and 300),
  body       text check (body is null or char_length(body) <= 2000),
  -- In-app paths only (no external links in notifications).
  link       text check (link is null or (link ~ '^/[^/]' and char_length(link) <= 500)),
  project_id uuid references public.projects (id),
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_project_idx on public.notifications (project_id);
create unique index notifications_dedupe_key on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and app.is_active_user());

-- Sends one notification to each user (never to the person who caused it).
create or replace function app.notify(
  p_user_ids uuid[],
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_project_id uuid,
  p_dedupe_key text default null
)
returns void language sql set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link, project_id, dedupe_key)
  select distinct u, p_type, left(p_title, 300), left(p_body, 2000), p_link, p_project_id, p_dedupe_key
  from unnest(coalesce(p_user_ids, '{}')) u
  join public.profiles pr on pr.id = u and pr.is_active
  where u is distinct from auth.uid()
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
$$;

-- People who review a project day to day: the guide, co-reviewers and faculty with an
-- active authorization (the lead and the HOD see everything in the review queue instead).
create or replace function app.project_reviewer_ids(p_project_id uuid)
returns uuid[] language sql stable set search_path = '' as $$
  select array_remove(
    array[(select guide_id from public.projects where id = p_project_id)]
    || coalesce((select array_agg(user_id) from public.project_reviewers where project_id = p_project_id and is_active), '{}')
    || coalesce((select array_agg(faculty_id) from public.review_authorizations
                 where project_id = p_project_id and revoked_at is null and (valid_until is null or valid_until > now())), '{}'),
    null);
$$;

create or replace function app.project_student_id(p_project_id uuid)
returns uuid language sql stable set search_path = '' as $$
  select s.user_id from public.projects p join public.students s on s.id = p.student_id
  where p.id = p_project_id and s.status = 'active';
$$;

create or replace function app.panel_member_ids(p_project_id uuid)
returns uuid[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(m.user_id), '{}')
  from public.panel_projects pp
  join public.panels p on p.id = pp.panel_id and p.is_active
  join public.panel_members m on m.panel_id = p.id and m.is_active
  where pp.project_id = p_project_id and pp.is_active;
$$;

create or replace function app.target_label(p_target text)
returns text language sql immutable set search_path = '' as $$
  select case p_target
    when 'exploration' then 'exploration (S1)'
    when 'paper' then 'paper (S2)'
    when 'paper_analysis' then 'paper analysis (S3)'
    when 'repository' then 'code execution (S4)'
    when 'objective' then 'objectives (S5)'
    when 'task_submission' then 'weekly task'
    when 'evaluation' then 'evaluation results (S7)'
    when 'draft_section' then 'paper section (S8)'
    when 'final' then 'final submission (S9)'
    else p_target
  end;
$$;

-- Where a target is seen on the project page.
create or replace function app.target_link(p_project_id uuid, p_target text, p_target_id uuid)
returns text language sql immutable set search_path = '' as $$
  select '/projects/' || p_project_id || case p_target
    when 'task_submission' then '?view=tasks&submission=' || p_target_id
    when 'exploration' then '?stage=exploration'
    when 'paper' then '?stage=paper_selection'
    when 'paper_analysis' then '?stage=paper_analysis'
    when 'repository' then '?stage=code_execution'
    when 'objective' then '?stage=objectives'
    when 'evaluation' then '?stage=evaluation'
    when 'draft_section' then '?stage=paper_writing'
    when 'final' then '?stage=final'
    else ''
  end;
$$;

-- FUN-18: notifications for new submissions (reviewers), review outcomes (student),
-- corrections, approvals, assignment decisions and sign-off.
create or replace function app.notify_from_audit()
returns trigger language plpgsql set search_path = '' as $$
declare
  d jsonb := coalesce(new.new_data, '{}');
  v_student text;
  v_target text;
  v_correction public.corrections;
  v_request public.assignment_requests;
begin
  if new.project_id is not null then
    select coalesce(s.full_name, 'A student') into v_student
    from public.projects p join public.students s on s.id = p.student_id where p.id = new.project_id;
  end if;

  if new.action = 'task.submitted' then
    perform app.notify(app.project_reviewer_ids(new.project_id), 'submission',
      format('%s submitted %s (version %s%s)', v_student,
             (select format('week %s: %s', week_no, title) from public.tasks where id = (d ->> 'task_id')::uuid),
             d ->> 'version', case when (d ->> 'is_late')::boolean then ', late' else '' end),
      null, app.target_link(new.project_id, 'task_submission', new.row_id), new.project_id);

  elsif new.action = 'record.submitted' then
    v_target := d ->> 'target_type';
    perform app.notify(
      case when v_target = 'final' then app.panel_member_ids(new.project_id) || app.project_reviewer_ids(new.project_id)
           else app.project_reviewer_ids(new.project_id) end,
      'submission', format('%s submitted the %s for review', v_student, app.target_label(v_target)),
      null, app.target_link(new.project_id, v_target, new.row_id), new.project_id);

  elsif new.action = 'review.recorded' then
    v_target := d ->> 'target_type';
    perform app.notify(array[app.project_student_id(new.project_id)], 'review',
      format('Your %s: %s', app.target_label(v_target),
             case d ->> 'outcome'
               when 'accepted' then 'accepted'
               when 'changes_requested' then format('changes requested (%s correction(s))', d ->> 'corrections')
               when 'rejected' then 'rejected'
               else 'new comment' end),
      null, app.target_link(new.project_id, v_target, (d ->> 'target_id')::uuid), new.project_id);

  elsif new.action = 'correction.addressed' then
    select * into v_correction from public.corrections where id = new.row_id;
    perform app.notify(
      case when v_correction.target_type = 'final' then app.panel_member_ids(new.project_id)
           else app.project_reviewer_ids(new.project_id) end,
      'correction', format('%s addressed a correction: %s', v_student, left(v_correction.description, 120)),
      null, app.target_link(new.project_id, v_correction.target_type::text, v_correction.target_id), new.project_id);

  elsif new.action in ('assignment.approved', 'assignment.rejected') then
    select * into v_request from public.assignment_requests where id = new.row_id;
    perform app.notify(array[v_request.faculty_id, v_request.requested_by], 'assignment',
      format('%s request for %s was %s', initcap(replace(v_request.type::text, '_', '-')), v_student,
             case when new.action = 'assignment.approved' then 'approved by the HOD' else 'not approved' end),
      d ->> 'note', '/projects/' || new.project_id, new.project_id);

  elsif new.action = 'stage.exception_approved' then
    perform app.notify(array[app.project_student_id(new.project_id)], 'approval',
      'An exception was approved for S4: reimplement the method in S6', d ->> 'reason',
      '/projects/' || new.project_id || '?stage=code_execution', new.project_id);

  elsif new.action = 'signoff.recorded' then
    perform app.notify(array[app.project_student_id(new.project_id)], 'signoff',
      case when d ->> 'decision' = 'approve' then 'A panel member approved your project'
           else 'A panel member requires changes to your final submission' end,
      null, '/projects/' || new.project_id || '?stage=final', new.project_id);

  elsif new.action = 'project.completed' then
    perform app.notify(array[app.project_student_id(new.project_id),
                             (select guide_id from public.projects where id = new.project_id)],
      'approval', format('%s''s project is complete: the panel signed off', v_student), null,
      '/projects/' || new.project_id || '?stage=final', new.project_id);
  end if;
  return null;
end;
$$;

create trigger audit_log_notify after insert on public.audit_log
  for each row when (new.action like '%.%')
  execute function app.notify_from_audit();

-- The caller marks their own notifications as read (all of them when p_ids is null).
create or replace function public.app_mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_count int;
begin
  with done as (
    update public.notifications set read_at = now()
    where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids))
    returning 1)
  select count(*) into v_count from done;
  return v_count;
end;
$$;

-- Deadline reminders (48 h before) for the caller's own open tasks. Created when the
-- user opens the app, so no scheduler is needed; each task is reminded once.
create or replace function public.app_refresh_my_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_count int;
begin
  with due as (
    insert into public.notifications (user_id, type, title, link, project_id, dedupe_key)
    select v_uid, 'deadline',
           format('Week %s task due %s: %s', k.week_no,
                  to_char(k.due_at at time zone se.timezone, 'Dy DD Mon, HH24:MI'), k.title),
           '/projects/' || p.id || '?view=tasks', p.id, 'deadline:' || k.id
    from public.tasks k
    join public.projects p on p.id = k.project_id
    join public.students s on s.id = p.student_id and s.user_id = v_uid and s.status = 'active'
    join public.semesters se on se.id = p.semester_id and se.status = 'active'
    where k.is_active and k.status in ('not_started', 'in_progress', 'changes_requested')
      and k.due_at > now() and k.due_at <= now() + interval '48 hours'
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1)
  select count(*) into v_count from due;
  return v_count;
end;
$$;

-- The lead (or the HOD) raises a project with the HOD.
create or replace function public.app_escalate_to_hod(p_project_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_note text;
begin
  perform app.require_active_user();
  select * into v_project from public.projects where id = p_project_id;
  if not found or not app.can_view_project(p_project_id) then
    perform app.raise_error('NOT_FOUND', 'Project not found');
  end if;
  if not (app.is_lead(v_project.semester_id) or app.is_hod()) then
    perform app.raise_error('FORBIDDEN', 'Only the lead faculty can escalate to the HOD');
  end if;
  v_note := app.min_text(p_note, 10, 'The note', 'note');
  if char_length(v_note) > 2000 then
    perform app.raise_error('VALIDATION', 'The note is longer than 2000 characters', 'note');
  end if;
  perform app.notify(
    (select array_agg(user_id) from public.system_roles where role = 'hod' and revoked_at is null),
    'escalation',
    format('Escalated by the lead: %s',
           (select coalesce(s.full_name, 'a project') from public.students s where s.id = v_project.student_id)),
    v_note, '/projects/' || p_project_id, p_project_id);
  perform app.log_action('project.escalated', 'projects', p_project_id, p_project_id, v_project.semester_id,
    jsonb_build_object('note', v_note));
end;
$$;

-- -----------------------------------------------------------------------------
-- Review meetings (DATABASE_SPEC.md §7): attendees and per-project outcomes.
-- Students see only the outcomes for their own project.
-- -----------------------------------------------------------------------------
create table public.review_meetings (
  id          uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id),
  held_on     timestamptz not null,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  notes       text check (notes is null or char_length(notes) <= 10000),
  recorded_by uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index review_meetings_semester_idx on public.review_meetings (semester_id, held_on desc);
create index review_meetings_recorded_by_idx on public.review_meetings (recorded_by);

create table public.meeting_attendees (
  meeting_id uuid not null references public.review_meetings (id),
  user_id    uuid not null references public.profiles (id),
  primary key (meeting_id, user_id)
);
create index meeting_attendees_user_idx on public.meeting_attendees (user_id);

create table public.meeting_outcomes (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.review_meetings (id),
  project_id   uuid not null references public.projects (id),
  outcome      text not null check (char_length(btrim(outcome)) between 3 and 5000),
  action_items text[] not null default '{}',
  unique (meeting_id, project_id)
);
create index meeting_outcomes_project_idx on public.meeting_outcomes (project_id);

-- Meetings are a record of what happened: not edited afterwards.
create trigger review_meetings_immutable before update or delete on public.review_meetings
  for each row execute function app.prevent_mutation();
create trigger meeting_outcomes_immutable before update or delete on public.meeting_outcomes
  for each row execute function app.prevent_mutation();

alter table public.review_meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.meeting_outcomes enable row level security;
revoke all on public.review_meetings, public.meeting_attendees, public.meeting_outcomes from anon, authenticated;
grant select on public.review_meetings, public.meeting_attendees, public.meeting_outcomes to authenticated;

create policy review_meetings_select on public.review_meetings for select to authenticated
  using (app.is_faculty_level(semester_id) or app.is_admin()
         or exists (select 1 from public.meeting_outcomes o where o.meeting_id = review_meetings.id and app.is_project_student(o.project_id)));
create policy meeting_attendees_select on public.meeting_attendees for select to authenticated
  using (exists (select 1 from public.review_meetings m where m.id = meeting_id
                 and (app.is_faculty_level(m.semester_id) or app.is_admin())));
create policy meeting_outcomes_select on public.meeting_outcomes for select to authenticated
  using (app.can_view_project(project_id));

create or replace function public.app_record_meeting(
  p_semester_id uuid,
  p_held_on timestamptz,
  p_title text,
  p_notes text,
  p_attendee_ids uuid[],
  p_outcomes jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active_user();
  v_id uuid;
  v_item jsonb;
  v_project uuid;
  v_outcome text;
  v_actions text[];
begin
  if not app.is_faculty_level(p_semester_id) then
    perform app.raise_error('FORBIDDEN', 'Only faculty can record a review meeting');
  end if;
  perform app.require_open_semester(p_semester_id);
  if p_held_on is null or p_held_on > now() + interval '1 day' then
    perform app.raise_error('VALIDATION', 'Give the date and time the meeting was held', 'held_on');
  end if;
  if nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 200 then
    perform app.raise_error('VALIDATION', 'Title must be 1–200 characters', 'title');
  end if;
  if char_length(p_notes) > 10000 then
    perform app.raise_error('VALIDATION', 'The notes are too long', 'notes');
  end if;
  if exists (select 1 from unnest(coalesce(p_attendee_ids, '{}')) a
             where not (app.is_faculty_member(a, p_semester_id)
                        or exists (select 1 from public.memberships where user_id = a and semester_id = p_semester_id and is_active))) then
    perform app.raise_error('VALIDATION', 'Attendees must be members of this semester', 'attendee_ids');
  end if;
  if p_outcomes is null or jsonb_typeof(p_outcomes) <> 'array' or jsonb_array_length(p_outcomes) > 200 then
    perform app.raise_error('VALIDATION', 'Outcomes must be a list', 'outcomes');
  end if;

  insert into public.review_meetings (semester_id, held_on, title, notes, recorded_by)
  values (p_semester_id, p_held_on, btrim(p_title), nullif(btrim(p_notes), ''), v_uid)
  returning id into v_id;
  insert into public.meeting_attendees (meeting_id, user_id)
  select distinct v_id, a from unnest(coalesce(p_attendee_ids, '{}')) a;

  for v_item in select * from jsonb_array_elements(p_outcomes) loop
    v_project := app.try_uuid(v_item ->> 'project_id');
    if v_project is null or not exists (select 1 from public.projects where id = v_project and semester_id = p_semester_id) then
      perform app.raise_error('VALIDATION', 'Each outcome must be for a project of this semester', 'outcomes');
    end if;
    v_outcome := app.min_text(v_item ->> 'outcome', 3, 'Each outcome', 'outcomes');
    v_actions := app.jtext_array(v_item, 'action_items', 'Action items', 20, 500);
    begin
      insert into public.meeting_outcomes (meeting_id, project_id, outcome, action_items)
      values (v_id, v_project, v_outcome, v_actions);
    exception when unique_violation then
      perform app.raise_error('VALIDATION', 'Each project can have only one outcome per meeting', 'outcomes');
    end;
    perform app.notify(array[app.project_student_id(v_project)], 'meeting',
      format('Meeting outcome recorded: %s', btrim(p_title)), left(v_outcome, 300),
      '/projects/' || v_project, v_project);
  end loop;
  perform app.log_action('meeting.recorded', 'review_meetings', v_id, null, p_semester_id,
    jsonb_build_object('title', p_title, 'outcomes', jsonb_array_length(p_outcomes)));
  return v_id;
end;
$$;
