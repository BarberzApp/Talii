-- Booking integrity: overlap exclusion, uniqueness of Stripe ids, CHECK
-- constraints, and the create_booking_hold function.
begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- Fixture: barbers A and B with services and add-ons, client C.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'bk.barber.a@example.com', '{"role":"barber"}'),
  ('22222222-2222-4222-8222-222222222222', 'bk.barber.b@example.com', '{"role":"barber"}'),
  ('33333333-3333-4333-8333-333333333333', 'bk.client@example.com', '{}');

create temporary table fx on commit drop as
select
  (select id from public.barbers where user_id = '11111111-1111-4111-8111-111111111111') as barber_a,
  (select id from public.barbers where user_id = '22222222-2222-4222-8222-222222222222') as barber_b,
  '33333333-3333-4333-8333-333333333333'::uuid as client;
grant select on fx to public;

insert into public.services (id, barber_id, name, duration_minutes, price_cents, is_active)
select 'c0000000-0000-4000-8000-0000000000a1'::uuid, barber_a, 'A cut', 45, 4000, true from fx union all
select 'c0000000-0000-4000-8000-0000000000a2', barber_a, 'A retired', 30, 1000, false from fx union all
select 'c0000000-0000-4000-8000-0000000000b1', barber_b, 'B cut', 30, 3000, true from fx;

insert into public.service_addons (id, barber_id, name, price_cents, is_active)
select 'd0000000-0000-4000-8000-0000000000a1'::uuid, barber_a, 'Beard', 1000, true from fx union all
select 'd0000000-0000-4000-8000-0000000000a2', barber_a, 'Towel', 500, true from fx union all
select 'd0000000-0000-4000-8000-0000000000a3', barber_a, 'Old', 700, false from fx union all
select 'd0000000-0000-4000-8000-0000000000b1', barber_b, 'B brows', 500, true from fx;

-- Base confirmed booking for barber A: 2030-01-01 10:00-10:45 UTC.
insert into public.bookings (id, barber_id, client_id, service_id, starts_at, ends_at, status, payment_intent_id)
select 'e0000000-0000-4000-8000-000000000001', barber_a, client, 'c0000000-0000-4000-8000-0000000000a1',
       '2030-01-01 10:00+00', '2030-01-01 10:45+00', 'confirmed', 'pi_bk_base' from fx;

-- Overlap exclusion ----------------------------------------------------------------

select throws_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2030-01-01 10:30+00', '2030-01-01 11:15+00', 'pending')$$,
  (select barber_a from fx), (select client from fx)),
  '23P01', null, 'overlapping pending booking for the same barber is rejected');

select throws_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2030-01-01 09:30+00', '2030-01-01 10:01+00', 'confirmed')$$,
  (select barber_a from fx), (select client from fx)),
  '23P01', null, 'overlapping confirmed booking for the same barber is rejected');

select lives_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2030-01-01 10:45+00', '2030-01-01 11:30+00', 'confirmed')$$,
  (select barber_a from fx), (select client from fx)),
  'back-to-back booking (end == next start) is allowed');

select lives_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000b1', '2030-01-01 10:00+00', '2030-01-01 10:30+00', 'confirmed')$$,
  (select barber_b from fx), (select client from fx)),
  'same time with a different barber is allowed');

insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status, cancelled_at)
select barber_a, client, 'c0000000-0000-4000-8000-0000000000a1', '2030-01-02 10:00+00', '2030-01-02 10:45+00', 'cancelled', now()
from fx;

select lives_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2030-01-02 10:00+00', '2030-01-02 10:45+00', 'pending')$$,
  (select barber_a from fx), (select client from fx)),
  'a cancelled booking does not block its slot');

select lives_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2030-01-01 10:15+00', '2030-01-01 10:30+00', 'no_show')$$,
  (select barber_a from fx), (select client from fx)),
  'completed/no_show rows are outside the exclusion constraint');

select throws_ok(format($$update public.bookings set status = 'cancelled' where id = 'e0000000-0000-4000-8000-000000000001';
  insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2030-01-01 10:00+00', '2030-01-01 10:45+00', 'confirmed');
  update public.bookings set status = 'confirmed' where id = 'e0000000-0000-4000-8000-000000000001'$$,
  (select barber_a from fx), (select client from fx)),
  '23P01', null, 're-activating a cancelled booking over a taken slot is rejected');

-- Uniqueness ------------------------------------------------------------------------

select throws_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, payment_intent_id)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2031-01-01 10:00+00', '2031-01-01 10:45+00', 'pi_bk_base')$$,
  (select barber_a from fx), (select client from fx)),
  '23505', null, 'duplicate payment_intent_id is rejected');

select lives_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2031-02-01 10:00+00', '2031-02-01 10:45+00', 'confirmed'),
         (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2031-03-01 10:00+00', '2031-03-01 10:45+00', 'confirmed')$$,
  (select barber_a from fx), (select client from fx), (select barber_a from fx), (select client from fx)),
  'many bookings may have a null payment_intent_id');

insert into public.payments (booking_id, type, stripe_object_id, payment_intent_id, amount_cents, application_fee_cents, status)
values ('e0000000-0000-4000-8000-000000000001', 'charge', 'pi_bk_base', 'pi_bk_base', 340, 220, 'succeeded');

select throws_ok($$insert into public.payments (booking_id, type, stripe_object_id, payment_intent_id, amount_cents, status)
  values ('e0000000-0000-4000-8000-000000000001', 'charge', 'pi_bk_base', 'pi_bk_base', 340, 'succeeded')$$,
  '23505', null, 'duplicate stripe_object_id (charge) is rejected');
select lives_ok($$insert into public.payments (booking_id, type, stripe_object_id, payment_intent_id, amount_cents, status)
  values ('e0000000-0000-4000-8000-000000000001', 'refund', 're_bk_1', 'pi_bk_base', 340, 'succeeded')$$,
  'a refund row with its own re_ id is accepted');
select throws_ok($$insert into public.payments (booking_id, type, stripe_object_id, payment_intent_id, amount_cents, status)
  values ('e0000000-0000-4000-8000-000000000001', 'refund', 're_bk_1', 'pi_bk_base', 340, 'succeeded')$$,
  '23505', null, 'duplicate refund stripe_object_id is rejected');

select throws_ok($$insert into public.booking_addons (booking_id, addon_id, name, price_cents)
  values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000a1', 'Beard', 1000),
         ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000a1', 'Beard', 1000)$$,
  '23505', null, 'the same add-on cannot be attached twice to one booking');

-- CHECK constraints -------------------------------------------------------------------

select throws_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2032-01-01 10:00+00', '2032-01-01 10:00+00')$$,
  (select barber_a from fx), (select client from fx)),
  '23514', null, 'ends_at must be after starts_at');

select throws_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status, hold_expires_at)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2032-01-01 10:00+00', '2032-01-01 10:45+00', 'confirmed', now())$$,
  (select barber_a from fx), (select client from fx)),
  '23514', null, 'hold_expires_at is only allowed on pending bookings');

select throws_ok(format($$insert into public.bookings (barber_id, service_id, starts_at, ends_at, source)
  values (%L, 'c0000000-0000-4000-8000-0000000000a1', '2032-01-01 10:00+00', '2032-01-01 10:45+00', 'manual')$$,
  (select barber_a from fx)),
  '23514', null, 'a manual booking needs a customer_name');

select throws_ok(format($$insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, booking_fee_cents)
  values (%L, %L, 'c0000000-0000-4000-8000-0000000000a1', '2032-01-01 10:00+00', '2032-01-01 10:45+00', -1)$$,
  (select barber_a from fx), (select client from fx)),
  '23514', null, 'money columns cannot be negative');

select throws_ok(format($$insert into public.reviews (booking_id, barber_id, client_id, rating)
  values ('e0000000-0000-4000-8000-000000000001', %L, %L, 5)$$,
  (select barber_b from fx), (select client from fx)),
  '23503', null, 'a review must name the barber of its booking');

select throws_ok(format($$insert into public.reviews (booking_id, barber_id, client_id, rating)
  values ('e0000000-0000-4000-8000-000000000001', %L, %L, 6)$$,
  (select barber_a from fx), (select client from fx)),
  '23514', null, 'rating must be between 1 and 5');

select throws_ok($$insert into public.blocked_users (blocker_id, blocked_id)
  values ('33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333')$$,
  '23514', null, 'a user cannot block themselves');

select throws_ok($$insert into public.waitlist (email) values ('Same@Example.com'), ('same@example.com')$$,
  '23505', null, 'waitlist email is unique case-insensitively');

select throws_ok(format('delete from public.barbers where id = %L', (select barber_a from fx)),
  '23503', null, 'a barber with bookings cannot be deleted');

-- create_booking_hold ------------------------------------------------------------------

-- An expired hold on 2030-01-03 10:00 for barber A, and one for barber B.
insert into public.bookings (id, barber_id, client_id, service_id, starts_at, ends_at, status, payment_status, hold_expires_at)
select 'e0000000-0000-4000-8000-0000000000e1'::uuid, barber_a, client, 'c0000000-0000-4000-8000-0000000000a1'::uuid,
       '2030-01-03 10:00+00'::timestamptz, '2030-01-03 10:45+00'::timestamptz, 'pending', 'pending', now() - interval '1 minute' from fx
union all
select 'e0000000-0000-4000-8000-0000000000e2', barber_b, client, 'c0000000-0000-4000-8000-0000000000b1',
       '2030-01-03 10:00+00', '2030-01-03 10:30+00', 'pending', 'pending', now() - interval '1 minute' from fx;

set local role service_role;

create temporary table hold on commit drop as
select * from public.create_booking_hold(
  (select barber_a from fx), (select client from fx), 'c0000000-0000-4000-8000-0000000000a1',
  '2030-01-03 10:15+00', now() + interval '10 minutes', 340, 220, 120,
  array['d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-0000000000a2']::uuid[], 'first visit');

reset role;

select is((select status || '/' || cancellation_reason from public.bookings where id = 'e0000000-0000-4000-8000-0000000000e1'),
  'cancelled/hold_expired', 'create_booking_hold releases the barber''s expired hold');
select is((select hold_expires_at from public.bookings where id = 'e0000000-0000-4000-8000-0000000000e1'), null,
  'released hold no longer carries hold_expires_at');
select is((select status from public.bookings where id = 'e0000000-0000-4000-8000-0000000000e2'), 'pending',
  'expired holds of other barbers are left alone');
select is((select status || '/' || payment_status from hold), 'pending/pending', 'new hold is pending with payment pending');
select is((select ends_at - starts_at from hold), interval '45 minutes', 'ends_at is starts_at plus the service duration');
select is((select array[service_price_cents, addon_total_cents, booking_fee_cents, application_fee_cents, barber_fee_share_cents] from hold),
  array[4000, 1500, 340, 220, 120], 'prices are snapshotted and fees stored');
select is((select count(*)::int from public.booking_addons where booking_id = (select id from hold)), 2,
  'add-on snapshots are written');

set local role service_role;

select throws_ok(format($$select public.create_booking_hold(%L, %L, 'c0000000-0000-4000-8000-0000000000a1',
  '2030-01-03 10:30+00', now() + interval '10 minutes', 340, 220, 120)$$, (select barber_a from fx), (select client from fx)),
  '23P01', null, 'a hold over an active hold fails with 23P01 (slot taken)');

select throws_ok(format($$select public.create_booking_hold(%L, %L, 'c0000000-0000-4000-8000-0000000000b1',
  '2030-02-01 10:00+00', now() + interval '10 minutes', 340, 220, 120)$$, (select barber_a from fx), (select client from fx)),
  '22023', null, 'a service of another barber is rejected');

select throws_ok(format($$select public.create_booking_hold(%L, %L, 'c0000000-0000-4000-8000-0000000000a2',
  '2030-02-01 10:00+00', now() + interval '10 minutes', 340, 220, 120)$$, (select barber_a from fx), (select client from fx)),
  '22023', null, 'an inactive service is rejected');

select throws_ok(format($$select public.create_booking_hold(%L, %L, 'c0000000-0000-4000-8000-0000000000a1',
  '2030-02-01 10:00+00', now() + interval '10 minutes', 340, 220, 120, array['d0000000-0000-4000-8000-0000000000a3']::uuid[])$$,
  (select barber_a from fx), (select client from fx)),
  '22023', null, 'an inactive add-on is rejected');

select throws_ok(format($$select public.create_booking_hold(%L, %L, 'c0000000-0000-4000-8000-0000000000a1',
  '2030-02-01 10:00+00', now() - interval '1 second', 340, 220, 120)$$, (select barber_a from fx), (select client from fx)),
  '22023', null, 'a hold expiry in the past is rejected');

reset role;

select * from finish();
rollback;
