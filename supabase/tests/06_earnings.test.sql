-- barber_earnings_totals / barber_earnings_bookings: correct sums, proportional
-- refund reversal, date range, and isolation between barbers.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('e1000000-0000-4000-8000-000000000001', 'earn.barber.a@example.com', '{"name":"Earn A","role":"barber"}'),
  ('e1000000-0000-4000-8000-000000000002', 'earn.barber.b@example.com', '{"name":"Earn B","role":"barber"}'),
  ('e1000000-0000-4000-8000-000000000003', 'earn.client@example.com', '{"name":"Pat Client"}');

-- handle_new_user created the barbers rows; give them known services.
insert into public.services (id, barber_id, name, duration_minutes, price_cents)
select ('e2000000-0000-4000-8000-00000000000' || x.n)::uuid, b.id, 'Cut ' || x.n, 30, 3000
from (values ('1', 'e1000000-0000-4000-8000-000000000001'), ('2', 'e1000000-0000-4000-8000-000000000002')) x (n, uid)
join public.barbers b on b.user_id = x.uid::uuid;

insert into public.bookings (id, barber_id, client_id, customer_name, service_id, starts_at, ends_at, status,
                             payment_status, service_price_cents, addon_total_cents, payment_intent_id)
select v.id::uuid, b.id, v.client::uuid, v.customer, s.id, v.starts::timestamptz, v.starts::timestamptz + interval '30 minutes',
       v.status, v.pay, 3000, v.addons, v.pi
from (values
  -- barber A: completed + paid, cancelled + half refunded, manual walk-in, one outside the range
  ('e3000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', null, '2030-03-02 15:00+00', 'completed', 'succeeded', 500, 'pi_earn_1'),
  ('e3000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', null, '2030-03-03 15:00+00', 'cancelled', 'partially_refunded', 0, 'pi_earn_2'),
  ('e3000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', null, 'Walk In', '2030-03-04 15:00+00', 'completed', 'none', 0, null),
  ('e3000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', null, '2030-05-01 15:00+00', 'completed', 'succeeded', 0, 'pi_earn_4'),
  -- barber B: paid and fully refunded in the same range
  ('e3000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000003', null, '2030-03-02 15:00+00', 'completed', 'succeeded', 0, 'pi_earn_5')
) v (id, uid, client, customer, starts, status, pay, addons, pi)
join public.barbers b on b.user_id = v.uid::uuid
join public.services s on s.barber_id = b.id;

insert into public.payments (booking_id, type, stripe_object_id, payment_intent_id, amount_cents, application_fee_cents, status) values
  ('e3000000-0000-4000-8000-000000000001', 'charge', 'pi_earn_1', 'pi_earn_1', 340, 220, 'succeeded'),
  ('e3000000-0000-4000-8000-000000000002', 'charge', 'pi_earn_2', 'pi_earn_2', 340, 220, 'succeeded'),
  ('e3000000-0000-4000-8000-000000000002', 'refund', 're_earn_2', 'pi_earn_2', 170, 0, 'succeeded'),
  ('e3000000-0000-4000-8000-000000000002', 'refund', 're_earn_2f', 'pi_earn_2', 170, 0, 'failed'),
  ('e3000000-0000-4000-8000-000000000004', 'charge', 'pi_earn_4', 'pi_earn_4', 340, 220, 'succeeded'),
  ('e3000000-0000-4000-8000-000000000005', 'charge', 'pi_earn_5', 'pi_earn_5', 340, 220, 'succeeded'),
  ('e3000000-0000-4000-8000-000000000005', 'refund', 're_earn_5', 'pi_earn_5', 340, 0, 'succeeded');

create temp table a_totals as
select t.* from public.barbers b,
  lateral public.barber_earnings_totals(b.id, '2030-03-01', '2030-04-01') t
where b.user_id = 'e1000000-0000-4000-8000-000000000001';

select is((select fee_share_earned_cents from a_totals), 240::bigint, 'fee share: two paid bookings x 120');
select is((select fee_share_reversed_cents from a_totals), 60::bigint, 'a half refund reverses half the share; failed refunds ignored');
select is((select refunded_to_clients_cents from a_totals), 170::bigint, 'refunded to clients excludes failed refunds');
select is((select (completed_bookings, cancelled_bookings, booking_count) from a_totals), (2::bigint, 1::bigint, 3::bigint),
  'counts only barber A''s bookings inside the range');
select is((select service_revenue_cents from a_totals), 6500::bigint, 'service revenue: completed bookings incl. add-ons');

select is(
  (select array_agg(l.customer_name || ':' || l.fee_share_cents order by l.starts_at desc)
     from public.barbers b, lateral public.barber_earnings_bookings(b.id, '2030-03-01', '2030-04-01') l
    where b.user_id = 'e1000000-0000-4000-8000-000000000001'),
  array['Walk In:0', 'Pat Client:60', 'Pat Client:120'], 'per-booking net fee share, newest first');

select is(
  (select count(*)::int
     from public.barbers b, lateral public.barber_earnings_bookings(b.id, '2030-03-01', '2030-04-01', 1, 1) l
    where b.user_id = 'e1000000-0000-4000-8000-000000000001'),
  1, 'limit and offset page the list');

select is(
  (select (t.fee_share_earned_cents, t.fee_share_reversed_cents, t.booking_count)
     from public.barbers b, lateral public.barber_earnings_totals(b.id, '2030-03-01', '2030-04-01') t
    where b.user_id = 'e1000000-0000-4000-8000-000000000002'),
  (120::bigint, 120::bigint, 1::bigint), 'barber B sees only its own payments');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select * from public.barber_earnings_totals(gen_random_uuid(), now(), now())$$, '42501', null,
  'authenticated users cannot call the earnings functions');
reset role;

select * from finish();
rollback;
