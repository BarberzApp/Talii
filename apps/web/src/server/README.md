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
| `testing/` | Test-only fakes: in-memory Supabase (`fake-supabase.ts`), Stripe mocks with real offline webhook signing (`fake-stripe.ts`), seed data (`fixtures.ts`). |

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
