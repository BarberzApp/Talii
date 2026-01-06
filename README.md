# Cosmetology App

A unified platform that serves cosmetologists and clients through a Next.js (web) experience, an Expo-powered mobile dashboard, and a Supabase backend with Stripe Connect payments.

## Apps & APIs

- **Web (`/src/app`)**: Next.js 14 (App Router) with server actions, Supabase auth, NextAuth sessions, Stripe Connect, and a PWA-ready UI controlled by `NEXT_PUBLIC_ENABLE_SW`.
- **Mobile (`/BocmApp`)**: Expo 53 app (React Native) that mirrors cosmetologist-facing flows; see `BocmApp/docs/README.md` plus the EAS guides under `BocmApp/docs/build/`.
- **Supabase (`/supabase`)**: Postgres schema + migrations plus Deno-powered Edge functions that back Stripe webhooks, developer booking utilities, and webhook helpers.
- **Scripts (`/scripts`)**: Helpers for provisioning the super admin, verifying Stripe state, running migrations, and bootstrapping test data.

## Key Features

- **Role-aware flows** for clients, cosmetologists, and admin with dedicated onboarding, booking, and profile surfaces (`/src/app/(client)`, `/src/app/(barber)`, `/src/app/super-admin`).
- **Stripe Connect + subscription-safe payouts** with platform fee, developer mode toggles, and live webhook handling under `/src/app/api/webhooks/stripe`.
- **Supabase-backed data** with row-level security, fine-grained policies (`src/docs/database/rowlevelsecurity.txt`), and curated migrations (`/supabase/migrations`).
- **Super Admin panel** at `/super-admin` for managing accounts, visibility, developer fees, review moderation, and analytics (see `scripts/create-super-admin.js` for setup).
- **Booking link + QR flow**: every cosmetologist dashboard surfaces a shareable booking link/QR code to grow client bookings.

## Directory Layout

- `src/`: Next.js web app (`app` routes, `features`, shared components, hooks, instrumentation, and docs).
- `BocmApp/`: Expo (React Native) mobile shell with its own docs, assets, and components.
- `supabase/`: Supabase CLI project with `migrations`, `functions`, and `config.toml`.
- `scripts/`: Node helpers (super admin creation, testing utilities, Stripe checks, etc.).
- `public/`: Static assets (logos, service worker, icons).
- `docs/` & `src/docs/`: Deeper write-ups on architecture, testing, hiring, release checklists, and production readiness.

## Documentation Reference

- `src/docs/development/APP_BREAKDOWN.md`: Architecture + flow map (onboarding, booking, payments).
- `src/docs/development/LOCAL_DEVELOPMENT.md`: Expanded local dev checklist (node, npm, ngrok/Stripe CLI, Supabase, troubleshooting).
- `src/docs/development/ARCHITECTURE_OVERVIEW.md`: System design notes and integration touchpoints.
- `src/docs/database/database-schema.txt`: Table/column reference for Postgres.
- `src/docs/database/rowlevelsecurity.txt`: Supabase policy rules per table.
- `src/docs/database/constraints.txt`: Keys and constraint coverage.
- `BocmApp/docs/README.md` + `BocmApp/docs/build/*.md`: Mobile-specific workflows and EAS build guides.

## Getting Started

1. Clone the repo and install root deps:
   ```bash
   npm install
   ```
2. Create a `.env.local` (and `.env` for Docker if needed) with the values below. A `.env.example` is not provided, so keep this list for reference.

### Required environment variables

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Stripe:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- **App & NextAuth:** `NEXT_PUBLIC_APP_URL` (typically `http://localhost:3002`), `NEXT_PUBLIC_BASE_URL`, `NEXTAUTH_URL=http://localhost:3002`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_ENABLE_SW=false`
- **Google OAuth / Calendar:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- **Security:** `WAITLIST_PASSWORD`, `SUPER_ADMIN_EMAIL=primbocm@gmail.com`, `SUPER_ADMIN_PASSWORD`

### Optional / production helpers

- **Sentry:** `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `EXPO_PUBLIC_SENTRY_DSN`
- **Email/SMS:** `GMAIL_USER`, `GMAIL_PASS`
- **Support & moderation:** `SLACK_WEBHOOK_URL`, `OPENAI_API_KEY`

## Running the Web App

1. Start the Next dev server:
   ```bash
   npm run dev -- -p 3002
   ```
   The app expects `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_BASE_URL` to match `http://localhost:3002` so API calls and redirects resolve correctly.
2. Build for production:
   ```bash
   npm run build
   npm run start
   ```
3. Lint:
```bash
   npm run lint
```

Stripe Connect webhooks rely on a public tunnel (ngrok or `stripe listen`) pointed at `http://localhost:3002/api/webhooks/stripe`. See `src/docs/development/LOCAL_DEVELOPMENT.md`.

## Running the Mobile App

1. Install mobile deps:
```bash
   cd BocmApp
   npm install
```
2. Start Expo:
```bash
   npx expo start
   ```
3. Follow `BocmApp/docs/build/EAS_QUICK_START.md` or `EAS_BUILD_GUIDE.md` for production builds.

## Docker Setup

Use `scripts/docker.sh` to orchestrate the stack (Next + Postgres + Redis). The script wraps `docker-compose.dev.yml` (dev mode) and `docker-compose.yml` (production-like).

- Development (hot reload): `./scripts/docker.sh dev`
- Production-like: `./scripts/docker.sh start`
- Stop everything: `./scripts/docker.sh stop`

Compose maps port `3002` ➜ container `3000`. Postgres & Redis listen on `5432`/`6379` with the default `postgres` user/password/db. Supply your env vars via the host shell or a `.env` file before launching.

## Testing

- Unit/integration: `npm run test`
- Watch tests: `npm run test:watch`
- CI/coverage: `npm run test:ci`
- Targeted suites: `npm run test:api`, `npm run test:components`, `npm run test:integration`
- E2E (Cypress): `npm run test:e2e` / `npm run test:e2e:open`
- Static typing: `npm run lint`

## Super Admin Panel

The `/super-admin` route is the gatekeeper for platform-level controls. Only the super admin account (`primbocm@gmail.com`) can log in, inspect stats, moderate reviews, toggle developer mode, and manage public/disabled visibility.

- Create/reset the super admin via: `node scripts/create-super-admin.js`
- Developer mode bypasses Stripe platform fees so the cosmetologist keeps 100% of service revenue; it should only be enabled for testing or onboarding.
- Stats, review moderation, profile management, and quick actions (export logs, refresh status, backup) are all exposed inside the panel.

## Booking Link Visibility

Every cosmetologist dashboard and settings page keeps a prominent booking link banner that can be copied, shared, or exported as a QR code. The goal is to make sharing the booking URL the fastest path to a new client.

## Supabase Functions & Migrations

- Edge functions live under `/supabase/functions` and power utilities such as developer bookings, payment intents, Stripe Connect helpers, and webhook proxies.
- Run migrations with the Supabase CLI (`supabase/db push` or similar) using the SQL files under `/supabase/migrations`.

## Additional Resources

- `src/docs/development/CURRENT_STATUS_ANALYSIS.md`, `FUTURE_DEVELOPMENT.md`, and `SETTINGS_IMPROVEMENTS.md` capture ongoing work.
- `src/shared/lib/supabase.ts`, `src/app/api/connect`, and `src/shared/lib/stripe-service.ts` hold the integration logic that pairs the UI with Stripe/Supabase.
- `src/features` contains composable UI flows to kick off new bookings, manage services, and orchestrate notifications.
