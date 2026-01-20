# Barber App (Monorepo)

A modern, full-stack booking platform connecting Cosmetologists with clients, featuring a unified backend gateway and cross-platform clients.

## Architecture & Frameworks

This project is organized as an **npm monorepo** using workspaces to share logic and types between the web and mobile applications.

- **Frontend (Web)**: Next.js 15.3 (App Router) / React 19
- **Mobile (iOS/Android)**: Expo SDK 53 / React 19 / React Native 0.79
- **Shared Logic**: TypeScript monorepo package for types, constants, and domain logic
- **Backend**: Supabase (Auth, Postgres, Storage) + Next.js API Gateway + Edge Functions
- **Payments**: Stripe (Connect, Checkout, and Payment Intents)
- **Monitoring**: Sentry (Web & Mobile)

## Project Structure

```bash
barber-app/
├── apps/
│   ├── web/          # Next.js web application (React 19)
│   └── mobile/       # Expo/React Native mobile application (React 19)
├── packages/
│   └── shared/       # Shared business logic, types, and constants
├── supabase/         # Database migrations and Edge Functions
└── scripts/          # Administrative and maintenance scripts
```

## Getting Started

### 1. Prerequisites
- Node.js (Latest LTS)
- npm (Standardized package manager)
- [Expo Go](https://expo.dev/go) (for mobile development)

### 2. Installation
Install all dependencies for the entire monorepo from the root directory:
```bash
npm install
```
*Note: Do not use Yarn; the project is standardized on npm workspaces.*

### 3. Environment Setup
Create a `.env` file in the root (and/or inside `apps/web` and `apps/mobile` as required) with the following core keys:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# App Configuration
NEXT_PUBLIC_APP_URL=https://bocmstyle.com
```
See `ENV.md` for a full breakdown of the environment contract.

### 4. Running Development Servers

**Web App:**
```bash
npm run dev
```

**Mobile App:**
```bash
# Start Expo development server
npm -w apps/mobile start

# Or run directly on devices/simulators
npm run ios
npm run android
```

## Key Documentation

- [Consolidation Analysis](BACKEND_CONSOLIDATION_ANALYSIS.md): The master plan for alignment between Web and Mobile, tracking recent architectural changes.
- [App Breakdown](apps/web/src/docs/development/APP_BREAKDOWN.md): High-level overview of main flows (onboarding, booking, payments).
- [Local Development](apps/web/src/docs/development/LOCAL_DEVELOPMENT.md): Detailed setup for Stripe Connect, ngrok, and troubleshooting.
- [Type Generation](docs/development/TYPE_GENERATION.md): How to keep `@barber-app/shared` types in sync with the Supabase schema.

## Development Workflow

- **Shared Changes**: If you modify `packages/shared`, you may need to restart the development servers to pick up type changes.
- **Database Migrations**: Managed via the Supabase CLI in the `/supabase` directory.
- **Super Admin**: Access the management panel at `/super-admin` (see README for credentials).

## 📣 Prominent Booking Link for Barbers

Barbers see a highly visible booking link banner at the top of their dashboard. This is the primary entry point for clients. Barbers can:
- Copy the direct booking URL.
- Share via the native device share menu.
- Download a QR code for physical/digital marketing.
