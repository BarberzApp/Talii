-- Grants and catalog-level guarantees: RLS everywhere, safe SECURITY DEFINER
-- functions, and no client INSERT/UPDATE/DELETE on any table or view.
begin;
create extension if not exists pgtap with schema extensions;

select plan(114);

-- Catalog checks ---------------------------------------------------------------

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')),
  15, 'schema public has exactly the 15 baseline tables');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0, 'every table in public has row-level security enabled');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not coalesce('search_path=""' = any (p.proconfig), false)),
  0, 'every SECURITY DEFINER function in public pins search_path to empty');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0, 'every function in public sets a search_path');

select is(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     cross join (values ('anon'), ('authenticated')) r (role)
     cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p (priv)
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and has_table_privilege(r.role, c.oid, p.priv)),
  0, 'anon and authenticated hold no write privilege on any table or view in public');

select is(
  (select count(*)::int from pg_attribute a
    where a.attrelid = 'public.public_profiles'::regclass and a.attnum > 0
      and a.attname in ('email', 'phone', 'is_disabled')),
  0, 'public_profiles exposes no email, phone or is_disabled column');

select ok(not has_function_privilege('anon', 'public.create_booking_hold(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,uuid[],text)', 'execute'),
  'anon cannot execute create_booking_hold');
select ok(not has_function_privilege('authenticated', 'public.create_booking_hold(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,uuid[],text)', 'execute'),
  'authenticated cannot execute create_booking_hold');
select ok(has_function_privilege('service_role', 'public.create_booking_hold(uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,uuid[],text)', 'execute'),
  'service_role can execute create_booking_hold');
select ok(has_function_privilege('anon', 'public.nearby_barbers(double precision,double precision,double precision,integer)', 'execute'),
  'anon can execute nearby_barbers');

select is(
  (select count(*)::int from pg_attribute a
    where a.attrelid = 'public.public_reviews'::regclass and a.attnum > 0
      and a.attname in ('client_id', 'booking_id')),
  0, 'public_reviews exposes no client_id or booking_id');

select ok(
  not has_function_privilege('anon', 'public.barber_earnings_totals(uuid,timestamptz,timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.barber_earnings_totals(uuid,timestamptz,timestamptz)', 'execute'),
  'clients cannot execute barber_earnings_totals');
select ok(
  not has_function_privilege('anon', 'public.barber_earnings_bookings(uuid,timestamptz,timestamptz,integer,integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.barber_earnings_bookings(uuid,timestamptz,timestamptz,integer,integer)', 'execute'),
  'clients cannot execute barber_earnings_bookings');
select ok(
  has_function_privilege('service_role', 'public.barber_earnings_totals(uuid,timestamptz,timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.barber_earnings_bookings(uuid,timestamptz,timestamptz,integer,integer)', 'execute'),
  'service_role can execute the earnings functions');
select ok(
  not has_column_privilege('anon', 'public.special_hours', 'reason', 'select')
  and not has_column_privilege('authenticated', 'public.reviews', 'client_id', 'select'),
  'private columns are not granted (special_hours.reason, reviews.client_id)');

-- Behaviour: anon --------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(format('insert into public.%I default values', t), '42501', null, format('anon cannot insert into %s', t))
from unnest(array['profiles','barbers','barber_billing','services','service_addons','availability','special_hours',
  'bookings','booking_addons','payments','stripe_events','reviews','reports','blocked_users','waitlist']) t;

select throws_ok(format('update public.%I set created_at = created_at', t), '42501', null, format('anon cannot update %s', t))
from unnest(array['profiles','barbers','barber_billing','services','service_addons','availability','special_hours',
  'bookings','booking_addons','payments','stripe_events','reviews','reports','blocked_users','waitlist']) t;

select throws_ok(format('delete from public.%I', t), '42501', null, format('anon cannot delete from %s', t))
from unnest(array['profiles','barbers','barber_billing','services','service_addons','availability','special_hours',
  'bookings','booking_addons','payments','stripe_events','reviews','reports','blocked_users','waitlist']) t;

select throws_ok(format('select * from public.%I', t), '42501', null, format('anon cannot read %s', t))
from unnest(array['barber_billing','stripe_events','waitlist']) t;

select throws_ok('update public.public_profiles set name = name', '42501', null, 'anon cannot update through public_profiles');

reset role;

-- Behaviour: authenticated -----------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated"}';

select throws_ok(format('insert into public.%I default values', t), '42501', null, format('authenticated cannot insert into %s', t))
from unnest(array['profiles','barbers','barber_billing','services','service_addons','availability','special_hours',
  'bookings','booking_addons','payments','stripe_events','reviews','reports','blocked_users','waitlist']) t;

select throws_ok(format('update public.%I set created_at = created_at', t), '42501', null, format('authenticated cannot update %s', t))
from unnest(array['profiles','barbers','barber_billing','services','service_addons','availability','special_hours',
  'bookings','booking_addons','payments','stripe_events','reviews','reports','blocked_users','waitlist']) t;

select throws_ok(format('delete from public.%I', t), '42501', null, format('authenticated cannot delete from %s', t))
from unnest(array['profiles','barbers','barber_billing','services','service_addons','availability','special_hours',
  'bookings','booking_addons','payments','stripe_events','reviews','reports','blocked_users','waitlist']) t;

select throws_ok(format('select * from public.%I', t), '42501', null, format('authenticated cannot read %s', t))
from unnest(array['barber_billing','stripe_events','waitlist']) t;

select throws_ok('update public.public_profiles set name = name', '42501', null, 'authenticated cannot update through public_profiles');

select throws_ok(
  $$select public.create_booking_hold(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), now(), now() + interval '10 minutes', 340, 220, 120)$$,
  '42501', null, 'authenticated cannot call create_booking_hold');

reset role;

select * from finish();
rollback;
