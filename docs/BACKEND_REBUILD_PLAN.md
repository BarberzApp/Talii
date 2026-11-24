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
| 2 | Database baseline | done locally 2026-11-17; live project reset 2026-11-22 |
| 3 | API rebuild | 3a (foundation, bookings, money, Stripe) done 2026-11-17; 3b (remaining routes) done 2026-11-18 |
| 4 | Clients go through the API | 4a (web + shared client) done 2026-11-19; 4b (mobile) done 2026-11-21 |
| 5 | Front end | mobile done 2026-11-21; web done 2026-11-21 (a3d29374) |

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
- **Refund policy (booking fee only):** the barber cancels → full refund; the client cancels more than 24 hours before the start → full refund; the client cancels within 24 hours → no refund, except that a client cancelling a still-unconfirmed (`pending`) booking whose payment went through anyway always gets a full refund. Refunds use `reverse_transfer` and `refund_application_fee`. Nobody can cancel once the start time has passed (the barber marks it completed or no-show); completed and no-show bookings cannot be cancelled.
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

### Phase 4a: what landed (2026-11-19)

- `packages/shared/src/api`: `createApiClient({ baseUrl, getAccessToken, fetch?, timeoutMs? })` with typed methods for every route the apps use, `ApiError` (`status`, `code`, `details`), `bookingErrorMessage`, and contract types that mirror each route header (rows from the generated `Tables<>`). `domain/format.ts`: cents and barber-time-zone formatting. Tests run with `npm run test:shared`.
- Shared auth: `AuthController` never creates rows; sign-up passes `role`, `name`, `username`, `business_name` as metadata (the `handle_new_user` trigger creates the rows); profile from `GET /api/me` via `profileFromMe` (`is_admin`, `barber_id`, `business_name`, `onboarding_complete`). The adapter's `createProfile` / `getBarberRow` / `createBarberRow` are optional and ignored; favorites are no-ops.
- Web: `shared/lib/api.ts` (token from the Supabase browser session), `shared/lib/uploads.ts` (`POST /api/uploads` + `uploadToSignedUrl`). Every page and component reads and writes through the API; no `.from(...)` calls remain in client code. `middleware.ts` only sets security headers (CSRF check removed: the API uses Bearer tokens, not cookies); `@supabase/auth-helpers-nextjs` removed. `/auth/callback` does the PKCE exchange in the browser.
- Checkout: Payment Element (`shared/components/payment/booking-payment.tsx`) on the `clientSecret` from `POST /api/bookings`; `/booking/success` polls `GET /api/bookings` until confirmed. Clients see and cancel upcoming bookings on `/profile` (Appointments tab).
- Removed: time off (closed special-hours days replace it), data context, old hooks/types, addon service, CSRF helper, dead settings components.
- Review fixes (2026-11-20):
  - Payment safety: the booking dialog cannot be closed while a payment is being confirmed, and leaving the payment step checks the PaymentIntent first (succeeded/processing keeps the booking). Server: a client cancelling a booking that was still `pending` when they cancelled gets the fee back in full if the payment went through anyway (they never saw a confirmation), regardless of the 24-hour rule.
  - Calendar loads the visible month by `from`/`to` (paged, every status except expired holds), shows times in the barber's time zone, and offers Mark completed / Mark missed (confirmed, after start) and Cancel with a refund preview (before start).
  - Google sign-up role choice is stored as `{ role, at }` and applied only within 10 minutes to an account created after it; cleared on sign-in and when rejected; the browser time zone is sent with `POST /api/me/barber`.
  - `/booking/success` removes the client secret from the URL, releases the hold after a failed payment, says "payment received" only when Stripe reports it, ends polling with a "still processing" state, and asks signed-out visitors to sign in.
  - Weekly schedule edits several windows per day and can be cleared; onboarding saves on Skip and before the Stripe redirect; browse and admin search run on the server with paging.
  - Shared client: the timeout covers reading the body; a non-JSON 2xx body is `ApiError` `INVALID_RESPONSE`.
  - CSP: only the configured Supabase origin, Stripe's Payment Element hosts (incl. 3-D Secure frames), the Sentry host from `NEXT_PUBLIC_SENTRY_DSN`, and `worker-src 'self' blob:`.

### Phase 4b: what landed (2026-11-21)

- `apps/mobile/app/shared/lib/api.ts` is the app's only data path: the shared client with `EXPO_PUBLIC_API_URL` (development falls back to `http://localhost:3000` with a warning; release builds have no fallback host) and the Supabase session token, refreshed when it expires within 60 seconds (below supabase-js's own margin). `api-factory.ts` holds the parts without React Native imports (base URL, token getter, `uploadBytes`, `bookingPageUrl`) so Node can test them. Supabase is used only for Auth and `uploadToSignedUrl`; the client is typed with `Database` so new table access shows up in `tsc`.
- Auth: `createAuthAdapter({ supabase, api })` sends role, name, username and business name as sign-up metadata and reads the profile from `GET /api/me`; login and sign-up screens create no rows. Admin comes from `isAdmin`.
- Booking: `POST /api/bookings` with the slot's `startsAt`; `clientSecret: null` means confirmed; otherwise the Stripe PaymentSheet pays the fee. When the sheet is cancelled or fails, the app reads the PaymentIntent first (`retrievePaymentIntent`) and only releases the hold (`PATCH` cancel) if it is not succeeded, processing or awaiting capture. The PaymentIntent now allows `card` and `link` only (server change in `server/bookings/create.ts`): delayed methods (ACH, Klarna, Cash App, Amazon Pay) cannot settle within the 10-minute hold. Apple Pay and Google Pay stay off on mobile until an Apple merchant ID and the Stripe Expo config plugin are set up.
- Calendar: loads the visible month (bounds in the barber's time zone, padded a week, every page) and reloads when the month changes; a failed load shows an error with Retry instead of an empty month. Days are grouped in the barber's time zone, matching the times shown. Complete, no-show and cancel follow the API rules. Walk-ins use a 15-minute grid over the barber's whole day minus their own live bookings (expired holds ignored), since `POST /api/bookings/manual` does not enforce weekly hours.
- Barber self-service: services and add-ons (prices typed as text, saved as cents), weekly hours (`PUT` the whole week; every window of a day is editable; overlaps are caught before saving; Save is blocked with a Retry if the week failed to load), profile and listing (`PATCH /api/me`), onboarding (saves progress before opening Stripe Connect, sets the device time zone, marks `onboardingComplete` last), earnings (`GET /api/earnings`, cents).
- Stripe Connect: onboarding or dashboard link opened with `WebBrowser.openAuthSessionAsync(url, 'bocm://stripe-connect')`; the website's return and refresh pages send the browser back, then the app calls `GET /api/stripe/connect/status`. `App.tsx` ignores those deep links while that session is open.
- Discovery and safety: Browse sends the search text as `q` (with lat/lng when location is on) and pages through `GET /api/barbers`; ratings come with each card; reviews need a completed, unreviewed booking and use the shared word filter; reports and blocks go through `/api/reports` and `/api/blocks`; account deletion is `DELETE /api/me` with `{ confirm: true }` (409 `HAS_UPCOMING_BOOKINGS` explained). Uploads: `POST /api/uploads` into `avatars` or `media`, then `PATCH /api/me`.
- Removed: `api-client.ts`, `bookingService.ts`, `bookingDetailsHelper.ts` (fee math), `contentModeration.ts`, the old row types in `types/index.ts`, Twitter/Facebook fields.
- Not on mobile yet: a special-hours (closed days) screen (barbers use the website).
- Checks: mobile `tsc` 0 errors; mobile jest 23 suites, 195 tests; a Node smoke script runs the app's own `api-factory.ts` and `auth-adapter.ts` against `next dev` on the local stack (sign-in, nearby and search, slots, booking, SLOT_TAKEN, cancel, token refresh, services/add-ons/hours, walk-in, upload, sign-up and account deletion).

### Phase 5: front end

Fix type errors, turn build-time type and lint checks back on, then a UX pass.

### Phase 5: what landed (2026-11-21)

- Web build runs with type and lint checks on (ESLint 9 flat config; 0 errors, 40 warnings: 25 hook-dependency, 15 `<img>`). The repo now has one React (19.0.0, as Expo needs); the web app had its own 19.2.4 copy, so Next.js and the app code used different Reacts.
- Sentry on the web: `global-error.tsx`, `instrumentation-client.ts`, `onRequestError`.
- Web UX pass at 390px and desktop: login errors, forgot/reset password, sign-up errors, browse search in place, barber page Share/Report/Block, bookings loading/error states, calendar, settings (account deletion, blocked users), services visibility, profile, hours, admin with real data.
- Design changes on both apps: fee note up front, 3-step booking, barber calendar opens on Today, richer success page (add to calendar, maps link, barber's time zone, cancellation policy), faster barber page (skeleton at once, 1 `/api/me` call, no second barber fetch).
- Identifiers renamed to Talii (`talii://`, `com.yaskhalil.talii`); Expo slug and Sentry org unchanged.
- Checks: web tsc 0, web jest 228, shared 30, pgTAP 293, mobile tsc 0, mobile jest 203; production build passes; booking (fee-exempt), success page and calendar checked in a headless browser at 390px and 1280px.
- Left as is: primary buttons are white on #EE6D23 (about 3.1:1, below 4.5:1 for small text); no public fee flag on `GET /api/barbers/:id` yet (the fee note is generic); no web screen for walk-ins (mobile has one).

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
- **Phase 5:** ~~fix the three remaining mobile type errors~~ (done in 4b). Remove native packages for cut features (`expo-notifications`, `expo-av`, `expo-media-library`) and verify with a build.
- **To verify with Stripe:** that the webhook endpoint receives connected-account events (`account.updated`); mobile barbers only become `active` through it.

## Parked feature: Cuts

Removed in Phase 1. Notes for rebuilding it later:

- What it was: a short-video portfolio feed per barber, with likes, views, comments and a browse feed (`cuts`, `cut_analytics`, `cut_comments` tables; web `app/cuts`, `use-cuts.ts`; mobile `CutsPage`, `useOptimizedFeed`).
- Why it was cut: likes and views had row-level security turned off, anyone could post as any barber or comment as any user, and the counters drifted because their triggers were wrong.
- Rebuild shape: `cuts(id, barber_id, url, thumbnail, title, is_public)` with owner-only writes checked through `barbers.user_id`; `cut_likes(cut_id, user_id)` as a primary-key pair; counts from a view rather than triggers; uploads through a signed URL into the `media` bucket; all writes through `/api/cuts`.
- The removed code is in git history before the Phase 1 commit on `refactor/backend-rebuild`.

## Status (2026-11-24)

The rebuild is complete and merged into `main` (PR #14). Backend, database, website and phone app are
done and tested; the live Supabase project runs the new schema. What is left is deployment and launch
setup, below.

**How changes reach `main`:** through a pull request only. The "Protect main" ruleset requires the three
CI checks in `.github/workflows/ci.yml` to pass (Website and shared package, Phone app, Database (pgTAP))
with the branch up to date, and blocks force-pushes and deletion; it has no bypass list. The older
"Auth" ruleset additionally limits branch creation and updates to admins, so merging a PR needs an admin.
The Vercel deploy (`deploy-web.yml`) and EAS builds (`eas-build.yml`) run only when started by hand
from the Actions tab.

## Before launch (in order)

1. **Phone app against the live project.** Run it in the iOS simulator (`cd apps/mobile && npx expo run:ios`;
   Expo Go cannot load Stripe's native module) with `EXPO_PUBLIC_API_URL=http://localhost:3000` and the
   website running locally against the live project. Check: sign up and confirm, browse, 3-step booking,
   card `4242 4242 4242 4242` and 3-D Secure card `4000 0025 0000 3155` (returns to the app), success screen
   and add-to-calendar, cancel and refund message, barber setup (profile, services, hours), Stripe Connect
   onboarding returning to the app (`talii://stripe-connect`), photo upload, walk-in, Today view,
   account deletion.
2. ~~**Merge the branch.**~~ Done 2026-11-24 (PR #14).
3. **Domain.** `bocmstyle.com` no longer serves this app (it redirects to an unrelated site).
4. **Hosting.** Deploy `apps/web` (website + API; Vercel fits Next.js). Server env: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`, optional `GOOGLE_MAPS_API_KEY`,
   `SLACK_WEBHOOK_URL`, Sentry DSN (see `apps/web/src/server/env.ts`).
5. **Supabase auth settings (live project).** Site URL = the domain; redirect allow-list =
   `<domain>/auth/callback`, `<domain>/reset-password`, `talii://**` (currently `http://localhost:3000`,
   set 2026-11-22). The token-hash reset template is already set on the live project.
6. **Email provider.** Supabase's built-in mailer sends only a few emails an hour and is not for production.
   Connect an SMTP provider (Resend, Postmark, ...) under Authentication → SMTP, sending from the domain.
   Put a real contact address on the privacy and terms pages (they still say support@talii.com).
7. **Stripe.** Remove the old webhook endpoints (an ngrok tunnel and `barber-app-five.vercel.app`, which now
   serves a different app). Add `<domain>/api/webhooks/stripe` with the events listed in Phase 3a, for test
   and then live. At launch switch the server and both apps to live keys together (the mobile `.env`
   currently holds the test publishable key).
8. **Phone app build.** Set `EXPO_PUBLIC_API_URL` to the domain. Apple: register `com.yaskhalil.talii`, create
   the App Store Connect record, new EAS credentials (optionally rename the Expo slug `BOCM` on expo.dev first).
   Change the Apple reviewer test account's password (it was committed in an old migration).
9. **Google Cloud.** Restrict the Maps key to the Geocoding and Places APIs and the domain; set a daily quota.
10. **Housekeeping.** Revoke the Supabase access token in the root `.env` when not needed; delete the
    pre-reset backup of the old data (in the session scratch folder) or move it somewhere safe.

## Later (not needed for launch)

- Booking confirmation email and iOS push (needs the email provider and Apple setup).
- Exact fee note: a public `booking: { feeCents }` field on `GET /api/barbers/:id` so the note can say
  "no booking fee" for fee-exempt barbers instead of "some barbers waive it".
- Shared rate limiting (the current limiter is in memory, per server instance; bookings are already
  capped in the database: 3 unpaid holds, 5 upcoming per barber, 10 overall).
- Special-hours (closed days) screen on mobile; a walk-in screen on the website.
- Cuts (parked feature, see above).

## Record

- 2026-11-22: live database reset. All old data, accounts and storage removed; baseline applied;
  migration history in sync; generated types match. The owner's account is admin.
- 2026-11-23: owner decisions on the website (darker button orange, `/reach` and the waitlist route removed,
  one `/admin` page, unconfirmed support and landing claims removed, fee-exempt barbers not asked to set up
  Stripe).
- 2026-11-23: live smoke test (website on localhost:3000 against the live project, temporary accounts, all
  removed afterwards): sign-in, signup trigger, barber setup, RLS on billing and services, signed upload,
  public image URL, storage folder rules, availability, fee-exempt booking, SLOT_TAKEN, cancel, account
  deletion with file removal: 24/24 pass. Stripe payment paths are covered by the local e2e harness.
- 2026-11-24: branch pushed to GitHub.
- 2026-11-24: website lint clean (0 errors, 0 warnings): hook dependencies fixed without refetch loops; images moved to
  next/image (Supabase storage allowed via `remotePatterns`; user images on other hosts render unoptimised so an
  unexpected avatar URL cannot crash a page). Edge cases: a service hidden mid-booking now reloads the barber and
  returns to the service step with a clear message; red buttons darkened for contrast; the landing page's
  earnings preview uses a realistic, labelled example.
- 2026-11-24: merged into `main` (PR #14); CI on every pull request; `main` protected (ruleset "Protect main").
