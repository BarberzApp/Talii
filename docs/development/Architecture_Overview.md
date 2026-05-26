# Talii System Architecture Details

This document outlines the architecture, components, and data-flow designs of the Talii platform.

---

## 1. High-Level Architectural Patterns

Talii is designed around a **Monolithic Backend Gateway** servicing a **Decoupled Frontend Web client** and a **React Native Mobile client**.

```
 +-------------------+ +--------------------+
 | Web App UI | | Mobile App UI |
 | (Next.js 15) | | (Expo SDK 53) |
 +---------+---------+ +---------+----------+
 | |
 | | HTTP (JWT Auth)
 | v
 | +--------------------+
 +---------------->| Next.js API Gateway|
 | (apps/web/src/api) |
 +---------+----------+
 |
 | Server-Side CRUD
 v
 +--------------------+
 | Supabase DB & |
 | Stripe Services |
 +--------------------+
```

### Structural Highlights
* **Next.js API Gateway**: Serves as the security and logic gateway. Rather than clients making direct PostgreSQL queries (which is error-prone and insecure), both platforms consume unified endpoints.
* **Workspace Dependency Flow**: Core algorithms, TypeScript schemas, and fee calculations are located in `packages/shared`. This package is loaded locally during compilation.

---

## 2. Component Audits

### apps/web
* **API Layer (`/api/mobile`)**: Exposes me/profile, booking creation, barber search, and slot availability to mobile clients.
* **Stripe Webhook handler (`/api/webhooks/stripe`)**: Automatically listens for `payment_intent.succeeded` events, decodes booking metadata, and updates status values to `confirmed`.

### apps/mobile
* **API Fetcher (`/shared/lib/api-client.ts`)**: Standard handler that hooks into the Expo/Supabase Session, extracts the token, and formats Gateway HTTP headers.
* **Stripe SDK Integration**: Combines `@stripe/stripe-react-native` (client components) with Gateway-sourced PaymentIntents.

### packages/shared
* **Availability Engine (`/domain/availability.ts`)**: Pure deterministic module that converts barber calendar inputs into timezone-independent timeslots.
* **Fee Model (`/domain/fees.ts`)**: Source of truth for split payouts.

---

## 3. Database & Schema Definitions

Talii uses Supabase Row Level Security (RLS) policies to protect tables.

### Core Database Relationships
* **`profiles`**: Holds user roles (`client` vs `barber`), contact details, and locations.
* **`barbers`**: Extends profiles with business names, specialties, and Stripe Account references.
* **`services`**: Lists services provided by barbers (price, duration, titles).
* **`bookings`**: Stores reservations (date, status, customer_id, barber_id, service_id). Status transitions are restricted to: `pending`, `confirmed`, `completed`, and `cancelled`.
* **`payments`**: Tracks transaction identifiers, platform splits, and charge statuses.

---

## Related Documentation

- **[Documentation Index](../DOC_INDEX.md)**: Web application documentation overview.
- **[Database Schema](../database/database-schema.txt)**: Structure of the database profiles and tables.
- **[RLS Policies](../database/rowlevelsecurity.txt)**: Supabase Row Level Security policy documentation.
- **[Root README](../../README.md)**: Monorepo system overview.
