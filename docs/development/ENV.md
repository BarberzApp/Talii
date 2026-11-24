# Environment Variable Contract

This document details the environment variables required to run the Talii platform. It lists their runtime visibility and standard constraints.

---

## 1. Shared Client-Facing Envs

> [!IMPORTANT]
> These keys are embedded in frontend client bundles (Expo / Next.js static files).
> They must **never** contain privileged administrative secrets.

### Supabase & Gateway Keys

| Variable Name | Runtimes | Purpose / Context |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Web | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web | Anon database access key |
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile | Public Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile | Anon database access key |
| `EXPO_PUBLIC_API_URL` | Mobile | Base URL pointing to the Next.js API Gateway (e.g., `http://localhost:3002`) |
| `NEXT_PUBLIC_APP_URL` | Web | Base URL for the public Web application |

### Payment & Monitoring Keys

| Variable Name | Runtimes | Purpose / Context |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Web | Public Stripe publishable key |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Mobile | Public Stripe publishable key |
| `NEXT_PUBLIC_SENTRY_DSN` | Web | Client error tracking |
| `EXPO_PUBLIC_SENTRY_DSN` | Mobile | Client error tracking |

---

## 2. Server-Only Secrets

> [!WARNING]
> These keys must only be read in secure execution contexts (Next.js server-side or CI/CD).
> They must **never** have the `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix.

### Stripe & Database Integrations

| Variable Name | Read By | Purpose / Context |
| :--- | :--- | :--- |
| `STRIPE_SECRET_KEY` | Next.js API | Privileged Stripe operations (creating Intents, Transfers) |
| `STRIPE_WEBHOOK_SECRET` | Next.js API | Validates authenticity of incoming Stripe webhook calls |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Next.js API | Optional: signing secret of a separate Connect webhook endpoint (connected-account events such as `account.updated`) pointing at the same URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Next.js API / CI | Bypasses database Row Level Security (RLS) for gateway transactions |
| `OPENAI_API_KEY` | Next.js API | Used for profile and review content moderation |

### External Webhook & Integrations

| Variable Name | Read By | Purpose / Context |
| :--- | :--- | :--- |
| `SLACK_WEBHOOK_URL` | Next.js API | Optional. Incoming webhook `POST /api/support` posts support requests to; without it that route returns 503 |
| `GOOGLE_MAPS_API_KEY` | Next.js API | Optional. Google Geocoding + Places for `GET /api/geocode` (signed-in users only) and the server-side geocoding of a barber's city/state in `PATCH /api/me`; without it `/api/geocode` returns 503 and listings are saved without coordinates. **In Google Cloud, restrict the key** to the Geocoding API and Places API (API restrictions; it is a server key, so no HTTP-referrer restriction) **and set a daily quota** on both APIs so a bug or abuse cannot run up an unbounded bill. |
| `GMAIL_USER` | Next.js API | SMTP mail username for transactional emails |
| `GMAIL_PASS` | Next.js API | SMTP app password |

---

## 3. Enforcement Guidelines

1. **Client Isolation**: If a file in `apps/mobile` or client-side `apps/web` reads an environment variable without a public prefix (e.g. `STRIPE_SECRET_KEY`), compilation should fail or warnings will be triggered.
2. **Local Overrides**: Use `.env.local` for web overrides. Do not commit `.env` files containing actual passwords or secret keys.
