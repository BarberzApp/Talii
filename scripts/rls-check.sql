-- Read-only catalog checks for the security model in docs/database/SCHEMA.md.
-- Safe to run in any SQL console; every query should return zero rows.
-- The full behavioural suite is in supabase/tests (run with `supabase test db`).

-- 1. Tables in public without row-level security.
select c.relname as table_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;

-- 2. SECURITY DEFINER functions in public that do not pin search_path to ''.
select p.oid::regprocedure as unsafe_security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not coalesce('search_path=""' = any (p.proconfig), false);

-- 3. Write privileges held by anon or authenticated on public tables and views.
select r.role, c.relname, p.priv
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated')) r (role)
cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p (priv)
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  and has_table_privilege(r.role, c.oid, p.priv);

-- 4. Server-only tables readable by anon or authenticated.
select r.role, t.tbl
from (values ('anon'), ('authenticated')) r (role)
cross join (values ('public.barber_billing'), ('public.stripe_events'), ('public.waitlist')) t (tbl)
where has_table_privilege(r.role, t.tbl, 'SELECT');
