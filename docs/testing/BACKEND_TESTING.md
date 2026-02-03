# Backend Testing Guidelines

This document defines how we test backend behavior in this repo (Next.js API routes and Supabase Edge Functions), with concrete checks and repeatable workflows.

## Scope
- Next.js API routes in `apps/web/src/app/api`
- Shared backend logic in `apps/web/src/shared/lib`
- Supabase Edge Functions in `supabase/functions`
- End-to-end API validation through Cypress

## 1. Next.js API Route Tests (Jest)

### What we test
- Request validation (missing/invalid fields -> 400)
- Auth failures (missing/invalid bearer tokens -> 401)
- Business rule enforcement (conflicts, availability, limits -> 409)
- Correct usage of external services (Stripe metadata, Supabase inserts)
- Error handling (Supabase errors -> 500, specific constraint errors -> 409)

### How we test
- Use Jest tests colocated in `__tests__` next to routes.
- Mock `supabaseAdmin`, `stripe`, and `validateBearerToken`.
- Use `Request` objects to simulate API calls.

### Example
- `apps/web/src/app/api/mobile/bookings/__tests__/route.test.ts`

## 2. Shared Business Logic Tests (Jest)

### What we test
- Fee calculations and metadata building
- Booking service validation
- Date/time utility correctness

### Location
- `apps/web/src/shared/lib/__tests__/`

## 3. Supabase Edge Function Tests (Deno)

### What we test
- Fee-only model integrity (total amount must equal $3.40)
- Correct Stripe parameters (`application_fee_amount`, `transfer_data`)
- Required fields and error status handling
- CORS preflight responses

### How we test
- Use `deno test` with `handleCreatePaymentIntentRequest` and injected mocks.
- Keep request handling logic in an exported function to enable direct testing.

### Example
- `supabase/functions/create-payment-intent/__tests__/create-payment-intent.test.ts`

## 4. End-to-End (Cypress)

### What we test
- API health checks
- Booking flow API integration (payment intent or developer booking)

### Required environment variables
- `CYPRESS_BASE_URL` (default: `http://localhost:3002`)
- `CYPRESS_TEST_ACCESS_TOKEN` (Bearer token)
- `CYPRESS_TEST_BARBER_ID`
- `CYPRESS_TEST_SERVICE_ID`

### Scope note
- Cypress is intentionally limited to a minimal API smoke test at this stage.

### Example
- `apps/web/cypress/e2e/booking-flow.cy.ts`

## 5. Database RLS Verification

### What we test
- Clients can only read their own `bookings`
- Barbers can only read their own `bookings`
- Users cannot edit other users' `profiles`
- `service_role` can bypass for admin operations

### Approach
- Use SQL-based RLS assertions in a script or test harness.
- Favor data setup + validation using the Supabase service role key.
- Script entry point: `scripts/rls-check.sql`

## Configuration Checks (Local)

Use these to verify configs before running full test suites.

### Jest config sanity check
```bash
node -e "require('./apps/web/jest.config.js'); console.log('jest config ok')"
```

### Deno config sanity check
```bash
deno check --config supabase/functions/deno.json supabase/functions/create-payment-intent/index.ts
```

### Cypress config sanity check
```bash
node -e "console.log('cypress baseUrl', process.env.CYPRESS_BASE_URL || 'http://localhost:3002')"
```

### RLS script presence
```bash
test -f scripts/rls-check.sql && echo "RLS script ok"
```

## Running Tests (Local)

### Next.js (Jest)
```bash
npm -w apps/web test
npm -w apps/web test:api
```

### Edge Functions (Deno)
```bash
cd supabase/functions/create-payment-intent
deno test --allow-env
```

### Cypress
```bash
cd apps/web
CYPRESS_BASE_URL=http://localhost:3002 npm run test:e2e
```

## CI Alignment

Use the same commands as local runs, plus secrets in CI:

### Required secrets / env vars
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `CYPRESS_BASE_URL`
- `CYPRESS_TEST_ACCESS_TOKEN`
- `CYPRESS_TEST_BARBER_ID`
- `CYPRESS_TEST_SERVICE_ID`

### Recommended CI commands
```bash
npm -w apps/web test
cd supabase/functions/create-payment-intent && deno test --allow-env
cd apps/web && npm run test:e2e
```
