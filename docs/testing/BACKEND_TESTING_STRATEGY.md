# Backend Testing Strategy & Implementation Plan

This document outlines the roadmap and detailed requirements for implementing robust testing for the backend components, including Next.js API routes, Supabase Edge Functions, and Database Security.

## 1. Next.js API Route Testing (Jest)
We will leverage the existing Jest setup in `apps/web` to create integration tests for critical API routes.

### Key Focus Areas & Required Checks:
- **Booking Creation (`/api/mobile/bookings`)**:
    - [ ] **Validation**: Verify 400 errors for missing `barberId`, `serviceId`, or `date`.
    - [ ] **Conflict Handling**: Ensure 409 status when a time slot is already booked.
    - [ ] **Business Rules**: Test constraints like "same day bookings not allowed" or "outside availability".
    - [ ] **Developer Mode**: Verify that developer barbers bypass Stripe and create bookings directly.
- **Payment Logic (`/api/create-checkout-session`)**:
    - [ ] **Fee Model**: Verify the $3.40 total charge and $1.80 application fee (BOCM share).
    - [ ] **Metadata**: Ensure all required metadata (barberId, serviceId, etc.) is correctly passed to Stripe.
    - [ ] **Add-ons**: Verify that add-on prices are correctly calculated but *not* added to the platform fee (fee-only model).

### Implementation Pattern:
- **Mocking**: Implement a standard, reusable mock for `supabaseAdmin` and `stripe` in a shared test utility.
- **Location**: Tests should reside in `__tests__` folders adjacent to their respective routes.

## 2. Supabase Edge Functions Testing (Deno)
Edge Functions require a Deno-native testing approach using `deno test`.

### Key Focus Areas & Required Checks:
- **Payment Intent (`create-payment-intent`)**:
    - [ ] **Fee Integrity**: CRITICAL check that `totalAmount` exactly equals `platformFee` ($3.40).
    - [ ] **Stripe Integration**: Mock Stripe API to verify `application_fee_amount` and `transfer_data` destination.
    - [ ] **CORS**: Verify correct headers for cross-origin requests from the mobile app.
- **Stripe Webhooks**:
    - [ ] **Signature Verification**: Test that invalid signatures are rejected.
    - [ ] **Event Handling**: Verify `checkout.session.completed` correctly triggers booking creation in Supabase.

### Implementation Pattern:
- Create a `__tests__` directory within each function folder (e.g., `supabase/functions/create-payment-intent/__tests__/`).
- Use `deno test` with mocked global fetch or specific client mocks.

## 3. End-to-End (E2E) Testing (Cypress)
Cypress will validate the integration between the frontend, Next.js API, and Supabase.

### Required Checks:
- [ ] **Booking Flow**: Complete a booking from the UI and verify the record appears in the database.
- [ ] **Payment Redirect**: Verify the app correctly handles the redirect to/from Stripe.
- [ ] **Auth Persistence**: Ensure backend APIs correctly identify the user via session/bearer tokens.

## 4. Database Security (RLS) Testing
Verify that data is protected at the database level, regardless of API logic.

### Required Checks:
- [ ] **Client Access**: Clients can only see their own bookings.
- [ ] **Barber Access**: Barbers can only see bookings assigned to them.
- [ ] **Profile Protection**: Ensure users cannot update other users' profile data (phone, carrier, etc.).
- [ ] **Service Role**: Verify `service_role` can bypass RLS for administrative tasks.

---

## Implementation Todos
- [ ] **Standardize Mocks**: Create `apps/web/src/test-utils/supabase-mock.ts` [id: test-utils-mock]
- [ ] **Mobile Booking Tests**: Implement `apps/web/src/app/api/mobile/bookings/__tests__/route.test.ts` [id: test-mobile-bookings]
- [ ] **Edge Function Tests**: Create Deno test for `create-payment-intent` [id: test-edge-functions]
- [ ] **Cypress Booking Flow**: Implement E2E test for the booking lifecycle [id: e2e-booking-flow]
- [ ] **RLS Verification**: Create a script to audit RLS policies against the `bookings` table [id: test-rls]
- [ ] **Documentation**: Maintain this document as the source of truth for backend quality [id: document-testing]
