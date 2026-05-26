# Talii Platform

Talii is a modern, full-stack booking application connecting beauty and grooming professionals (Barbers) with clients. It features a unified Next.js API Gateway backend and cross-platform clients sharing a standardized type and business logic layer.

---

## Architecture & UML Breakdown

This repository is organized as an **npm monorepo** utilizing workspaces. It is divided into three core scopes:
- **`apps/web`**: Next.js 15.3 Web application & API Gateway (React 19)
- **`apps/mobile`**: Expo SDK 53 / React Native mobile client (React 19)
- **`packages/shared`**: Shared TypeScript types, constants, and domain logic

### 1. Monorepo Topology
The diagram below shows how the workspaces are structured and how dependencies flow between packages.

```text
+-------------------------------------------------------------+
| TALII MONOREPO ROOT (npm workspaces) |
| [package.json] |
+-------------------------------------------------------------+
 | |
 v (workspace apps) v (workspace packages)
+-------------------------------+ +---------------------+
| /apps | | /packages |
| | | |
| +-------------------------+ | | +---------------+ |
| | web | | | | shared | |
| | (Next.js 15.3 Gateway | | | | (Domain Logic, | |
| | & UI - Port 3002) | | | | Types, etc.) | |
| +------------+------------+ | | +-------+-------+ |
| ^ | | ^ |
| HTTP Request | | | | |
| (with JWT) | | | | |
| +------------+------------+ | | | |
| | mobile |--+-------+----------+ |
| | (Expo SDK 53) | | (Shared imports) |
| +------------+------------+ | |
+---------------+---------------+-----------------------------+
 |
 v (Supabase API & Deno Runtime)
+-------------------------------------------------------------+
| /supabase |
| |
| +-----------------------------------------------------+ |
| | Supabase Postgres | |
| | (Data Storage, Schema, RLS, Auth) | |
| +--------------------------+--------------------------+ |
| ^ |
| | (RPC / HTTP Calls) |
| +--------------------------+--------------------------+ |
| | Edge Functions | |
| | (stripe-connect, stripe-dashboard, etc.) | |
| +-----------------------------------------------------+ |
+-------------------------------------------------------------+
```

---

### 2. End-to-End Booking and Payment Flow
This sequence shows the secure transaction flow from the mobile app through the Next.js API Gateway, Stripe payment sheet validation, and final database insertion via the Stripe Webhook.

```text
 Client (Mobile) Next.js Gateway (/api) Stripe API / Webhook Supabase DB
================== ======================== ====================== =============
 | | | |
 [1] |-- POST /bookings --------->| | |
 | (Barber, Date, Addons) | | |
 | |-- [2] Calculate Fees (fees.ts) |
 | |-- [3] Build Metadata (stripe-metadata.ts) |
 | |-- [4] Create PaymentIntent ->| |
 | |<-- [5] Return ClientSecret --| |
 |<-- [6] Return Secrets -----| | |
 | | | |
 [7] |-- Present Card Form & | | |
 | Confirm Payment Intent -------------------------------->| |
 |<-- [8] Succeeded Confirmation ----------------------------| |
 | | | |
 | | (Asynchronous) |
 | |<-- [9] POST Webhook (payment_intent.succeeded) |
 | |-- [10] Verify Signature & Parse Metadata |
 | |================= DATABASE TRANSACTION =====================|
 | |-- [11] Insert Booking (status: 'confirmed') --------------->|
 | |-- [12] Insert Payment Record ------------------------------>|
 | |============================================================|
 | |-- [13] 200 OK Response ----->| |
```

---

### 3. Stripe Connect Barber Onboarding Flow
This sequence represents the onboarding flow for a professional barber to receive payouts directly.

```text
 Barber (Mobile) Supabase DB Edge Function (stripe-connect) Stripe Connect API
================= ============= =============================== ====================
 | | | |
 [1] |-- Complete profile info >| | |
 [2] |-- Tap "Connect Stripe" --+------------------------------>| |
 | | |-- [3] Query existing account |
 | | |-- [4] Create Express Account ---->|
 | | |<-- [5] Return account_id ---------|
 | |<-- [6] Store account_id ------| |
 | | (status: 'pending') | |
 | | |-- [7] Create Account Link ------->|
 | | |<-- [8] Return Link URL -----------|
 |<-- [9] Onboarding URL ---+-------------------------------| |
 | | | |
 [10] |-- WebBrowser.openBrowserAsync(onboardingUrl) ------------+---------------------------------->|
 [11] | (Barber completes Stripe onboarding flow) <------------+----------------------------------|
 [12] |<-- Redirects to return_url ------------------------------+-----------------------------------|
 | | |
 [13] |-- Poll/Read status ----->| |
 |<-- Returns status info --| |
 | (stripe_account_ready)| |
```

---

## Project Structure

- **[apps/web/](apps/web)**: Next.js 15.3 Web application & API Gateway (React 19)
- **[apps/mobile/](apps/mobile)**: Expo SDK 53 / React Native mobile client (React 19)
- **[packages/shared/](packages/shared)**: Shared TypeScript types, constants, and domain logic
- **[supabase/](supabase)**: Database migrations, seed scripts, and Deno Edge Functions
- **[scripts/](scripts)**: Administrative scripts (type generation, diagnostics)

## Getting Started

### Prerequisites

* **Node.js**: `v20` or higher (LTS recommended)
* **npm**: Native workspaces require standard npm (do not use Yarn or pnpm)
* **Expo Go**: Download the mobile app on iOS/Android for testing

### Installation

Install all monorepo dependencies from the root directory:

```bash
npm install
```

### Environment Setup

Configure `.env` files in the root, `apps/web/`, and `apps/mobile/` folders. See [ENV.md](docs/development/ENV.md) for a complete environment contract.

Key variables required:
```env
# Supabase Public Keys
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API Gateway Config
EXPO_PUBLIC_API_URL=http://localhost:3002 # Local development gateway URL

# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Running the Project

**1. Run Next.js Web App / API Gateway:**
```bash
npm run dev
```
*Web client will serve on `http://localhost:3002`.*

**2. Start Expo Mobile Client:**
```bash
npm -w apps/mobile start
```
*Use `npm run ios` or `npm run android` to boot simulators.*

**3. Test Shared Package:**
```bash
npm run test:shared
```

---

## Shared Domains (`packages/shared/src/domain`)

* **`fees.ts`**: The canonical algorithm determining booking platform charges ($3.40 total user fee, platform absorbs $0.40 Stripe fee, net $3.00 split 60% platform / 40% barber).
* **`availability.ts`**: Generates valid booking slots by comparing barber schedules, special hours, and existing bookings.
* **`stripe-metadata.ts`**: Standardizes the JSON payload injected into Stripe transaction intents.
* **`auth/`**: The state machine managing session validation, profile fetches, and token refreshes.

---

## Key Documentation

- **[Consolidation Analysis](docs/refactoring/BACKEND_CONSOLIDATION_ANALYSIS.md)**: The master plan for alignment between Web and Mobile, tracking recent architectural changes.
- **[Environment Variable Contract](docs/development/ENV.md)**: Full contract specifying public client environment variables and server secrets.
- **[App Breakdown](docs/development/APP_BREAKDOWN.md)**: High-level overview of main flows (onboarding, booking, payments).
- **[Local Development Guide](docs/development/LOCAL_DEVELOPMENT.md)**: Detailed setup for Stripe Connect, ngrok, and troubleshooting.
- **[Architecture Overview](docs/development/Architecture_Overview.md)**: High-level architecture, gateway patterns, and database layouts.
- **[Type Generation Guide](docs/development/TYPE_GENERATION.md)**: How to keep `@barber-app/shared` types in sync with the Supabase schema.

---

## Administrative CLI commands

* **Schema Type Sync**: Sync TypeScript typings with the database:
 ```bash
 npm run types:generate
 ```
* **Webhook Signature Verification**: Start a local Stripe webhook listener:
 ```bash
 stripe listen --forward-to localhost:3002/api/webhooks/stripe
 ```

