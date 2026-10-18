-- Guard: internal `app` helpers must not be callable by API roles, except the
-- allow-listed ones that RLS policies and triggers evaluate as the caller.
-- Every public function must be closed to `anon`.
begin;
select tests.assert_eq(
  (select string_agg(p.oid::regprocedure::text, ', ' order by 1)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app'
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
     and p.proname not in ('is_api_role', 'raise_error', 'is_active_user', 'is_hod', 'is_admin',
                           'has_admin_permission', 'semester_role', 'is_faculty_level', 'is_lead',
                           'is_semester_member', 'can_view_profile', 'project_semester',
                           'is_project_student', 'can_view_project', 'is_project_reviewer')),
  null, 'app functions callable by API roles outside the allow-list');
select tests.assert_eq(
  (select string_agg(p.oid::regprocedure::text, ', ' order by 1)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('is_api_role', 'raise_error')),
  null, 'app functions callable by anon');
select tests.assert_eq(
  (select string_agg(p.oid::regprocedure::text, ', ' order by 1)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.prokind = 'f'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  null, 'public functions callable by anon');
select tests.pass('function privileges');
rollback;
