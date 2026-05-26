# Talii Platform

Talii is a modern, full-stack booking application connecting beauty and grooming professionals (Barbers) with clients. It features a unified Next.js API Gateway backend and cross-platform clients sharing a standardized type and business logic layer.

---

## Architecture & UML Breakdown

This repository is organized as an **npm monorepo** utilizing workspaces. It is divided into three core scopes:
- **`apps/web`**: Next.js 15.3 Web application & API Gateway (React 19)
- **`apps/mobile`**: Expo SDK 53 / React Native mobile client (React 19)
- **`packages/shared`**: Shared TypeScript types, constants, and domain logic

### 1. Monorepo Topology
The monorepo uses npm workspaces to isolate concerns while sharing a single source of truth for types and logic.

```text
┌─────────────────────────────────────────────────────────────┐
│                  TALII MONOREPO ROOT (npm)                  │
│                        [package.json]                       │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
       ┌───────▼───────┐              ┌───────▼───────┐
       │     /apps     │              │   /packages   │
       └───────┬───────┘              └───────┬───────┘
               │                              │
   ┌───────────┴───────────┐          ┌───────▼───────┐
   │          web          │          │     shared    │
   │ (Next.js 15 Gateway)  │◄─────────┤ (Domain Logic, │
   └───────────┬───────────┘          │  Types, etc.) │
               │                      └───────▲───────┘
   ┌───────────▼───────────┐                  │
   │         mobile        │                  │
   │     (Expo SDK 53)     ├──────────────────┘
   └───────────┬───────────┘
               │
       ┌───────▼───────┐
       │   /supabase   │
       │ (Postgres/RLS)│
       └───────────────┘
```

---

### 2. End-to-End Booking and Payment Flow
Secure transaction flow from mobile through the Next.js API Gateway to Stripe and Supabase.

| Step | Participant | Action |
|:---|:---|:---|
| **01** | **Mobile** | `POST /bookings` (Selection + Add-ons) |
| **02** | **Gateway** | Fee calculation (`fees.ts`) + Metadata build |
| **03** | **Stripe** | Create `PaymentIntent` -> Return `ClientSecret` |
| **04** | **Mobile** | Present Stripe Payment Sheet |
| **05** | **Stripe** | Async Webhook: `payment_intent.succeeded` |
| **06** | **Gateway** | **DB Transaction:** Insert Booking + Payment Record |
| **07** | **DB** | Confirm rows written (status: `confirmed`) |

---

### 3. Stripe Connect Barber Onboarding Flow
Onboarding sequence for professional barbers to receive direct payouts.

```text
BARBER (Mobile)        NEXT.js / EDGE          STRIPE API
      │                      │                     │
  [1] ├─ Submit Profile ────►│                     │
  [2] ├─ "Connect Stripe" ──►│                     │
      │                      │ [3] Query Account   │
      │                      ├────────────────────►│
      │                      │ [4] Create Express  │
      │                      ├────────────────────►│
      │                      │◄─── [5] Account ID ─┤
  [6] │◄── Onboarding URL ───┤                     │
      │                      │                     │
  [7] ├─ Complete Flow ──────┼────────────────────►│
  [8] │◄─── Redirect ────────┼─────────────────────┤
      │                      │                     │
  [9] ├─ Poll Status ───────►│ [10] Check DB      │
      │◄── Ready (Active) ───┤                     │
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
