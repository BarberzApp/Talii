# End-to-end API harness (bookings and payments)

Drives the real booking and payment API over HTTP: `next dev` route handlers, the
**local** Supabase stack (real sign-ins with the anon key, real RLS) and Stripe
**test mode** (real PaymentIntents, a real Connect account, real webhooks forwarded
by `stripe listen`). Unit tests use fakes; this checks that the real pieces work together.

Plain Node ESM (`.mjs`), no new dependencies: it uses the repo's `stripe` and
`@supabase/supabase-js` packages.

## What it covers

| # | Scenario |
|---|---|
| C | Connect: status/onboarding for a barber with an account (nothing overwritten); a barber with none gets a real Express account and onboarding link; a repeat call reuses it; `metadata.barber_id` mismatch → 403 `ACCOUNT_MISMATCH`; clients get 403 |
| 1 | Availability in the barber's time zone (New York, Chicago), closed days, held/booked slots unavailable |
| 2 | Book → 201 + clientSecret → confirm with `pm_card_visa` → webhook → confirmed; one `payments` charge row; Stripe fee 220, barber nets 120 |
| 3 | Held slot → 409 `SLOT_TAKEN`; two simultaneous POSTs → exactly one 201 |
| 4 | `pm_card_chargeDeclined` then `pm_card_visa` on the same PaymentIntent |
| 5 | Late payment (hold expired, date closed) → not confirmed, refunded with reverse transfer, `stripe_events.error` set |
| 6a–d | Client cancel > 24h (refund), inside 24h (no refund), barber cancel (refund), cancel racing the payment webhook (one refund) |
| 7 | Duplicate delivery via `stripe events resend` and a signed replay → 200, no duplicate rows; bad signature → 400 |
| 8 | Fee-exempt barber → confirmed at once, no PaymentIntent |
| 9 | Walk-ins: overlapping → 409, non-overlapping → 201 |
| 10 | Authorization (other barber/client, no token) and `GET /api/earnings` per barber |
| W | Every webhook received during the run was processed; only expected events carry an error |

## Safety

- Refuses to run unless the Supabase URL is `http://127.0.0.1:*` / `localhost`, and unless the Stripe key starts with `sk_test_` (prints only `test key: yes/no`).
- Keys are read into memory (env, or `supabase status -o env` and `supabase/.env`) and never printed; output is scrubbed. Do not create `.env` files for this.
- Stripe objects it creates: one Custom connected account for barber one (metadata `e2e=talii-e2e-api`, reused across runs) and one Express account per run for barber three (deleted at the start of the next run and by `cleanup`). PaymentIntents, charges, transfers and refunds cannot be deleted in Stripe; they stay in test mode.
- Rows it creates carry `notes` / `reason` starting with `e2e-api`; each run purges the previous run's rows first. Barber three (`e2e.barber.three@example.com`) is a local auth user recreated each run.

## Run it

Prerequisites: local stack running (`supabase start`; `supabase db reset` for a fresh seed), Stripe CLI logged in or given `STRIPE_API_KEY` in its environment (never `--api-key`, which shows in process listings). `E2E_API_BASE` must be a localhost / 127.0.0.1 URL.

```sh
# 1. Load the test key into this shell without printing it
export STRIPE_SECRET_KEY="$(sed -n 's/^STRIPE_SECRET_KEY[[:space:]]*=[[:space:]]*//p' supabase/.env | head -1)"
case "$STRIPE_SECRET_KEY" in sk_test_*) echo "test key: yes";; *) echo "test key: no"; unset STRIPE_SECRET_KEY;; esac

# 2. Forward webhooks (platform and connected-account events); keep the log for scenario 7
STRIPE_API_KEY="$STRIPE_SECRET_KEY" stripe listen \
  --forward-to localhost:3010/api/webhooks/stripe \
  --forward-connect-to localhost:3010/api/webhooks/stripe 2>&1 \
  | sed -E 's/whsec_[A-Za-z0-9]+/whsec_[REDACTED]/g' > /tmp/stripe-listen.log &

# 3. Start the API against the LOCAL stack (process env overrides apps/web/.env and ../../.env)
eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
(cd apps/web && \
  NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  STRIPE_WEBHOOK_SECRET="$(STRIPE_API_KEY="$STRIPE_SECRET_KEY" stripe listen --print-secret)" \
  STRIPE_CONNECT_WEBHOOK_SECRET="" SENTRY_DSN="" NEXT_PUBLIC_SENTRY_DSN="" \
  NEXT_PUBLIC_APP_URL=http://localhost:3010 npx next dev -p 3010) &

# 4. Run (about two minutes)
E2E_LISTEN_LOG=/tmp/stripe-listen.log node apps/web/tests/e2e-api/run.mjs

# 5. Afterwards: delete the harness's Stripe accounts, restore barber one's seed
#    billing row (acct_localtest0001), purge harness rows, delete barber three
node apps/web/tests/e2e-api/run.mjs cleanup
```

Options (environment): `E2E_API_BASE` (default `http://localhost:3010`), `E2E_LISTEN_LOG`
(path of the `stripe listen` output; without it scenario 7 still does the signed replay),
`E2E_RESULTS` (write scenario results as JSON), `STRIPE_PUBLISHABLE_KEY` (a `pk_test_` key;
defaults to `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `supabase/.env`). With a publishable key,
payments are confirmed like the mobile Payment Sheet (publishable key + client secret);
without one, with the secret key.

Exit code 0 when every scenario passes. If another process runs `supabase db reset`
mid-run, just run it again: setup is idempotent (it re-links the Connect account and
updates its `metadata.barber_id` to the new seed barber id).

## Notes

- Destination charge mechanics as observed: Stripe transfers the full 340 to the barber's account and collects the 220 application fee from it (barber nets 120). A full refund with `reverse_transfer` + `refund_application_fee` reverses the 340 transfer and returns the 220 fee (barber nets −120 for that booking).
- The account used for barber one is a **Custom** account, so `POST /api/stripe/connect/dashboard` (Express login link) is only exercised for barber three's Express account (onboarding branch).
- Every webhook endpoint configured in the Stripe test account's dashboard also receives the test events a run produces.
