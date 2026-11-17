-- Row-level read isolation, acting as anon, two clients, two barbers and an admin.
begin;
create extension if not exists pgtap with schema extensions;

select plan(56);

-- Fixture (as postgres) ----------------------------------------------------------
--   barber A (public), barber B (public), barber H (not public), barber D (profile disabled)
--   client C1, client C2, admin X (app_metadata.role = admin)

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'rls.barber.a@example.com', '{"name":"Barber A"}', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'rls.barber.b@example.com', '{"name":"Barber B"}', '{}'),
  ('55555555-5555-4555-8555-555555555555', 'rls.barber.h@example.com', '{"name":"Barber H"}', '{}'),
  ('66666666-6666-4666-8666-666666666666', 'rls.barber.d@example.com', '{"name":"Barber D"}', '{}'),
  ('33333333-3333-4333-8333-333333333333', 'rls.client.1@example.com', '{"name":"Client One","phone":"555-0101"}', '{}'),
  ('44444444-4444-4444-8444-444444444444', 'rls.client.2@example.com', '{"name":"Client Two","phone":"555-0102"}', '{}'),
  ('77777777-7777-4777-8777-777777777777', 'rls.admin@example.com', '{"name":"Admin"}', '{"role":"admin"}');

update public.profiles set role = 'barber'
 where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
              '55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666');
update public.profiles set is_disabled = true where id = '66666666-6666-4666-8666-666666666666';

insert into public.barbers (id, user_id, business_name, is_public, latitude, longitude) values
  ('b0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'A Cuts', true, 10.0, 10.0),
  ('b0000000-0000-4000-8000-00000000000b', '22222222-2222-4222-8222-222222222222', 'B Cuts', true, 10.5, 10.5),
  ('b0000000-0000-4000-8000-00000000000c', '55555555-5555-4555-8555-555555555555', 'Hidden Cuts', false, 10.0, 10.0),
  ('b0000000-0000-4000-8000-00000000000d', '66666666-6666-4666-8666-666666666666', 'Disabled Cuts', true, 10.0, 10.0);

insert into public.services (id, barber_id, name, duration_minutes, price_cents, is_active) values
  ('c0000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-00000000000a', 'A cut', 30, 3000, true),
  ('c0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-00000000000a', 'A old', 30, 3000, false),
  ('c0000000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-00000000000b', 'B cut', 30, 3000, true),
  ('c0000000-0000-4000-8000-0000000000c1', 'b0000000-0000-4000-8000-00000000000c', 'H cut', 30, 3000, true);

insert into public.service_addons (id, barber_id, name, price_cents, is_active) values
  ('d0000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-00000000000a', 'A beard', 500, true),
  ('d0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-00000000000a', 'A old addon', 500, false);

insert into public.availability (barber_id, day_of_week, start_time, end_time) values
  ('b0000000-0000-4000-8000-00000000000a', 1, '09:00', '17:00'),
  ('b0000000-0000-4000-8000-00000000000c', 1, '09:00', '17:00');

insert into public.special_hours (barber_id, date, is_closed, reason) values
  ('b0000000-0000-4000-8000-00000000000a', '2030-01-02', true, 'dentist appointment'),
  ('b0000000-0000-4000-8000-00000000000c', '2030-01-02', true, 'private');

insert into public.bookings (id, barber_id, client_id, service_id, starts_at, ends_at, status, payment_status, payment_intent_id) values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000a', '33333333-3333-4333-8333-333333333333',
    'c0000000-0000-4000-8000-0000000000a1', '2030-01-01 10:00+00', '2030-01-01 10:30+00', 'confirmed', 'succeeded', 'pi_rls_1'),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-00000000000b', '44444444-4444-4444-8444-444444444444',
    'c0000000-0000-4000-8000-0000000000b1', '2030-01-01 10:00+00', '2030-01-01 10:30+00', 'confirmed', 'succeeded', 'pi_rls_2'),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-00000000000a', '33333333-3333-4333-8333-333333333333',
    'c0000000-0000-4000-8000-0000000000a1', '2029-01-01 10:00+00', '2029-01-01 10:30+00', 'completed', 'succeeded', 'pi_rls_3'),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-00000000000b', '44444444-4444-4444-8444-444444444444',
    'c0000000-0000-4000-8000-0000000000b1', '2029-01-01 10:00+00', '2029-01-01 10:30+00', 'completed', 'succeeded', 'pi_rls_4');

insert into public.booking_addons (booking_id, addon_id, name, price_cents)
values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000a1', 'A beard', 500);

insert into public.payments (booking_id, type, stripe_object_id, payment_intent_id, amount_cents, application_fee_cents, status) values
  ('e0000000-0000-4000-8000-000000000001', 'charge', 'pi_rls_1', 'pi_rls_1', 340, 220, 'succeeded'),
  ('e0000000-0000-4000-8000-000000000002', 'charge', 'pi_rls_2', 'pi_rls_2', 340, 220, 'succeeded');

insert into public.reviews (id, booking_id, barber_id, client_id, rating, comment, is_hidden) values
  ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-00000000000a',
    '33333333-3333-4333-8333-333333333333', 5, 'Great', false),
  ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-00000000000b',
    '44444444-4444-4444-8444-444444444444', 1, 'Hidden by moderation', true);

insert into public.reports (reporter_id, reported_user_id, content_type, content_id, reason) values
  ('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', 'user', 'x', 'spam'),
  ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'user', 'y', 'spam');

insert into public.blocked_users (blocker_id, blocked_id) values
  ('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'),
  ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333');

-- Anonymous visitor --------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.bookings', '42501', null, 'anon cannot read bookings');
select throws_ok('select * from public.payments', '42501', null, 'anon cannot read payments');

select is(
  (select array_agg(business_name order by business_name) from public.barbers
    where id::text like 'b0000000-%'),
  array['A Cuts', 'B Cuts'], 'anon sees public barbers only (not hidden, not disabled)');

select is(
  (select array_agg(name order by name) from public.services where barber_id::text like 'b0000000-%'),
  array['A cut', 'B cut'], 'anon sees active services of listed barbers only');

select is(
  (select array_agg(name) from public.service_addons where barber_id::text like 'b0000000-%'),
  array['A beard'], 'anon sees active add-ons only');

select is((select count(*)::int from public.availability where barber_id = 'b0000000-0000-4000-8000-00000000000a'), 1,
  'anon can read availability of a listed barber');
select is_empty($$select 1 from public.availability where barber_id = 'b0000000-0000-4000-8000-00000000000c'$$,
  'anon cannot read availability of a barber that is not public');
select is((select count(*)::int from public.special_hours where barber_id = 'b0000000-0000-4000-8000-00000000000a'), 1,
  'anon can read special hours of a listed barber (without reason)');
select is_empty($$select 1 from public.special_hours where barber_id = 'b0000000-0000-4000-8000-00000000000c'$$,
  'anon cannot read special hours of a barber that is not public');
select throws_ok('select reason from public.special_hours', '42501', null, 'anon cannot read special_hours.reason');

select is(
  (select array_agg(comment) from public.reviews where id::text like 'f0000000-%'),
  array['Great'], 'anon sees visible reviews but not hidden ones');
select throws_ok('select client_id from public.reviews', '42501', null, 'anon cannot read reviews.client_id');
select throws_ok('select booking_id from public.reviews', '42501', null, 'anon cannot read reviews.booking_id');
select is(
  (select array_agg(reviewer_name || ':' || comment) from public.public_reviews where id::text like 'f0000000-%'),
  array['Client:Great'], 'public_reviews shows visible reviews with the reviewer''s first name only');
select is_empty($$select 1 from public.public_reviews where id = 'f0000000-0000-4000-8000-000000000002'$$,
  'public_reviews excludes hidden reviews');

select is((select review_count from public.barber_rating_stats where barber_id = 'b0000000-0000-4000-8000-00000000000a'), 1,
  'barber_rating_stats counts visible reviews');
select is_empty($$select 1 from public.barber_rating_stats where barber_id = 'b0000000-0000-4000-8000-00000000000b'$$,
  'barber_rating_stats ignores hidden reviews');

select is((select count(*)::int from public.public_profiles where id = '11111111-1111-4111-8111-111111111111'), 1,
  'anon can read a listed barber''s profile through public_profiles');
select is_empty($$select 1 from public.public_profiles where id in
    ('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444')$$,
  'public_profiles does not list clients');
select is_empty($$select 1 from public.public_profiles where id = '55555555-5555-4555-8555-555555555555'$$,
  'public_profiles excludes barbers that are not public');
select is_empty($$select 1 from public.public_profiles where id = '66666666-6666-4666-8666-666666666666'$$,
  'public_profiles excludes disabled profiles');

select is(
  (select array_agg(business_name order by distance_miles) from public.nearby_barbers(10.0, 10.0, 100)
    where id::text like 'b0000000-%'),
  array['A Cuts', 'B Cuts'], 'nearby_barbers returns listed barbers nearest first');
select is_empty($$select 1 from public.nearby_barbers(10.0, 10.0, 10) where id = 'b0000000-0000-4000-8000-00000000000b'$$,
  'nearby_barbers respects the radius');

reset role;

-- Client C1 ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

select is((select array_agg(id) from public.profiles), array['33333333-3333-4333-8333-333333333333'::uuid],
  'client reads only own profile row');
select is((select phone from public.profiles where id = '33333333-3333-4333-8333-333333333333'), '555-0101',
  'client reads own phone');
select is_empty($$select email, phone from public.profiles where id = '44444444-4444-4444-8444-444444444444'$$,
  'client cannot read another user''s profile, email or phone');

select is(
  (select array_agg(id order by id) from public.bookings),
  array['e0000000-0000-4000-8000-000000000001'::uuid, 'e0000000-0000-4000-8000-000000000003'::uuid],
  'client reads only own bookings');
select is_empty($$select 1 from public.bookings where id = 'e0000000-0000-4000-8000-000000000002'$$,
  'client cannot read another client''s booking');
select is((select array_agg(stripe_object_id) from public.payments), array['pi_rls_1'],
  'client reads payments of own bookings only');
select is((select count(*)::int from public.booking_addons), 1, 'client reads add-ons of own bookings');

select is((select count(*)::int from public.reports), 1, 'client reads only own reports');
select is((select array_agg(blocked_id) from public.blocked_users), array['44444444-4444-4444-8444-444444444444'::uuid],
  'client reads only own blocks');

select is((select count(*)::int from public.services where id = 'c0000000-0000-4000-8000-0000000000a2'), 0,
  'client cannot read another barber''s inactive service');
select is_empty($$select 1 from public.barbers where id = 'b0000000-0000-4000-8000-00000000000c'$$,
  'client cannot read a non-public barber');

reset role;

-- Client claiming admin only in user_metadata is not admin -------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","user_metadata":{"role":"admin"}}';

select is((select count(*)::int from public.profiles), 1, 'user_metadata.role = admin grants nothing');

reset role;

-- Barber A -----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (select array_agg(id order by id) from public.bookings),
  array['e0000000-0000-4000-8000-000000000001'::uuid, 'e0000000-0000-4000-8000-000000000003'::uuid],
  'barber reads only bookings of own shop');
select is_empty($$select 1 from public.bookings where barber_id = 'b0000000-0000-4000-8000-00000000000b'$$,
  'barber cannot read another barber''s bookings');
select is((select array_agg(stripe_object_id) from public.payments), array['pi_rls_1'],
  'barber reads payments of own bookings only');
select is_empty($$select 1 from public.payments where stripe_object_id = 'pi_rls_2'$$,
  'barber cannot read another barber''s payments');
select is((select count(*)::int from public.services where barber_id = 'b0000000-0000-4000-8000-00000000000a'), 2,
  'barber reads own inactive services too');
select is((select count(*)::int from public.service_addons where barber_id = 'b0000000-0000-4000-8000-00000000000a'), 2,
  'barber reads own inactive add-ons too');
select is((select array_agg(id) from public.profiles), array['11111111-1111-4111-8111-111111111111'::uuid],
  'barber reads only own profile row, not clients''');
select throws_ok('select * from public.barber_billing', '42501', null, 'barber cannot read barber_billing');

reset role;

-- Barber B -----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is_empty($$select 1 from public.bookings where barber_id = 'b0000000-0000-4000-8000-00000000000a'$$,
  'other barber cannot read barber A''s bookings');
select is_empty($$select 1 from public.payments where stripe_object_id = 'pi_rls_1'$$,
  'other barber cannot read barber A''s payments');
select is_empty($$select 1 from public.booking_addons where booking_id = 'e0000000-0000-4000-8000-000000000001'$$,
  'other barber cannot read barber A''s booking add-ons');
select is_empty($$select 1 from public.services where id = 'c0000000-0000-4000-8000-0000000000a2'$$,
  'other barber cannot read barber A''s inactive service');

reset role;

-- Hidden barber H reads own row ----------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';

select is((select count(*)::int from public.barbers where id = 'b0000000-0000-4000-8000-00000000000c'), 1,
  'non-public barber can read own barber row');
select is((select count(*)::int from public.services where id = 'c0000000-0000-4000-8000-0000000000c1'), 1,
  'non-public barber can read own services');
select is((select count(*)::int from public.availability where barber_id = 'b0000000-0000-4000-8000-00000000000c'), 1,
  'non-public barber can read own availability');

reset role;

-- Admin (app_metadata.role = admin) -------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated","app_metadata":{"role":"admin"}}';

select ok((select count(*) from public.profiles where id = '44444444-4444-4444-8444-444444444444') = 1,
  'admin can read any profile');
select ok((select count(*) from public.reviews where id = 'f0000000-0000-4000-8000-000000000002') = 1,
  'admin can read hidden reviews');
select ok((select count(*) from public.bookings where id::text like 'e0000000-%') = 4,
  'admin can read all bookings');
select throws_ok('select * from public.stripe_events', '42501', null, 'admin JWT still cannot read stripe_events directly');
select throws_ok('insert into public.reviews (booking_id, barber_id, rating) values (gen_random_uuid(), gen_random_uuid(), 5)',
  '42501', null, 'admin JWT still cannot write directly');

reset role;

select * from finish();
rollback;
