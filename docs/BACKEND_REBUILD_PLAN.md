# Backend rebuild plan

Living plan for consolidating Talii's backend. Started 2026-11-16 on branch `refactor/backend-rebuild`.
Update the status column as phases land.

## Decisions (agreed with the owner)

- **Architecture:** Supabase provides the database, login and storage. All server logic lives in the Next.js API routes (`apps/web/src/app/api`). Web and mobile both call those routes with a Supabase Bearer token. All Supabase edge functions are removed.
- **Database:** the live database holds nothing worth keeping. Replace all existing migrations with one baseline and rebuild the project from it.
- **Language and libraries:** stay on TypeScript. Add `zod` for request validation. Remove `next-auth` and `@supabase/auth-helpers-nextjs`. Replace Stripe Checkout on web with Stripe's embedded Payment Element so web and mobile share one PaymentIntent path.
- **Secrets:** read from the local `.env` files only. Never copy values into code, docs, logs or commits.
- **Simplify first:** no user base yet, so fewer features that work beat many that half-work.

## Features

| Keep | Cut for now (rebuild later if wanted) |
|---|---|
| Booking and the $3.40 fee payment | Cuts video feed, likes, comments, analytics |
| Barber Stripe Connect onboarding and dashboard link | Google Calendar sync |
| Services and add-ons | Offline sync and offline page |
| Availability and special hours | In-app notification bell |
| Reviews (only after a completed booking) | Text reminders and confirmation texts |
| Browse and search, nearby barbers | Custom error-email pipeline (Sentry replaces it) |
| Manual appointments (barber's own calendar) | AI review moderation (keep the word filter) |
| Admin | Guest checkout |
| Report and block (App Store requirement) | On-demand requests, scheduling slots, booking restrictions |

## Phases

| # | Phase | Status |
|---|---|---|
| 0 | Safety net: make the test suites run | done 2026-11-17 |
| 1 | Delete dead code and cut features | done 2026-11-17 |
| 2 | Database baseline | done locally 2026-11-17; live reset pending |
| 3 | API rebuild | 3a (foundation, bookings, money, Stripe) done 2026-11-17; 3b (remaining routes) done 2026-11-18 |
| 4 | Clients go through the API | not started |
| 5 | Front end | not started |

### Phase 0: safety net

Baseline on 2026-11-16: shared tests pass; web jest 26/39; mobile jest 202/210; web `tsc` 48 errors; mobile `tsc` 6; web lint 849 errors.

- Fix web jest so API route tests load (`Request is not defined`).
- Fix mobile jest transforms and `@barber-app/shared` resolution.
- Delete tests of code that no longer exists.

### Phase 1: delete

- Web: unused login system (`features/auth`, `next-auth`), unused calendar chain, dead booking service, old UI kit copy, duplicate `cn()` helpers, re-export shims.
- Mobile: files unreachable from `App.tsx` (data-context, auth-store, services/api, dead hooks and settings screens).
- API: routes with no caller, and every route belonging to a cut feature.
- Edge functions: all of them, once their replacements exist (three have no caller and go immediately).
- Docs: keep about ten current documents.
- Unused packages, then regenerate the lockfile.

### Phase 2: database baseline

One migration, built from this target:

- `profiles`: role limited to client or barber; admin lives in `auth.users.app_metadata`. Email and phone not publicly readable.
- `barbers`: adds `timezone`. Stripe fields and `is_developer` writable only by the server.
- `services`, `service_addons`: prices in integer cents.
- `availability`, `special_hours`.
- `bookings`: `starts_at` / `ends_at`, money in integer cents, unique `payment_intent_id`, and an exclusion constraint that forbids overlapping bookings for one barber. No client inserts or updates.
- `booking_addons`, `payments` (unique per Stripe object), `stripe_events` (webhook dedupe).
- `reviews`: one per completed booking.
- `reports`, `blocked_users`.
- Storage: `avatars` and `media`, writes limited to the owner's folder.
- Row-level security on every table; no default grants to anonymous users.

Dropped: notifications, on-demand tables, scheduling slots, booking restrictions, time off (folded into special hours), text log, calendar sync tables, cuts tables, Prisma leftovers, and the triggers that validated bookings inside the database.

### Phase 3: API

One wrapper (`defineRoute`) handling Bearer login, role, zod validation and one error shape. About 16 routes:

- `GET /api/me`
- `GET /api/barbers`, `/api/barbers/:id`, `/api/barbers/:id/services`, `/api/barbers/:id/availability`
- `GET|POST /api/bookings`, `PATCH /api/bookings/:id` (cancel, complete), `POST /api/bookings/manual`
- `POST /api/stripe/connect/onboarding`, `POST /api/stripe/connect/dashboard`, `GET /api/stripe/connect/status`
- `POST /api/webhooks/stripe`
- `GET /api/earnings`
- `GET /api/geocode`, `POST /api/support`, `POST /api/waitlist`
- `GET /api/admin/users`, `PATCH /api/admin/users/:id`

Booking flow: validate the slot in the barber's timezone, insert a pending booking that holds the slot, create the PaymentIntent keyed to the booking, confirm on the webhook, and refund automatically if the hold was lost. Cancelling issues a real refund.

### Phase 3a: what landed (2026-11-17)

- Foundation in `apps/web/src/server` (see its README): `env.ts`, `clients.ts` (Stripe API version pinned to `2025-08-27.basil`), `errors.ts`, `route.ts` (`defineRoute`), `validation.ts`, test fakes in `testing/`.
- Routes: `GET /api/barbers/:id/availability`, `GET|POST /api/bookings`, `PATCH /api/bookings/:id`, `POST /api/bookings/manual`, `POST /api/webhooks/stripe`, `POST /api/stripe/connect/onboarding`, `POST /api/stripe/connect/dashboard`, `GET /api/stripe/connect/status`, `GET /api/earnings`.
- Removed: `create-checkout-session`, `create-developer-booking`, `mobile/bookings`, `mobile/availability/slots`, `bookings/create`, `payments/session`, `payments/barber-payments`, `earnings/monthly`, `connect/*`, and every Supabase edge function (`stripe-connect`, `stripe-dashboard`, `get-nearby-barbers`; the last is replaced by the `nearby_barbers` database function). The `supabase/functions` folder and its `config.toml` block are gone.
- **Hold length:** 10 minutes (`HOLD_MINUTES` in `server/bookings/policy.ts`). When the API releases expired holds (before every new hold and walk-in for that barber) it also cancels their PaymentIntents. A payment that succeeds within 2 minutes of the hold's expiry (`HOLD_GRACE_MINUTES`) is applied; later than that the slot is re-validated with the availability engine first. A booking whose start time has passed is never confirmed. A payment that cannot be applied (hold released, booking cancelled, slot gone, start passed) is refunded automatically and recorded in `stripe_events.error` plus Sentry.
- **Refund policy (booking fee only):** the barber cancels → full refund; the client cancels more than 24 hours before the start → full refund; the client cancels within 24 hours → no refund. Refunds use `reverse_transfer` and `refund_application_fee`. Nobody can cancel once the start time has passed (the barber marks it completed or no-show); completed and no-show bookings cannot be cancelled.
- **Cancel vs. payment race:** cancelling writes only if the booking's status and payment status are still what it read; otherwise it re-reads and decides again. If an unpaid hold's PaymentIntent cannot be cancelled because it already succeeded, the booking is treated as paid and the refund policy applies. A refund is never repeated: existing refund rows covering the charge, or Stripe's `charge_already_refunded`, count as done. A refund that ends failed or canceled is alerted, and a booking that flips back from refunded to paid is alerted too.
- **Payment failure:** `payment_intent.payment_failed` changes nothing: Stripe sends it per failed attempt and the client may retry the same intent (for example with another card). The hold's expiry or the client's cancel governs the slot. `payment_intent.canceled` releases the hold. Payment and refund events that carry `event.account` (connected-account events) are ignored.
- Slots use a 15-minute grid in the barber's time zone. Per client: at most 3 unpaid holds, 5 upcoming (pending or confirmed) bookings with one barber and 10 overall; the caps apply to fee-exempt barbers too.
- `account.updated` stores what `accounts.retrieve` returns now, not the event payload.
- Earnings totals come from the service-role-only SQL functions `barber_earnings_totals` / `barber_earnings_bookings` (no 1000-row cap); the list is paged (`limit`, `offset`) and `truncated` means more rows follow.
- Database privacy fixes made in the baseline after review: `public_profiles` lists only listed barbers; `reviews.client_id`/`booking_id` and `special_hours.reason` are not granted to clients, and reviewer names come from the `public_reviews` view; availability and special hours are readable only for listed barbers (or by the owner); disabled accounts cannot write to storage.
- Stripe dashboard setup: the webhook endpoint must send `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`, `charge.refund.updated`, and, from connected accounts, `account.updated` and `account.application.deauthorized`. If connected-account events come from a separate Connect endpoint, set its secret as `STRIPE_CONNECT_WEBHOOK_SECRET`. Set the endpoint API version to `2025-08-27.basil`.
- Left for Phase 3b (done, see below): `GET /api/me`, `GET /api/barbers`, `/api/barbers/:id`, `/api/barbers/:id/services`, `GET /api/geocode`, `POST /api/support`, `POST /api/waitlist`, `/api/admin/users`, and the `cut` branch in `super-admin/delete-photo`.

### Phase 3b: what landed (2026-11-18)

Every route uses `defineRoute`; each route file's header comment documents auth, request and response.

- Account: `GET|PATCH|DELETE /api/me`, `POST /api/me/barber`, `POST /api/uploads` (signed upload URL into `<user_id>/`).
- Barber self-management: `GET|POST /api/me/services`, `PATCH|DELETE /api/me/services/:id`, the same for `/api/me/addons`, `GET|PUT /api/me/availability`, `GET|PUT|DELETE /api/me/special-hours`.
- Discovery: `GET /api/barbers`, `GET /api/barbers/:id`, `GET /api/barbers/by-username/:username`, `GET /api/barbers/:id/reviews` (services and add-ons are part of `/api/barbers/:id`; there is no separate `/services` route).
- Reviews and safety: `GET|POST /api/reviews`, `PATCH|DELETE /api/reviews/:id`, `POST /api/reports`, `GET|POST /api/blocks`, `DELETE /api/blocks/:userId`. Blocks hide users from each other (both directions) in discovery and reviews.
- Public: `GET /api/geocode` (was `/api/nominatim`; signed-in users only since the review, because every call costs money and no public page needs it), `POST /api/support`, `POST /api/waitlist` (now stored in the `waitlist` table), `GET /api/health` (kept: the Cypress smoke test calls it).
- Admin (`app_metadata.role === 'admin'`): `GET /api/admin/users`, `PATCH /api/admin/users/:id`, `GET /api/admin/stats`, `GET /api/admin/reports`, `PATCH /api/admin/reports/:id`, `GET /api/admin/reviews`, `PATCH /api/admin/reviews/:id`, `DELETE /api/admin/media`.
- Removed: `api/super-admin/*`, `api/mobile/*`, `api/nominatim`, `shared/lib/api-auth.ts` (and its `SUPER_ADMIN_EMAIL` fallback), `api-errors.ts`, `cors.ts`, `contentModeration.ts` (moved to `packages/shared`), and the `supabaseAdmin` export of `shared/lib/supabase.ts`.
- Database (baseline edited in place): service-role functions `replace_availability`, `search_barbers`, `admin_platform_stats`; pgTAP `07_api_functions.test.sql`.
- Account deletion keeps booking and payment history and the barber row (bookings reference them with `ON DELETE RESTRICT`); everything personal is scrubbed, `profiles.deleted_at` is set, the username is kept (reserved; the old `/book/<username>` link 404s), and the auth user is soft-deleted (`auth.admin.deleteUser(id, true)`: email/phone hashed, metadata and identity data emptied, sign-in blocked, the email free to sign up again; verified on the local stack). Details on `deleteAccount` in `apps/web/src/server/account.ts`.
- Review fixes (2026-11-18): bookings and slot lookups refuse barbers hidden by blocks (either way) or an admin suspension; `barber` routes need `profiles.role = 'barber'` as well as the row, and only an admin can restore a demoted barber (`403 BARBER_ACCESS_REMOVED`); admin listing control is `barbers.listing_suspended` (`listingSuspended` in `PATCH /api/admin/users/:id`), separate from the barber's own `is_public`; hidden reviews cannot be edited or deleted by their author (`409 REVIEW_HIDDEN`); reporters never see `reported_user_id` (API and column grant); own-image URLs must have the exact `/api/uploads` shape; admins cannot re-enable a self-deleted account (`409 ACCOUNT_DELETED`), and a failed ban when disabling reports `signInBlocked: false` instead of a 500.
- Owner admin: `scripts/set-admin.ts` (see `docs/development/LOCAL_DEVELOPMENT.md`).

### Phase 4: clients

One shared `apiFetch` used by web and mobile. Move direct database writes behind the API first (bookings, Stripe fields, roles, reviews, account deletion), then reads.

### Phase 5: front end

Fix type errors, turn build-time type and lint checks back on, then a UX pass.

## Carried forward from the Phase 1 review

These were found by the independent review of Phase 1 and are requirements for the phases named.

- **Phase 2 (must):** `barbers.stripe_account_id`, `stripe_account_status`, `stripe_account_ready` and `is_developer` must not be writable by clients. Until then a barber can copy another barber's Stripe account id onto their own row and get that account's dashboard or onboarding link, or flag themselves as a developer to skip the fee. Do not deploy before this lands.
- **Phase 3:** every Connect route must also check that the Stripe account's `metadata.barber_id` matches the caller's barber before creating a link.
- **Phase 3:** Connect onboarding must only create a replacement account when Stripe says the old one is missing, never on a transient error.
- **Phase 3:** a paid PaymentIntent whose booking cannot be created must leave a durable record (`stripe_events`) and a Sentry alert.
- **Phase 3:** refund events must be de-duplicated; `amount_refunded` is a running total.
- **Phase 3:** remove the last guest-checkout handling (`payments/session`, webhook guest branch) and the `cut` branch in `super-admin/delete-photo`. (Done: both removed.)
- **Phase 4:** rewrite `middleware.ts` (security headers only) and drop `@supabase/auth-helpers-nextjs`. Send Bearer tokens from the twelve web call sites that now return 401.
- **Phase 4:** set `app_metadata.role = 'admin'` on the owner's account with `scripts/set-admin.ts` (the `SUPER_ADMIN_EMAIL` fallback is already gone with `api-auth.ts`).
- **Phase 5:** remove wording that promises a confirmation text (`booking/success`, `support`), the Cuts entries in `updates-badge.tsx`, and the one-button toggle on the mobile Browse page.
- **Phase 5:** fix the three remaining mobile type errors; the mobile CI workflow fails on them. Remove native packages for cut features (`expo-notifications`, `expo-av`, `expo-media-library`) and verify with a build.
- **To verify with Stripe:** that the webhook endpoint receives connected-account events (`account.updated`); mobile barbers only become `active` through it.

## Parked feature: Cuts

Removed in Phase 1. Notes for rebuilding it later:

- What it was: a short-video portfolio feed per barber, with likes, views, comments and a browse feed (`cuts`, `cut_analytics`, `cut_comments` tables; web `app/cuts`, `use-cuts.ts`; mobile `CutsPage`, `useOptimizedFeed`).
- Why it was cut: likes and views had row-level security turned off, anyone could post as any barber or comment as any user, and the counters drifted because their triggers were wrong.
- Rebuild shape: `cuts(id, barber_id, url, thumbnail, title, is_public)` with owner-only writes checked through `barbers.user_id`; `cut_likes(cut_id, user_id)` as a primary-key pair; counts from a view rather than triggers; uploads through a signed URL into the `media` bucket; all writes through `/api/cuts`.
- The removed code is in git history before the Phase 1 commit on `refactor/backend-rebuild`.

## Open items for the owner

- `bocmstyle.com` no longer serves this app (it redirects to an unrelated site), yet it is the mobile app's default API host and the web app URL. Choose the new domain.
- Change the Apple reviewer test account's password; it was committed in a migration.
- Stripe (test and live): remove the old webhook endpoints (an ngrok tunnel and `barber-app-five.vercel.app`, which now serves a different app) and add the new deployment's `/api/webhooks/stripe` with the events listed in Phase 3a.
- Google Cloud: restrict the Maps key to the Geocoding and Places APIs and your domains, and set a daily quota.
- Align Stripe keys: the mobile app's publishable key is live while the server keys are test. Use test everywhere until launch.
- Before the live database reset: run `scripts/set-admin.ts` against the new project for the owner's account.
