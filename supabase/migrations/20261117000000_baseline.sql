-- =============================================================================
-- Talii baseline schema
--
-- Replaces every earlier migration. Applies cleanly to an empty database.
--
-- Security model
--   * Row-level security is enabled on every table in schema public.
--   * anon and authenticated receive no default privileges. Each safe read is
--     granted explicitly below; neither role is granted INSERT, UPDATE or
--     DELETE on any table. All writes go through the Next.js API using the
--     service role.
--   * Admin status is auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
--     (server-controlled), never a client-writable column.
--   * Every SECURITY DEFINER function sets search_path = '' and
--     schema-qualifies every object it touches.
--
-- Money is integer cents. Timestamps are timestamptz.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------

create extension if not exists btree_gist with schema extensions;


-- -----------------------------------------------------------------------------
-- Default privileges
--
-- Supabase grants ALL on new tables, sequences and functions in schema public
-- to anon and authenticated by default. Remove that so every grant below is
-- deliberate. service_role keeps its defaults.
-- -----------------------------------------------------------------------------

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Shared trigger function: updated_at
-- -----------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- profiles: one row per auth user, created by handle_new_user().
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  role            text not null default 'client' check (role in ('client', 'barber')),
  name            text,
  username        text not null constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  email           text,
  phone           text,
  avatar_url      text,
  cover_photo_url text,
  is_disabled     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index profiles_username_lower_key on public.profiles (lower(username));

-- barbers: public business profile. No Stripe or fee data here (see barber_billing).
create table public.barbers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references public.profiles (id) on delete cascade,
  business_name       text,
  bio                 text,
  specialties         text[] not null default '{}',
  instagram           text,
  tiktok              text,
  city                text,
  state               text,
  latitude            double precision check (latitude between -90 and 90),
  longitude           double precision check (longitude between -180 and 180),
  timezone            text not null default 'America/New_York',
  portfolio           text[] not null default '{}',
  is_public           boolean not null default true,
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint barbers_location_pair check ((latitude is null) = (longitude is null))
);

-- barber_billing: Stripe Connect state and fee exemption. Server only.
create table public.barber_billing (
  barber_id         uuid primary key references public.barbers (id) on delete cascade,
  stripe_account_id text unique,
  charges_enabled   boolean not null default false,
  payouts_enabled   boolean not null default false,
  details_submitted boolean not null default false,
  fee_exempt        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  barber_id        uuid not null references public.barbers (id) on delete cascade,
  name             text not null,
  description      text,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cents      integer not null check (price_cents >= 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index services_barber_id_idx on public.services (barber_id);

create table public.service_addons (
  id          uuid primary key default gen_random_uuid(),
  barber_id   uuid not null references public.barbers (id) on delete cascade,
  name        text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index service_addons_barber_id_idx on public.service_addons (barber_id);

-- availability: weekly hours, local wall-clock time in barbers.timezone.
create table public.availability (
  id          uuid primary key default gen_random_uuid(),
  barber_id   uuid not null references public.barbers (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint availability_time_order check (start_time < end_time),
  constraint availability_barber_day_start_key unique (barber_id, day_of_week, start_time)
);

-- special_hours: per-date override (closed, or different hours). Replaces time_off.
create table public.special_hours (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid not null references public.barbers (id) on delete cascade,
  date       date not null,
  is_closed  boolean not null default false,
  start_time time,
  end_time   time,
  reason     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_hours_barber_date_key unique (barber_id, date),
  constraint special_hours_consistency check (
    (is_closed and start_time is null and end_time is null)
    or (not is_closed and start_time is not null and end_time is not null and start_time < end_time)
  )
);

create table public.bookings (
  id                     uuid primary key default gen_random_uuid(),
  barber_id              uuid not null references public.barbers (id) on delete restrict,
  client_id              uuid references public.profiles (id) on delete set null,
  customer_name          text,
  service_id             uuid not null references public.services (id) on delete restrict,
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  source                 text not null default 'app' check (source in ('app', 'manual')),
  status                 text not null default 'pending'
                           check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  payment_status         text not null default 'none'
                           check (payment_status in ('none', 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  hold_expires_at        timestamptz,
  service_price_cents    integer not null default 0 check (service_price_cents >= 0),
  addon_total_cents      integer not null default 0 check (addon_total_cents >= 0),
  booking_fee_cents      integer not null default 0 check (booking_fee_cents >= 0),
  application_fee_cents  integer not null default 0 check (application_fee_cents >= 0),
  barber_fee_share_cents integer not null default 0 check (barber_fee_share_cents >= 0),
  payment_intent_id      text,
  notes                  text,
  cancelled_at           timestamptz,
  cancellation_reason    text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint bookings_time_order check (ends_at > starts_at),
  constraint bookings_hold_only_when_pending check (hold_expires_at is null or status = 'pending'),
  constraint bookings_manual_has_customer check (source = 'app' or customer_name is not null),
  constraint bookings_id_barber_key unique (id, barber_id),
  constraint bookings_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create unique index bookings_payment_intent_id_key on public.bookings (payment_intent_id)
  where payment_intent_id is not null;
create index bookings_barber_starts_at_idx on public.bookings (barber_id, starts_at);
create index bookings_client_id_idx on public.bookings (client_id);
create index bookings_service_id_idx on public.bookings (service_id);
create index bookings_pending_hold_idx on public.bookings (barber_id, hold_expires_at)
  where status = 'pending';

-- booking_addons: snapshot of add-ons chosen for a booking.
create table public.booking_addons (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  addon_id    uuid not null references public.service_addons (id) on delete restrict,
  name        text not null,
  price_cents integer not null check (price_cents >= 0),
  created_at  timestamptz not null default now(),
  constraint booking_addons_booking_addon_key unique (booking_id, addon_id)
);

create index booking_addons_addon_id_idx on public.booking_addons (addon_id);

-- payments: one row per Stripe charge (pi_...) or refund (re_...).
create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references public.bookings (id) on delete restrict,
  type                  text not null check (type in ('charge', 'refund')),
  stripe_object_id      text not null unique,
  payment_intent_id     text,
  amount_cents          integer not null check (amount_cents >= 0),
  application_fee_cents integer not null default 0 check (application_fee_cents >= 0),
  currency              text not null default 'usd',
  status                text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index payments_booking_id_idx on public.payments (booking_id);
create index payments_payment_intent_id_idx on public.payments (payment_intent_id);

-- stripe_events: webhook de-duplication and durable record of unapplied events.
create table public.stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  payload      jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index stripe_events_unprocessed_idx on public.stripe_events (received_at)
  where processed_at is null;

-- reviews: one per booking; the API checks the booking is completed and belongs to the reviewer.
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique,
  barber_id  uuid not null references public.barbers (id) on delete cascade,
  client_id  uuid references public.profiles (id) on delete set null,
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_booking_barber_fkey foreign key (booking_id, barber_id)
    references public.bookings (id, barber_id) on delete cascade
);

create index reviews_barber_id_idx on public.reviews (barber_id);
create index reviews_client_id_idx on public.reviews (client_id);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete set null,
  content_type     text not null check (content_type in ('user', 'profile', 'review', 'image')),
  content_id       text not null,
  reason           text not null check (reason in (
                     'spam', 'harassment', 'hate_speech', 'inappropriate_content', 'fraud',
                     'fake_profile', 'violence', 'sexual_content', 'other')),
  details          text,
  status           text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_reported_user_id_idx on public.reports (reported_user_id);
create index reports_status_idx on public.reports (status);

create table public.blocked_users (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocked_users_pair_key unique (blocker_id, blocked_id),
  constraint blocked_users_no_self_block check (blocker_id <> blocked_id)
);

create index blocked_users_blocked_id_idx on public.blocked_users (blocked_id);

create table public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (length(email) <= 254),
  created_at timestamptz not null default now()
);

create unique index waitlist_email_lower_key on public.waitlist (lower(email));


-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

create trigger set_updated_at before update on public.profiles       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.barbers        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.barber_billing for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.services       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.service_addons for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.availability   for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.special_hours  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.bookings       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.payments       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.stripe_events  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reviews        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reports        for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- Every barber gets a billing row
-- -----------------------------------------------------------------------------

create function public.create_barber_billing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.barber_billing (barber_id) values (new.id)
  on conflict (barber_id) do nothing;
  return new;
end;
$$;

create trigger create_barber_billing after insert on public.barbers
  for each row execute function public.create_barber_billing();


-- -----------------------------------------------------------------------------
-- Helper functions used by policies
-- -----------------------------------------------------------------------------

-- True when the caller's JWT carries app_metadata.role = 'admin'.
create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- True when the caller owns the barber. SECURITY DEFINER so policies on other
-- tables do not depend on the caller's visibility of barbers.
create function public.owns_barber(p_barber_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.barbers b
    where b.id = p_barber_id and b.user_id = auth.uid()
  );
$$;

-- True when the caller has a profile that is not disabled. Used by storage
-- write policies. SECURITY DEFINER so it does not depend on profiles' RLS.
create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and not p.is_disabled
  );
$$;

-- True when the barber is publicly listed: is_public and its profile is not disabled.
create function public.barber_is_listed(p_barber_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.barbers b
    join public.profiles p on p.id = b.user_id
    where b.id = p_barber_id and b.is_public and not p.is_disabled
  );
$$;


-- -----------------------------------------------------------------------------
-- Row-level security and policies
--
-- Only SELECT policies exist for anon/authenticated. There are deliberately no
-- INSERT/UPDATE/DELETE policies: the service role bypasses RLS for writes.
-- barber_billing, stripe_events and waitlist have RLS enabled and no policies.
-- -----------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.barbers        enable row level security;
alter table public.barber_billing enable row level security;
alter table public.services       enable row level security;
alter table public.service_addons enable row level security;
alter table public.availability   enable row level security;
alter table public.special_hours  enable row level security;
alter table public.bookings       enable row level security;
alter table public.booking_addons enable row level security;
alter table public.payments       enable row level security;
alter table public.stripe_events  enable row level security;
alter table public.reviews        enable row level security;
alter table public.reports        enable row level security;
alter table public.blocked_users  enable row level security;
alter table public.waitlist       enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "barbers: read listed or own" on public.barbers
  for select to anon, authenticated
  using (
    public.barber_is_listed(id)
    or user_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "services: read active of listed barber, or own" on public.services
  for select to anon, authenticated
  using (
    (is_active and public.barber_is_listed(barber_id))
    or public.owns_barber(barber_id)
    or (select public.is_admin())
  );

create policy "service_addons: read active of listed barber, or own" on public.service_addons
  for select to anon, authenticated
  using (
    (is_active and public.barber_is_listed(barber_id))
    or public.owns_barber(barber_id)
    or (select public.is_admin())
  );

create policy "availability: read of listed barber, or own" on public.availability
  for select to anon, authenticated
  using (
    public.barber_is_listed(barber_id)
    or public.owns_barber(barber_id)
    or (select public.is_admin())
  );

-- The reason column is not granted to anon/authenticated (see Grants); owners read it through the API.
create policy "special_hours: read of listed barber, or own" on public.special_hours
  for select to anon, authenticated
  using (
    public.barber_is_listed(barber_id)
    or public.owns_barber(barber_id)
    or (select public.is_admin())
  );

create policy "bookings: read as client or owning barber" on public.bookings
  for select to authenticated
  using (
    client_id = (select auth.uid())
    or public.owns_barber(barber_id)
    or (select public.is_admin())
  );

-- Visible exactly when the parent booking is visible to the caller.
create policy "booking_addons: read with booking" on public.booking_addons
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id));

create policy "payments: read with booking" on public.payments
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id));

create policy "reviews: public read of visible reviews" on public.reviews
  for select to anon, authenticated
  using (not is_hidden or (select public.is_admin()));

create policy "reports: reporter reads own" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "blocked_users: blocker reads own" on public.blocked_users
  for select to authenticated
  using (blocker_id = (select auth.uid()) or (select public.is_admin()));


-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------

-- Public profile fields of listed barbers only (is_public barber row, profile
-- not disabled). Clients are never listed. Runs with the owner's rights on
-- purpose so it bypasses the own-row-only policy on profiles while exposing no
-- email, phone or flags.
create view public.public_profiles
with (security_invoker = false)
as
  select p.id, p.name, p.username, p.avatar_url, p.cover_photo_url, p.role
  from public.profiles p
  where not p.is_disabled
    and exists (select 1 from public.barbers b where b.user_id = p.id and b.is_public);

-- Visible reviews with a minimal reviewer identity: first name (or username)
-- and avatar, never the client id. Owner rights so it can read profiles; it
-- filters hidden reviews itself. Reviewers whose account is disabled show no
-- name or avatar.
create view public.public_reviews
with (security_invoker = false)
as
  select
    r.id,
    r.barber_id,
    r.rating,
    r.comment,
    r.created_at,
    case when p.is_disabled then null
         else coalesce(nullif(split_part(trim(p.name), ' ', 1), ''), p.username) end as reviewer_name,
    case when p.is_disabled then null else p.avatar_url end as reviewer_avatar_url
  from public.reviews r
  left join public.profiles p on p.id = r.client_id
  where not r.is_hidden;

-- Rating aggregates over non-hidden reviews. Invoker rights; the reviews
-- policy already exposes exactly the non-hidden rows.
create view public.barber_rating_stats
with (security_invoker = true)
as
  select
    barber_id,
    count(*)::integer                     as review_count,
    round(avg(rating)::numeric, 2)        as average_rating
  from public.reviews
  where not is_hidden
  group by barber_id;


-- -----------------------------------------------------------------------------
-- Functions callable by clients
-- -----------------------------------------------------------------------------

-- Listed barbers within p_radius_miles of a point, nearest first. Invoker
-- rights: the barbers policy and public_profiles already limit what is seen.
create function public.nearby_barbers(
  p_latitude     double precision,
  p_longitude    double precision,
  p_radius_miles double precision default 25,
  p_limit        integer default 50
)
returns table (
  id             uuid,
  user_id        uuid,
  business_name  text,
  bio            text,
  specialties    text[],
  city           text,
  state          text,
  latitude       double precision,
  longitude      double precision,
  name           text,
  username       text,
  avatar_url     text,
  distance_miles double precision
)
language sql
stable
set search_path = ''
as $$
  select *
  from (
    select
      b.id, b.user_id, b.business_name, b.bio, b.specialties, b.city, b.state,
      b.latitude, b.longitude, pp.name, pp.username, pp.avatar_url,
      3958.8 * 2 * asin(least(1, sqrt(
        power(sin(radians(b.latitude - p_latitude) / 2), 2)
        + cos(radians(p_latitude)) * cos(radians(b.latitude))
          * power(sin(radians(b.longitude - p_longitude) / 2), 2)
      ))) as distance_miles
    from public.barbers b
    join public.public_profiles pp on pp.id = b.user_id
    where b.is_public
      and b.latitude is not null
      and b.longitude is not null
  ) d
  where d.distance_miles <= p_radius_miles
  order by d.distance_miles
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;


-- -----------------------------------------------------------------------------
-- Functions for the service role only
-- -----------------------------------------------------------------------------

-- Places a pending booking that holds a slot while the fee is paid.
--
-- In one transaction: releases this barber's expired holds, snapshots the
-- service and add-on prices, and inserts the booking and its add-ons.
--
-- Errors the API should map:
--   23P01 exclusion_violation (constraint bookings_no_overlap): slot taken.
--   22023 invalid_parameter_value: unknown/inactive service or add-on, or a
--         hold expiry that is not in the future.
create function public.create_booking_hold(
  p_barber_id              uuid,
  p_client_id              uuid,
  p_service_id             uuid,
  p_starts_at              timestamptz,
  p_hold_expires_at        timestamptz,
  p_booking_fee_cents      integer,
  p_application_fee_cents  integer,
  p_barber_fee_share_cents integer,
  p_addon_ids              uuid[] default '{}',
  p_notes                  text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service     public.services;
  v_addon_ids   uuid[] := coalesce(p_addon_ids, '{}');
  v_addon_count integer;
  v_addon_total integer;
  v_booking     public.bookings;
begin
  if p_hold_expires_at is null or p_hold_expires_at <= now() then
    raise exception 'hold_expires_at must be in the future' using errcode = '22023';
  end if;

  select s.* into v_service
  from public.services s
  where s.id = p_service_id and s.barber_id = p_barber_id and s.is_active;
  if not found then
    raise exception 'service % is not an active service of barber %', p_service_id, p_barber_id
      using errcode = '22023';
  end if;

  select count(*), coalesce(sum(a.price_cents), 0)
    into v_addon_count, v_addon_total
  from public.service_addons a
  where a.id = any (v_addon_ids) and a.barber_id = p_barber_id and a.is_active;
  if v_addon_count <> cardinality(array(select distinct unnest(v_addon_ids))) then
    raise exception 'one or more add-ons are not active add-ons of barber %', p_barber_id
      using errcode = '22023';
  end if;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = 'hold_expired',
         hold_expires_at = null
   where barber_id = p_barber_id
     and status = 'pending'
     and hold_expires_at < now();

  insert into public.bookings (
    barber_id, client_id, service_id, starts_at, ends_at, source, status, payment_status,
    hold_expires_at, service_price_cents, addon_total_cents, booking_fee_cents,
    application_fee_cents, barber_fee_share_cents, notes
  ) values (
    p_barber_id, p_client_id, p_service_id, p_starts_at,
    p_starts_at + make_interval(mins => v_service.duration_minutes),
    'app', 'pending', case when p_booking_fee_cents > 0 then 'pending' else 'none' end,
    p_hold_expires_at, v_service.price_cents, v_addon_total, p_booking_fee_cents,
    p_application_fee_cents, p_barber_fee_share_cents, p_notes
  )
  returning * into v_booking;

  insert into public.booking_addons (booking_id, addon_id, name, price_cents)
  select v_booking.id, a.id, a.name, a.price_cents
  from public.service_addons a
  where a.id = any (v_addon_ids);

  return v_booking;
end;
$$;


-- Earnings for one barber's appointments starting in [p_from, p_to). Integer
-- cents, computed in SQL so totals are never cut off by the Data API row limit.
-- The barber's fee share of a charge is amount - application fee; a refund
-- reverses that share proportionally (reverse_transfer). Refunds count while
-- succeeded or pending.
create function public.barber_earnings_totals(
  p_barber_id uuid,
  p_from      timestamptz,
  p_to        timestamptz
)
returns table (
  fee_share_earned_cents    bigint,
  fee_share_reversed_cents  bigint,
  refunded_to_clients_cents bigint,
  completed_bookings        bigint,
  no_show_bookings          bigint,
  cancelled_bookings        bigint,
  upcoming_bookings         bigint,
  service_revenue_cents     bigint,
  booking_count             bigint
)
language sql
stable
set search_path = ''
as $$
  with b as (
    select bk.id, bk.status, bk.service_price_cents, bk.addon_total_cents
    from public.bookings bk
    where bk.barber_id = p_barber_id and bk.starts_at >= p_from and bk.starts_at < p_to
  ),
  pay as (
    select p.type, p.status, p.amount_cents, p.application_fee_cents,
           c.amount_cents as charge_amount, c.application_fee_cents as charge_fee
    from public.payments p
    join b on b.id = p.booking_id
    left join public.payments c
      on c.booking_id = p.booking_id and c.type = 'charge' and c.status = 'succeeded'
     and c.payment_intent_id = p.payment_intent_id
  )
  select
    coalesce((select sum(amount_cents - application_fee_cents) from pay
               where type = 'charge' and status = 'succeeded'), 0)::bigint,
    coalesce((select sum(coalesce(round(amount_cents::numeric * (charge_amount - charge_fee)
                                         / nullif(charge_amount, 0)), 0))
                from pay where type = 'refund' and status in ('succeeded', 'pending')), 0)::bigint,
    coalesce((select sum(amount_cents) from pay
               where type = 'refund' and status in ('succeeded', 'pending')), 0)::bigint,
    (select count(*) from b where status = 'completed'),
    (select count(*) from b where status = 'no_show'),
    (select count(*) from b where status = 'cancelled'),
    (select count(*) from b where status = 'confirmed'),
    coalesce((select sum(service_price_cents + addon_total_cents) from b where status = 'completed'), 0)::bigint,
    (select count(*) from b);
$$;

-- One page of the same appointments, newest first, with each booking's net fee share.
create function public.barber_earnings_bookings(
  p_barber_id uuid,
  p_from      timestamptz,
  p_to        timestamptz,
  p_limit     integer default 100,
  p_offset    integer default 0
)
returns table (
  id                  uuid,
  starts_at           timestamptz,
  status              text,
  source              text,
  payment_status      text,
  customer_name       text,
  service_name        text,
  service_price_cents integer,
  addon_total_cents   integer,
  fee_share_cents     bigint
)
language sql
stable
set search_path = ''
as $$
  select
    bk.id, bk.starts_at, bk.status, bk.source, bk.payment_status,
    coalesce(bk.customer_name, pr.name), s.name, bk.service_price_cents, bk.addon_total_cents,
    coalesce((
      select sum(case
                   when p.type = 'charge' and p.status = 'succeeded'
                     then p.amount_cents - p.application_fee_cents
                   when p.type = 'refund' and p.status in ('succeeded', 'pending')
                     then -coalesce(round(p.amount_cents::numeric * (c.amount_cents - c.application_fee_cents)
                                          / nullif(c.amount_cents, 0)), 0)
                   else 0
                 end)
      from public.payments p
      left join public.payments c
        on c.booking_id = p.booking_id and c.type = 'charge' and c.status = 'succeeded'
       and c.payment_intent_id = p.payment_intent_id
      where p.booking_id = bk.id
    ), 0)::bigint
  from public.bookings bk
  left join public.services s on s.id = bk.service_id
  left join public.profiles pr on pr.id = bk.client_id
  where bk.barber_id = p_barber_id and bk.starts_at >= p_from and bk.starts_at < p_to
  order by bk.starts_at desc, bk.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$$;


-- -----------------------------------------------------------------------------
-- Auth hooks: profile creation and email sync
-- -----------------------------------------------------------------------------

-- Creates the profile (and, for barbers, the barbers row; its billing row
-- follows from create_barber_billing). Role is 'barber' only when the signup
-- metadata says exactly 'barber'; anything else, including 'admin', becomes
-- 'client'.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role     text := case when v_meta ->> 'role' = 'barber' then 'barber' else 'client' end;
  v_name     text := nullif(trim(coalesce(v_meta ->> 'name', v_meta ->> 'full_name', '')), '');
  v_avatar   text := v_meta ->> 'avatar_url';
  v_base     text;
  v_username text;
  v_attempt  integer := 0;
begin
  if v_avatar is not null and v_avatar !~ '^https://' then
    v_avatar := null;
  end if;

  v_base := left(regexp_replace(
    coalesce(v_meta ->> 'username', split_part(coalesce(new.email, ''), '@', 1), ''),
    '[^A-Za-z0-9_]', '', 'g'), 20);
  if length(v_base) < 3 then
    v_base := 'user';
  end if;
  v_username := v_base;

  loop
    begin
      insert into public.profiles (id, role, name, username, email, phone, avatar_url)
      values (
        new.id, v_role, v_name, v_username, new.email,
        coalesce(nullif(new.phone, ''), nullif(v_meta ->> 'phone', '')),
        v_avatar
      );
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        v_username := 'user_' || left(replace(new.id::text, '-', ''), 25);
      else
        v_username := v_base || '_' || left(md5(random()::text), 6);
      end if;
      if v_attempt > 6 then
        raise;
      end if;
    end;
  end loop;

  if v_role = 'barber' then
    insert into public.barbers (user_id, business_name)
    values (new.id, nullif(trim(coalesce(v_meta ->> 'business_name', '')), ''));
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keeps profiles.email in step with the confirmed auth email.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();


-- -----------------------------------------------------------------------------
-- Grants
--
-- service_role keeps Supabase's default full access. anon and authenticated
-- get SELECT only, and only where listed.
-- -----------------------------------------------------------------------------

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select on public.barbers, public.services, public.service_addons, public.availability
  to anon, authenticated;
-- Column grants: special_hours.reason and reviews.client_id / booking_id stay private.
grant select (id, barber_id, date, is_closed, start_time, end_time, created_at, updated_at)
  on public.special_hours to anon, authenticated;
grant select (id, barber_id, rating, comment, is_hidden, created_at, updated_at)
  on public.reviews to anon, authenticated;
grant select on public.profiles, public.bookings, public.booking_addons,
                public.payments, public.reports, public.blocked_users
  to authenticated;
grant select on public.public_profiles, public.public_reviews, public.barber_rating_stats to anon, authenticated;

-- Policy helpers and the public search function.
grant execute on function public.is_admin()                 to anon, authenticated;
grant execute on function public.owns_barber(uuid)          to anon, authenticated;
grant execute on function public.barber_is_listed(uuid)     to anon, authenticated;
grant execute on function public.is_active_user()           to authenticated;
grant execute on function public.nearby_barbers(double precision, double precision, double precision, integer)
  to anon, authenticated;


-- -----------------------------------------------------------------------------
-- Storage
--
-- Two public-read buckets. Authenticated users whose account is not disabled
-- may write only under a first path segment equal to their own user id:
-- <user_id>/<file>.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('media', 'media', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']);

create policy "avatars/media: owner reads own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('avatars', 'media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars/media: owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  );

create policy "avatars/media: owner updates own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  )
  with check (
    bucket_id in ('avatars', 'media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  );

create policy "avatars/media: owner deletes own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'media')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  );
