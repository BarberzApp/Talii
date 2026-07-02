# Domain Glossary

This file defines the canonical domain language and architecture boundaries for the Talii codebase. Use these terms exactly as written when discussing or implementing features.

## Core Domain Concepts

### Modules & Services

- **StripeWebhookAdapter**: The HTTP boundary that receives Stripe webhook events. Its sole responsibility is infrastructural: validating signatures, parsing raw Stripe metadata (e.g., splitting CSV strings, verifying fee calculations), and translating them into Stripe-agnostic domain payloads before passing them to the core domain services. It does not perform any database mutations itself.
- **BarberAccountService**: A deep domain service responsible for managing the state of a barber's Stripe Connect account (e.g., transitions between `pending`, `active`, and `deauthorized`).
- **BookingPaymentService**: A deep domain service responsible for the core business logic of bookings. It handles creating bookings, assigning fees, attaching addons, and processing refunds. It only accepts clean, Stripe-agnostic payloads (like `BookingPaymentPayload`).

## Payloads

- **BookingPaymentPayload**: A strictly-typed, Stripe-agnostic object created by the `StripeWebhookAdapter`. It contains clean data (e.g., arrays of addon IDs instead of CSV strings, validated numeric amounts) ready for the `BookingPaymentService` to consume.
