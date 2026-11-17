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
| 3 | API rebuild | not started |
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
- **Phase 3:** remove the last guest-checkout handling (`payments/session`, webhook guest branch) and the `cut` branch in `super-admin/delete-photo`.
- **Phase 4:** rewrite `middleware.ts` (security headers only) and drop `@supabase/auth-helpers-nextjs`. Send Bearer tokens from the twelve web call sites that now return 401.
- **Phase 4:** set `app_metadata.role = 'admin'` on the owner's account, then remove the `SUPER_ADMIN_EMAIL` fallback.
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
