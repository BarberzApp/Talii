# App Breakdown

This document provides a high-level overview of the Talii platform's architecture, main flows, and where to find important logic in the codebase.

## Architecture Overview
- **Frontend (Web):** Next.js 15.3 (TypeScript, Tailwind CSS, Shadcn UI)
- **Frontend (Mobile):** React Native & Expo SDK 53 (twrnc)
- **API Gateway & Backend:** Next.js API Routes, Supabase PostgreSQL, Supabase Auth, Deno Edge Functions
- **Payments:** Stripe Connect (Express) & Stripe Payment Intents
- **Shared Logic:** Workspace library (`packages/shared`) containing canonical fees, availability slots engine, and Stripe metadata schemas.
- **Database Schema:** See [database-schema.txt](../database/database-schema.txt)

## Main Flows

### 1. Onboarding (Barber)
- **Purpose:** Collect business info, services, and connect Stripe account to receive client payouts.
- **Key Files:**
 - Web: `apps/web/src/app/barber/onboarding/page.tsx`
 - Mobile: `apps/mobile/app/pages/BarberOnboardingPage.tsx`
- **DB Tables:** `barbers`, `profiles`, `services`
- **Stripe Connect:** Handled via the Edge Function at `supabase/functions/stripe-connect`
- **Logic:**
 - Checks for required fields and Stripe account status before marking onboarding as complete.
 - RLS policies restrict permissions to only the profile owner (see [rowlevelsecurity.txt](../database/rowlevelsecurity.txt)).

### 2. Booking Flow
- **Purpose:** Clients browse profiles, view availability slots, choose service add-ons, and book appointments.
- **Key Files:**
 - Gateway: `/api/mobile/bookings` and `/api/mobile/availability/slots`
 - Web Client: `apps/web/src/app/book/[username]/page.tsx`
 - Mobile Client: `apps/mobile/app/shared/components/BookingForm.tsx`
- **DB Tables:** `bookings`, `services`, `barbers`, `profiles`, `service_addons`
- **Logic:**
 - Resolves availability slots using the shared logic engine (`packages/shared/src/domain/availability.ts`).

### 3. Payments
- **Purpose:** Handle split payments via Stripe destination charges, transferring payouts to barbers and platform fees to Talii.
- **Key Files:**
 - Webhook Fulfillment: `apps/web/src/app/api/webhooks/stripe/route.ts`
 - Shared Fee Calculations: `packages/shared/src/domain/fees.ts`
- **DB Tables:** `payments`, `bookings`, `barbers`
- **Logic:**
 - Calculates fees ($3.40 total user fee, platform absorbs $0.40 Stripe transaction fee, remaining $3.00 net split 60% platform / 40% barber).
 - Stripe webhook listener automatically matches `payment_intent.succeeded` events, parses metadata contract, and inserts database records.

## Where to Find Key Logic
- **Authentication:** `packages/shared/src/domain/auth/` & `apps/web/src/shared/lib/api-auth.ts`
- **Profile Management:** `apps/web/src/features/profile/` & `apps/mobile/app/pages/UserProfilePage.tsx`
- **RLS Policies:** [rowlevelsecurity.txt](../database/rowlevelsecurity.txt)

## Additional References
- [README.md](../../README.md)
- [Database Schema](../database/database-schema.txt)
- [Local Development Guide](LOCAL_DEVELOPMENT.md)
