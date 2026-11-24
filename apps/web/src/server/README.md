# apps/web/src/server

Server-only code behind the API routes in `src/app/api`. Every module imports
`server-only`, so importing one from a client component fails the build.

## Layout

| File | What it is |
|---|---|
| `env.ts` | `getServerEnv()`: required env vars validated once with zod; errors name the variable, never the value. |
| `clients.ts` | `getSupabaseAdmin()` (service role, typed with the generated `Database`) and `getStripe()` (pinned `STRIPE_API_VERSION`). Both lazy. |
| `errors.ts` | `ApiError(status, code, message)`, `errorResponse`, Postgres error codes (`PG`). |
| `route.ts` | `defineRoute({ auth, body?, query?, params? }, handler)`. Read its header comment first. |
| `validation.ts` | Shared zod pieces: `uuid`, `isoDateTime`, `calendarDate`, `commaList`, `queryInt`, `idParams`, ... |
| `payments.ts` | Writes to `payments` (one row per Stripe charge / refund id). |
| `bookings/` | `policy.ts` (hold length, refund policy, slot grid), `availability.ts`, `create.ts`, `update.ts`, `list.ts`, `manual.ts`. |
| `stripe/` | `webhook.ts`, `connect.ts`, `errors.ts` (`callStripe` turns Stripe errors into 502). |
| `earnings.ts` | Barber earnings totals. |
| `account.ts` | `GET/PATCH/DELETE /api/me`, `POST /api/me/barber`. Account deletion (what is kept and why) is documented on `deleteAccount`. |
| `catalog.ts` | A barber's own services and add-ons; delete deactivates when bookings reference the row. |
| `schedule.ts` | Weekly availability (atomic replace via `replace_availability`) and special hours. |
| `discovery.ts` | Public search (`nearby_barbers` / `search_barbers`), public profiles, reviews; leaves out users blocked either way. |
| `reviews.ts` | Reviews by the client of a completed booking; comments pass the shared word filter. |
| `safety.ts` | Blocks and reports; `hiddenUserIds()` for discovery filtering. |
| `admin.ts` | `/api/admin/*`: users, stats, reports, review moderation, media removal. |
| `storage.ts` | Bucket rules, own-folder URL checks (`assertOwnImageUrl`), signed uploads, folder removal. |
| `geocode.ts` | Google Geocoding / Places (US); `geocodeCityState` never throws. |
| `caller.ts` | `optionalCallerId(req)` for public routes that personalise when a token is present. |
| `rate-limit.ts` | In-memory per-IP limiter for public routes (per instance; not a hard limit). |
| `slack.ts` | Support webhook with mrkdwn escaping. |
| `testing/` | Test-only fakes: in-memory Supabase with storage and `auth.admin` (`fake-supabase.ts`), Stripe mocks with real offline webhook signing (`fake-stripe.ts`), seed data (`fixtures.ts`), fakes of the search/schedule/stats functions and review views (`api-fakes.ts`). |

## Writing a route

```ts
// src/app/api/things/[id]/route.ts
import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { ApiError } from '@/server/errors'
import { getSupabaseAdmin } from '@/server/clients'
import { idParams } from '@/server/validation'

export const PATCH = defineRoute(
  { auth: 'user', params: idParams, body: z.object({ name: z.string().trim().min(1).max(80) }) },
  async ({ user, params, body }) => {
    const db = getSupabaseAdmin()
    const { data: thing, error } = await db.from('things').select('id, owner_id').eq('id', params.id).maybeSingle()
    if (error) throw error // becomes 500 + Sentry, message hidden
    if (!thing || thing.owner_id !== user.id) throw new ApiError(404, 'NOT_FOUND', 'Not found.')
    // ... write with db, return JSON-serialisable data (200) or a Response
    return { ok: true }
  }
)
```

Conventions:

- Clients send `Authorization: Bearer <Supabase access token>`; there is no cookie auth and no CORS handling (the mobile app is native, the web app is same-origin).
- Errors are `{ error: { code, message } }`. Codes are UPPER_SNAKE and stable; messages are for people.
- The service-role client bypasses RLS: check ownership in every handler.
- Keep route files thin; put logic in a module here so it can be unit-tested.
- Money is integer cents; times are ISO 8601 instants; a barber's local times use `barbers.timezone`.

## Tests

`src/server/__tests__/*.test.ts` (jest, `@jest-environment node`). Mock
`@/server/clients` to return a `FakeDb` (`seedMarketplace()`) and
`createFakeStripe()`; mock `@sentry/nextjs`. Nothing touches the network.

```sh
npm -w apps/web run test -- --ci --watchAll=false src/server
```
