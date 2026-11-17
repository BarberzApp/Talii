# Database schema

Source of truth: `supabase/migrations/20261117000000_baseline.sql` (one baseline; all earlier migrations were retired on 2026-11-17).
Types for TypeScript: `packages/shared/src/types/database.generated.ts` (generated, do not edit by hand).

## Security model

- Row-level security is on for every table in `public`.
- `anon` and `authenticated` have no default privileges. They get `SELECT` only on the tables and views listed below, and no `INSERT`, `UPDATE` or `DELETE` anywhere in `public`.
- All writes go through the Next.js API (`apps/web/src/app/api`) with the service role, which bypasses RLS. The API validates input and ownership.
- Admin means `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'` (helper `public.is_admin()`). `app_metadata` is server-controlled; `user_metadata` and every table column are ignored for this.
- Every `SECURITY DEFINER` function sets `search_path = ''` and schema-qualifies all names.
- Money is integer cents. Timestamps are `timestamptz`. `updated_at` is maintained by the shared trigger `public.set_updated_at()`.

## Tables

"Read" lists who can `SELECT` through the Data API; admins (see above) can additionally read every row of tables marked with \*. "Write" is always the API (service role) only.

| Table | Purpose | Key columns | Read |
|---|---|---|---|
| `profiles`\* | One row per auth user, created by `handle_new_user()` | `id` = `auth.users.id`; `role` `client`/`barber`; `username` (3-30 of `A-Za-z0-9_`, unique ignoring case); `email`, `phone`, `avatar_url`, `cover_photo_url`, `is_disabled` | The user's own row only. Listed barbers' public fields are in the `public_profiles` view; client profiles are never public. |
| `barbers`\* | Public business profile | `user_id` (unique, -> profiles); `business_name`, `bio`, `specialties[]`, `instagram`, `tiktok`, `city`, `state`, `latitude`, `longitude`, `timezone` (IANA, default `America/New_York`), `portfolio[]` (image URLs), `is_public`, `onboarding_complete` | Anyone, when `is_public` and the profile is not disabled; the owner always. |
| `barber_billing` | Stripe Connect state and fee exemption, created automatically for every barber | `barber_id` (PK); `stripe_account_id` (unique); `charges_enabled`, `payouts_enabled`, `details_submitted`; `fee_exempt` (skip the $3.40 fee) | Nobody but the API. |
| `services`\* | What a barber sells | `barber_id`; `name`; `duration_minutes` 5-480; `price_cents`; `is_active` | Anyone: active services of listed barbers. Owner: all own. |
| `service_addons`\* | Optional extras | `barber_id`; `name`; `price_cents`; `is_active` | Same as services. |
| `availability` | Weekly hours, local wall-clock time in `barbers.timezone` | `barber_id`, `day_of_week` 0-6 (0 = Sunday), `start_time` < `end_time`; unique (`barber_id`, `day_of_week`, `start_time`) | Anyone, for listed barbers; the owner always. |
| `special_hours` | Per-date override (replaces `time_off`) | `barber_id`, `date` (unique together); `is_closed` with null times, or open with `start_time` < `end_time`; `reason` | Anyone, for listed barbers; the owner always. `reason` is not granted to anon/authenticated (the owner reads it through the API). |
| `bookings`\* | Appointments, app and manual | `barber_id` (restrict), `client_id` (null for walk-ins; set null if the client is deleted), `customer_name`, `service_id` (restrict), `starts_at`, `ends_at`, `source` `app`/`manual`, `status`, `payment_status`, `hold_expires_at`, money snapshot columns, `payment_intent_id` (unique when set), `cancelled_at`, `cancellation_reason` | The client on the booking and the barber who owns it. |
| `booking_addons`\* | Add-on snapshot per booking | `booking_id` (cascade), `addon_id` (restrict), `name`, `price_cents`; unique (`booking_id`, `addon_id`) | Whoever can read the booking. |
| `payments`\* | One row per Stripe charge (`pi_...`) or refund (`re_...`) | `booking_id` (restrict), `type` `charge`/`refund`, `stripe_object_id` (unique), `payment_intent_id`, `amount_cents`, `application_fee_cents`, `currency`, `status` | Whoever can read the booking. |
| `stripe_events` | Webhook de-duplication and durable record of events that could not be applied | `id` = Stripe event id; `type`; `received_at`, `processed_at`, `error`, `payload` | Nobody but the API. |
| `reviews`\* | One review per booking | `booking_id` (unique); (`booking_id`, `barber_id`) must match the booking; `client_id`; `rating` 1-5; `comment`; `is_hidden` | Anyone, unless hidden; `client_id` and `booking_id` are not granted to anon/authenticated. Reviewer names come from the `public_reviews` view. |
| `reports`\* | User reports (App Store requirement) | `reporter_id`, `reported_user_id`, `content_type` (`user`, `profile`, `review`, `image`), `content_id`, `reason`, `details`, `status` | The reporter. |
| `blocked_users`\* | Blocks | `blocker_id`, `blocked_id`; unique pair; no self-block | The blocker. |
| `waitlist` | Pre-launch email sign-ups | `email` (unique ignoring case) | Nobody but the API. |

Money columns on `bookings` (all `>= 0`, default 0): `service_price_cents`, `addon_total_cents` (in-person service price snapshot), `booking_fee_cents` (340, or 0 when the barber is `fee_exempt`), `application_fee_cents` (220), `barber_fee_share_cents` (120).

Status values: `status` is `pending`, `confirmed`, `completed`, `cancelled` or `no_show`. `payment_status` is `none`, `pending`, `succeeded`, `failed`, `refunded` or `partially_refunded`.

Deleting: a barber (or their auth user) cannot be deleted while bookings reference the barber, and a service cannot be deleted while bookings reference it. Deactivate with `is_active` / `is_public` / `profiles.is_disabled` instead.

## Views and functions

| Object | Who | What |
|---|---|---|
| `public_profiles` (view) | anon, authenticated | `id`, `name`, `username`, `avatar_url`, `cover_photo_url`, `role` of listed barbers only (public barber row, profile not disabled). Runs with owner rights on purpose. |
| `public_reviews` (view) | anon, authenticated | Visible reviews: `id`, `barber_id`, `rating`, `comment`, `created_at`, `reviewer_name` (first name, else username) and `reviewer_avatar_url`; never `client_id`. Null name/avatar when the reviewer is disabled. Owner rights on purpose. |
| `barber_rating_stats` (view) | anon, authenticated | `barber_id`, `review_count`, `average_rating` over non-hidden reviews. |
| `nearby_barbers(lat, lng, radius_miles = 25, limit = 50)` | anon, authenticated | Listed barbers within the radius, nearest first, with `distance_miles` (haversine, no PostGIS). Limit is clamped to 1-200. |
| `create_booking_hold(...)` | service role only | See below. |
| `barber_earnings_totals(barber_id, from, to)`, `barber_earnings_bookings(barber_id, from, to, limit, offset)` | service role only | Earnings for appointments starting in [from, to): fee share earned (charge − application fee), share reversed by refunds (proportional; succeeded or pending refunds), refunded to clients, counts by status, service revenue of completed bookings; and one page of bookings with each one's net fee share. Computed in SQL so no API row limit applies. |
| `is_admin()`, `owns_barber(barber_id)`, `barber_is_listed(barber_id)`, `is_active_user()` | used by policies | Helpers; all but `is_admin` are `SECURITY DEFINER`. `is_active_user()` is true when the caller's profile exists and is not disabled (storage writes). |
| `handle_new_user()` | trigger on `auth.users` insert | Creates the profile. `role` is `barber` only if signup metadata `role` is exactly `barber`; anything else (including `admin`) becomes `client`. Barbers also get a `barbers` row and, through the `create_barber_billing` trigger, a `barber_billing` row. Username comes from metadata `username` or the email local part, sanitised, with a random suffix on clashes. Only `https://` avatar URLs are kept. |
| `handle_user_email_change()` | trigger on `auth.users` email update | Copies the new email to `profiles.email`. |

## Booking hold lifecycle

1. The API checks the requested slot against `availability`, `special_hours` and the barber's `timezone`, reads `barber_billing.fee_exempt`, checks the client's limits (3 unpaid holds, 5 upcoming bookings per barber, 10 overall), releases this barber's expired holds itself (cancelling their PaymentIntents so they cannot be paid late), and calls
   `create_booking_hold(barber_id, client_id, service_id, starts_at, hold_expires_at, booking_fee_cents, application_fee_cents, barber_fee_share_cents, addon_ids, notes)`.
2. In one transaction the function:
   - cancels this barber's expired holds (`status = 'pending'` and `hold_expires_at < now()`; they get `cancellation_reason = 'hold_expired'`);
   - checks the service and every add-on are active and belong to the barber, and snapshots their prices;
   - inserts the booking as `pending` (`payment_status` `pending`, or `none` when the fee is 0) with `ends_at = starts_at + duration_minutes`, plus its `booking_addons`, and returns the row.
3. Errors the API maps:
   - `23P01` (exclusion violation on `bookings_no_overlap`): the slot is taken.
   - `22023` (invalid parameter): unknown/inactive service or add-on, or a hold expiry not in the future.
4. The API creates the PaymentIntent (340 cents, application fee 220) and stores `payment_intent_id` on the booking.
5. On `payment_intent.succeeded` the webhook records the event in `stripe_events`, inserts a `payments` row, and sets the booking to `confirmed` / `succeeded` with `hold_expires_at = null` (a CHECK only allows `hold_expires_at` on pending rows). If the hold expired more than 2 minutes earlier the slot is re-validated first; if the start time has passed or the slot is no longer bookable, or the hold was already released, the API refunds and keeps the `stripe_events` row with `error` set.
   `payment_intent.payment_failed` changes nothing (the client may retry the same intent); `payment_intent.canceled` releases the hold.
6. Overlap is enforced by `EXCLUDE USING gist (barber_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE status IN ('pending', 'confirmed')`, so back-to-back bookings are fine and cancelled, completed and no-show rows never block.

A fee-exempt barber's hold uses 0 for the three fee arguments; it can be confirmed straight away.

## Storage

Two public-read buckets: `avatars` (5 MB, JPEG/PNG/WebP/HEIC/HEIF) and `media` (10 MB, the same plus GIF). Authenticated users can insert, update, delete and list only objects whose first path segment is their own user id (`<user_id>/...`); a disabled account cannot insert, update or delete. Anonymous users cannot write.

## Local development

Everything below runs against the local Docker stack only.

```sh
supabase start                # first run; applies the migration and supabase/seed.sql
supabase db reset             # wipe the local database and re-apply migration + seed
supabase test db              # run the pgTAP tests in supabase/tests
supabase db lint              # plpgsql_check over the local database
supabase gen types typescript --local --schema public > packages/shared/src/types/database.generated.ts
```

Seed accounts (local only, password `local-dev-password`): `admin@example.com` (admin via `app_metadata`), `barber.one@example.com` (Fade Factory, pays the fee), `barber.two@example.com` (Sharp Lines, fee exempt), `client.one@example.com`, `client.two@example.com`.

Tests (`supabase/tests`):

| File | Covers |
|---|---|
| `01_privileges.test.sql` | RLS on every table, safe `SECURITY DEFINER` functions, no client write grants, per-table insert/update/delete denial for anon and authenticated, server-only tables unreadable |
| `02_rls_reads.test.sql` | Profile isolation, booking/payment/add-on visibility for clients and barbers, hidden reviews and private review columns, `public_reviews`, availability and special hours of unlisted barbers, non-public and disabled barbers, `public_profiles` (listed barbers only), `nearby_barbers`, admin claim handling |
| `03_bookings_integrity.test.sql` | Overlap exclusion, back-to-back slots, unique Stripe ids, CHECK constraints, `create_booking_hold` |
| `04_signup_trigger.test.sql` | `handle_new_user` role handling, barber + billing rows, usernames, email sync |
| `05_storage.test.sql` | Bucket settings, own-folder storage policies, disabled accounts cannot write |
| `06_earnings.test.sql` | Earnings functions: sums, proportional refund reversal, failed refunds ignored, date range, paging, isolation between barbers, no client access |

`scripts/rls-check.sql` holds the same catalog checks as `01_privileges` for running by hand in any SQL console.
