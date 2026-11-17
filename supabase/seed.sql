-- =============================================================================
-- Local development seed. Loaded by `supabase db reset` on the LOCAL stack.
--
-- Every account uses the same local-only password: local-dev-password
-- Emails are fake (example.com). Never run this against a hosted project.
--
--   admin@example.com     client profile, app_metadata.role = admin
--   barber.one@example.com    barber "Fade Factory" (pays the $3.40 fee)
--   barber.two@example.com    barber "Sharp Lines" (fee_exempt)
--   client.one@example.com    client
--   client.two@example.com    client
-- =============================================================================

-- Auth users. handle_new_user() creates profiles, barbers and barber_billing.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('local-dev-password', extensions.gen_salt('bf')), now(),
  u.app_meta, u.user_meta, now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@example.com',
    '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
    '{"name":"Local Admin","username":"admin"}'::jsonb),
  ('00000000-0000-4000-8000-000000000011'::uuid, 'barber.one@example.com',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Marcus Reed","username":"fadefactory","role":"barber","business_name":"Fade Factory"}'::jsonb),
  ('00000000-0000-4000-8000-000000000012'::uuid, 'barber.two@example.com',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Dana Cole","username":"sharplines","role":"barber","business_name":"Sharp Lines"}'::jsonb),
  ('00000000-0000-4000-8000-000000000021'::uuid, 'client.one@example.com',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Alex Kim","username":"alexk"}'::jsonb),
  ('00000000-0000-4000-8000-000000000022'::uuid, 'client.two@example.com',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Jordan Lee","username":"jordanl"}'::jsonb)
) as u (id, email, app_meta, user_meta);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@example.com';

do $$
declare
  v_b1     uuid;
  v_b2     uuid;
  v_c1     uuid := '00000000-0000-4000-8000-000000000021';
  v_c2     uuid := '00000000-0000-4000-8000-000000000022';
  v_cut1   uuid;
  v_beard1 uuid;
  v_cut2   uuid;
  v_towel1 uuid;
  v_day    timestamptz := date_trunc('day', now());
  v_bk     uuid;
begin
  select id into v_b1 from public.barbers where user_id = '00000000-0000-4000-8000-000000000011';
  select id into v_b2 from public.barbers where user_id = '00000000-0000-4000-8000-000000000012';

  update public.barbers
     set bio = 'Skin fades and classic cuts.', specialties = '{fades,classic}',
         city = 'Brooklyn', state = 'NY', latitude = 40.6782, longitude = -73.9442,
         timezone = 'America/New_York', onboarding_complete = true
   where id = v_b1;
  update public.barbers
     set bio = 'Line-ups and beard work.', specialties = '{lineups,beards}',
         city = 'Chicago', state = 'IL', latitude = 41.8781, longitude = -87.6298,
         timezone = 'America/Chicago', onboarding_complete = true
   where id = v_b2;

  update public.barber_billing
     set stripe_account_id = 'acct_localtest0001', charges_enabled = true,
         payouts_enabled = true, details_submitted = true
   where barber_id = v_b1;
  update public.barber_billing
     set stripe_account_id = 'acct_localtest0002', charges_enabled = true,
         payouts_enabled = true, details_submitted = true, fee_exempt = true
   where barber_id = v_b2;

  insert into public.services (barber_id, name, description, duration_minutes, price_cents)
  values (v_b1, 'Skin Fade', 'Fade with a foil finish.', 45, 4000) returning id into v_cut1;
  insert into public.services (barber_id, name, duration_minutes, price_cents)
  values (v_b1, 'Kids Cut', 30, 2500);
  insert into public.services (barber_id, name, duration_minutes, price_cents)
  values (v_b2, 'Cut and Line-up', 60, 5000) returning id into v_cut2;
  insert into public.services (barber_id, name, duration_minutes, price_cents, is_active)
  values (v_b2, 'Retired Special', 30, 2000, false);

  insert into public.service_addons (barber_id, name, price_cents)
  values (v_b1, 'Beard Trim', 1000) returning id into v_beard1;
  insert into public.service_addons (barber_id, name, price_cents)
  values (v_b1, 'Hot Towel', 500) returning id into v_towel1;
  insert into public.service_addons (barber_id, name, price_cents)
  values (v_b2, 'Eyebrows', 500);

  insert into public.availability (barber_id, day_of_week, start_time, end_time)
  select v_b1, d, time '09:00', time '17:00' from generate_series(1, 6) d
  union all
  select v_b2, d, time '10:00', time '18:00' from generate_series(2, 6) d;

  insert into public.special_hours (barber_id, date, is_closed, reason)
  values (v_b1, (v_day + interval '14 days')::date, true, 'Vacation');
  insert into public.special_hours (barber_id, date, start_time, end_time, reason)
  values (v_b2, (v_day + interval '10 days')::date, '12:00', '16:00', 'Short day');

  -- Barber one, confirmed and paid, tomorrow.
  insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status, payment_status,
    service_price_cents, addon_total_cents, booking_fee_cents, application_fee_cents, barber_fee_share_cents, payment_intent_id)
  values (v_b1, v_c1, v_cut1, v_day + interval '1 day 15 hours', v_day + interval '1 day 15 hours 45 minutes',
    'confirmed', 'succeeded', 4000, 1000, 340, 220, 120, 'pi_localseed0001')
  returning id into v_bk;
  insert into public.booking_addons (booking_id, addon_id, name, price_cents) values (v_bk, v_beard1, 'Beard Trim', 1000);
  insert into public.payments (booking_id, type, stripe_object_id, payment_intent_id, amount_cents, application_fee_cents, status)
  values (v_bk, 'charge', 'pi_localseed0001', 'pi_localseed0001', 340, 220, 'succeeded');

  -- Barber one, completed last week, reviewed.
  insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status, payment_status,
    service_price_cents, booking_fee_cents, application_fee_cents, barber_fee_share_cents, payment_intent_id)
  values (v_b1, v_c2, v_cut1, v_day - interval '7 days' + interval '16 hours', v_day - interval '7 days' + interval '16 hours 45 minutes',
    'completed', 'succeeded', 4000, 340, 220, 120, 'pi_localseed0002')
  returning id into v_bk;
  insert into public.payments (booking_id, type, stripe_object_id, payment_intent_id, amount_cents, application_fee_cents, status)
  values (v_bk, 'charge', 'pi_localseed0002', 'pi_localseed0002', 340, 220, 'succeeded');
  insert into public.reviews (booking_id, barber_id, client_id, rating, comment)
  values (v_bk, v_b1, v_c2, 5, 'Best fade in Brooklyn.');

  -- Barber one, cancelled and refunded.
  insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status, payment_status,
    service_price_cents, booking_fee_cents, application_fee_cents, barber_fee_share_cents, payment_intent_id,
    cancelled_at, cancellation_reason)
  values (v_b1, v_c1, v_cut1, v_day + interval '1 day 15 hours', v_day + interval '1 day 15 hours 45 minutes',
    'cancelled', 'refunded', 4000, 340, 220, 120, 'pi_localseed0003', now() - interval '1 day', 'client_cancelled')
  returning id into v_bk;
  insert into public.payments (booking_id, type, stripe_object_id, payment_intent_id, amount_cents, application_fee_cents, status)
  values (v_bk, 'charge', 'pi_localseed0003', 'pi_localseed0003', 340, 220, 'succeeded'),
         (v_bk, 'refund', 're_localseed0003', 'pi_localseed0003', 340, 0, 'succeeded');

  -- Barber one, pending hold awaiting payment.
  insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status, payment_status,
    hold_expires_at, service_price_cents, addon_total_cents, booking_fee_cents, application_fee_cents,
    barber_fee_share_cents, payment_intent_id)
  values (v_b1, v_c2, v_cut1, v_day + interval '2 days 14 hours', v_day + interval '2 days 14 hours 45 minutes',
    'pending', 'pending', now() + interval '10 minutes', 4000, 500, 340, 220, 120, 'pi_localseed0004')
  returning id into v_bk;
  insert into public.booking_addons (booking_id, addon_id, name, price_cents) values (v_bk, v_towel1, 'Hot Towel', 500);

  -- Barber two (fee exempt), confirmed with no online payment.
  insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status, payment_status, service_price_cents)
  values (v_b2, v_c1, v_cut2, v_day + interval '1 day 16 hours', v_day + interval '1 day 17 hours',
    'confirmed', 'none', 5000);

  -- Barber two, manual walk-in entry.
  insert into public.bookings (barber_id, client_id, customer_name, service_id, starts_at, ends_at, source, status, service_price_cents)
  values (v_b2, null, 'Sam (walk-in)', v_cut2, v_day + interval '1 day 17 hours', v_day + interval '1 day 18 hours',
    'manual', 'confirmed', 5000);

  -- Barber two, no-show last week.
  insert into public.bookings (barber_id, client_id, service_id, starts_at, ends_at, status, payment_status, service_price_cents)
  values (v_b2, v_c2, v_cut2, v_day - interval '6 days' + interval '16 hours', v_day - interval '6 days' + interval '17 hours',
    'no_show', 'none', 5000);

  insert into public.blocked_users (blocker_id, blocked_id) values (v_c1, v_c2);
  insert into public.reports (reporter_id, reported_user_id, content_type, content_id, reason, details)
  values (v_c1, v_c2, 'user', v_c2::text, 'spam', 'Seed report for local admin testing.');
  insert into public.waitlist (email) values ('waitlist@example.com');
end;
$$;
