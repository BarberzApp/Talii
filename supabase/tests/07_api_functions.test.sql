-- Service-role functions used by the Phase 3b API: replace_availability,
-- search_barbers, admin_platform_stats.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- Privileges -------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.replace_availability(uuid,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.replace_availability(uuid,jsonb)', 'execute'),
  'clients cannot execute replace_availability');
select ok(
  not has_function_privilege('anon', 'public.search_barbers(text,uuid[],integer,integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.search_barbers(text,uuid[],integer,integer)', 'execute'),
  'clients cannot execute search_barbers');
select ok(
  not has_function_privilege('anon', 'public.admin_platform_stats(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_platform_stats(timestamptz)', 'execute'),
  'clients cannot execute admin_platform_stats');
select ok(
  has_function_privilege('service_role', 'public.replace_availability(uuid,jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.search_barbers(text,uuid[],integer,integer)', 'execute')
  and has_function_privilege('service_role', 'public.admin_platform_stats(timestamptz)', 'execute'),
  'service_role can execute all three');

-- Fixtures -----------------------------------------------------------------------

create temp table stats_before as select * from public.admin_platform_stats(now() - interval '1 hour');

insert into auth.users (id, email, raw_user_meta_data) values
  ('f1000000-0000-4000-8000-000000000001', 'api.barber.a@example.com', '{"name":"Quinn Zebra","role":"barber","username":"qzebra","business_name":"Zebra Cuts"}'),
  ('f1000000-0000-4000-8000-000000000002', 'api.barber.b@example.com', '{"name":"Hidden Barber","role":"barber","username":"hiddenb","business_name":"Zebra Hidden"}'),
  ('f1000000-0000-4000-8000-000000000003', 'api.barber.c@example.com', '{"name":"Off Line","role":"barber","username":"offline","business_name":"Zebra Disabled"}'),
  ('f1000000-0000-4000-8000-000000000004', 'api.client@example.com', '{"name":"Api Client"}');

update public.barbers set city = 'Zebraville', state = 'ZZ'
  where user_id = 'f1000000-0000-4000-8000-000000000001';
update public.barbers set is_public = false where user_id = 'f1000000-0000-4000-8000-000000000002';
update public.profiles set is_disabled = true where id = 'f1000000-0000-4000-8000-000000000003';

create temp table api_barber as
  select id from public.barbers where user_id = 'f1000000-0000-4000-8000-000000000001';

-- replace_availability ------------------------------------------------------------

insert into public.availability (barber_id, day_of_week, start_time, end_time)
select id, 3, '08:00', '10:00' from api_barber;

select is(
  (select count(*)::int from public.replace_availability((select id from api_barber),
    '[{"day_of_week":1,"start_time":"09:00","end_time":"12:00"},
      {"day_of_week":1,"start_time":"12:00","end_time":"17:00"},
      {"day_of_week":5,"start_time":"10:00","end_time":"24:00"}]'::jsonb)),
  3, 'returns the new schedule (touching windows allowed, 24:00 end allowed)');

select is(
  (select array_agg(day_of_week || ' ' || start_time || '-' || end_time order by day_of_week, start_time)
     from public.availability where barber_id = (select id from api_barber)),
  array['1 09:00:00-12:00:00', '1 12:00:00-17:00:00', '5 10:00:00-24:00:00'],
  'old windows are removed and the new ones stored');

select throws_ok(
  format($$select * from public.replace_availability(%L,
    '[{"day_of_week":2,"start_time":"09:00","end_time":"12:00"},{"day_of_week":2,"start_time":"11:00","end_time":"13:00"}]')$$,
    (select id from api_barber)),
  '22023', 'availability windows overlap', 'overlapping windows on one day are rejected');

select is(
  (select count(*)::int from public.availability where barber_id = (select id from api_barber)),
  3, 'a rejected replace leaves the previous schedule intact');

select throws_ok(
  format($$select * from public.replace_availability(%L, '[{"day_of_week":2,"start_time":"12:00","end_time":"09:00"}]')$$,
    (select id from api_barber)),
  '23514', null, 'start after end is rejected');

select throws_ok(
  format($$select * from public.replace_availability(%L, '[{"day_of_week":7,"start_time":"09:00","end_time":"10:00"}]')$$,
    (select id from api_barber)),
  '23514', null, 'day_of_week outside 0-6 is rejected');

select throws_ok(
  $$select * from public.replace_availability('f9999999-0000-4000-8000-000000000000', '[]')$$,
  '22023', null, 'unknown barber is rejected');

select throws_ok(
  format($$select * from public.replace_availability(%L, '{"day_of_week":1}')$$, (select id from api_barber)),
  '22023', 'p_windows must be a JSON array', 'non-array input is rejected');

select is(
  (select count(*)::int from public.replace_availability((select id from api_barber), '[]')),
  0, 'an empty array clears the schedule');

select is(
  (select count(*)::int from public.availability where barber_id = (select id from api_barber)),
  0, 'the schedule is empty afterwards');

-- search_barbers ------------------------------------------------------------------

select is(
  (select array_agg(username order by username) from public.search_barbers('ZEBRA')),
  array['qzebra'], 'matches business name case-insensitively; unlisted and disabled barbers are excluded');

select is(
  (select count(*)::int from public.search_barbers('quinn')), 1, 'matches the profile name');
select is(
  (select count(*)::int from public.search_barbers('zebraville')), 1, 'matches the city');
select is(
  (select count(*)::int from public.search_barbers('zz')), 1, 'matches the state');
select is(
  (select count(*)::int from public.search_barbers('%')), 0, 'pattern characters are literal');

select is(
  (select count(*)::int from public.search_barbers('zebra', array['f1000000-0000-4000-8000-000000000001'::uuid])),
  0, 'excluded owners are dropped');

select ok(
  (select count(*) from public.search_barbers(null)) >= 1
  and not exists (select 1 from public.search_barbers('') s
                  where s.user_id in ('f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003')),
  'an empty query lists listed barbers only');

select is(
  (select count(*)::int from public.search_barbers(null, '{}', 1, 0)), 1, 'limit applies');
select ok(
  (select s.id from public.search_barbers(null, '{}', 1, 0) s)
    is distinct from (select s.id from public.search_barbers(null, '{}', 1, 1) s),
  'offset pages through results');

-- admin_platform_stats --------------------------------------------------------------

insert into public.services (id, barber_id, name, duration_minutes, price_cents)
select 'f2000000-0000-4000-8000-000000000001', id, 'Cut', 30, 3000 from api_barber;

insert into public.bookings (id, barber_id, client_id, service_id, starts_at, ends_at, status, payment_status, payment_intent_id)
select 'f3000000-0000-4000-8000-000000000001', id, 'f1000000-0000-4000-8000-000000000004',
       'f2000000-0000-4000-8000-000000000001', now() + interval '2 days', now() + interval '2 days 30 minutes',
       'confirmed', 'partially_refunded', 'pi_api_stats_1'
from api_barber;

insert into public.payments (booking_id, type, stripe_object_id, payment_intent_id, amount_cents, application_fee_cents, status) values
  ('f3000000-0000-4000-8000-000000000001', 'charge', 'pi_api_stats_1', 'pi_api_stats_1', 340, 220, 'succeeded'),
  ('f3000000-0000-4000-8000-000000000001', 'refund', 're_api_stats_1', 'pi_api_stats_1', 170, 0, 'succeeded'),
  ('f3000000-0000-4000-8000-000000000001', 'refund', 're_api_stats_1f', 'pi_api_stats_1', 170, 0, 'failed');

insert into public.reports (reporter_id, reported_user_id, content_type, content_id, reason)
values ('f1000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000001', 'user',
        'f1000000-0000-4000-8000-000000000001', 'spam');

insert into public.waitlist (email) values ('stats.waitlist@example.com');

create temp table stats_after as select * from public.admin_platform_stats(now() - interval '1 hour');

select is(
  (select (a.users_total - b.users_total, a.barbers_total - b.barbers_total, a.clients_total - b.clients_total,
           a.disabled_total - b.disabled_total, a.users_new_since - b.users_new_since)
     from stats_after a, stats_before b),
  (4::bigint, 3::bigint, 1::bigint, 1::bigint, 4::bigint),
  'user counts by role, disabled and new');

select is(
  (select a.barbers_listed - b.barbers_listed from stats_after a, stats_before b),
  1::bigint, 'only the public, enabled barber counts as listed');

select is(
  (select (a.bookings_total - b.bookings_total, a.bookings_confirmed - b.bookings_confirmed,
           a.bookings_upcoming - b.bookings_upcoming, a.bookings_new_since - b.bookings_new_since)
     from stats_after a, stats_before b),
  (1::bigint, 1::bigint, 1::bigint, 1::bigint),
  'booking counts');

select is(
  (select (a.fees_charged_cents - b.fees_charged_cents, a.platform_fees_cents - b.platform_fees_cents,
           a.refunded_cents - b.refunded_cents, a.platform_fees_refunded_cents - b.platform_fees_refunded_cents,
           a.platform_fees_since_cents - b.platform_fees_since_cents)
     from stats_after a, stats_before b),
  (340::bigint, 220::bigint, 170::bigint, 110::bigint, 220::bigint),
  'fee totals: charge, application fee, refunds (failed ignored) and the proportional fee refund');

select is(
  (select (a.reports_pending - b.reports_pending, a.waitlist_total - b.waitlist_total)
     from stats_after a, stats_before b),
  (1::bigint, 1::bigint),
  'pending reports and waitlist');

select * from finish();
rollback;
