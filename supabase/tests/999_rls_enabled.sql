-- Guard (DEPLOYMENT_AND_SECURITY.md §5): every table in `public` must have RLS enabled.
begin;
select tests.assert_eq(
  (select string_agg(c.relname, ', ' order by c.relname) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  null, 'tables without row-level security');
select tests.pass('RLS enabled on every public table');
rollback;
