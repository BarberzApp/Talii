# Supabase Edge Functions

These functions are being retired. The agreed architecture (see
`docs/BACKEND_REBUILD_PLAN.md`) puts all server logic in the Next.js API routes
under `apps/web/src/app/api`. The three functions below stay only because the
mobile app still calls them; they are removed in Phase 4 once the mobile app
calls the API instead.

## Remaining functions

| Function | Caller | Replacement (Phase 3/4) |
|---|---|---|
| `stripe-connect` | mobile `BarberOnboardingPage`, `barberStripeHelper` | `POST /api/stripe/connect/onboarding` |
| `stripe-dashboard` | mobile `EarningsDashboard` | `POST /api/stripe/connect/dashboard` |
| `get-nearby-barbers` | mobile `BrowsePage` | `GET /api/barbers` |

`stripe-connect` and `stripe-dashboard` verify the caller's Supabase JWT with
`auth.getUser`, look up the caller's own barber row by user id, and ignore any
`barberId` or `email` in the request body. `stripe-connect` never adopts an
existing Stripe account by email and never marks an account active; the
`account.updated` webhook and `/api/connect/refresh-account-status` set the
status from Stripe.

Removed in Phase 1 (no callers): `create-payment-intent`,
`create-developer-booking`, `booking-reminders`.

## Environment

Set in the Supabase dashboard under Settings > Functions:

- `STRIPE_SECRET_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (provided by the platform)
- `APP_URL` (optional; base URL for Stripe return/refresh links)

## Local development

```bash
supabase start
supabase functions serve stripe-connect
```

Do not add new functions here; add an API route instead.
