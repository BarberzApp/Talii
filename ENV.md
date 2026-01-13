# Environment Variable Contract

This document defines **all environment variables** used by the system and
**which runtime is allowed to read them**.

Anything not listed here **must not be added** without updating this document.

---

## Shared (Public – safe to expose to clients)

> These variables are embedded into client builds (Expo / Next.js).
> They must **not grant privileged access**.

### Supabase (client access)

| Variable | Used By | Purpose |
|--------|--------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile (Expo) | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile (Expo) | Supabase anon client key |
| `NEXT_PUBLIC_SUPABASE_URL` | Web (Next.js) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web (Next.js) | Supabase anon client key |

---

### Stripe (client)

| Variable | Used By | Purpose |
|--------|--------|--------|
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Mobile | Stripe publishable key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Web | Stripe publishable key |

---

### App / URLs

| Variable | Used By | Purpose |
|--------|--------|--------|
| `NEXT_PUBLIC_APP_URL` | Web | Public app base URL |
| `EXPO_PUBLIC_API_URL` | Mobile | Base URL for the Next.js API gateway (e.g. `https://www.bocmstyle.com`) |
| `NEXT_PUBLIC_ENABLE_SW` | Web | Enable Service Worker / PWA behavior when set to `true` |

---

### Expo / EAS (build/runtime)

| Variable | Used By | Purpose |
|--------|--------|--------|
| `EXPO_PROJECT_ID` | Mobile | Expo project ID (used for push notifications) |
| `EAS_BUILD_PROFILE` | Mobile | EAS build profile name (build-time behavior) |

---

### Monitoring

| Variable | Used By | Purpose |
|--------|--------|--------|
| `EXPO_PUBLIC_SENTRY_DSN` | Mobile | Sentry client error reporting |
| `NEXT_PUBLIC_SENTRY_DSN` | Web | Sentry client error reporting |

---

## Server-only (Secrets – must never reach clients)

> These variables must exist **only** in backend / server runtimes.
> They must **never** be prefixed with `EXPO_PUBLIC_` or `NEXT_PUBLIC_`.

---

### Supabase (admin)

| Variable | Used By | Purpose |
|--------|--------|--------|
| `SUPABASE_URL` | Edge Functions | Supabase project URL (injected by Supabase runtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | API / Jobs | Full database access (bypasses RLS) |

---

### Stripe (server)

| Variable | Used By | Purpose |
|--------|--------|--------|
| `STRIPE_SECRET_KEY` | API | Stripe privileged API access |
| `STRIPE_WEBHOOK_SECRET` | API | Verify Stripe webhook signatures |
| `STRIPE_BYPASS` | API | Development-only Stripe bypass flag |

---

### Monitoring (server/build)

| Variable | Used By | Purpose |
|--------|--------|--------|
| `SENTRY_DSN` | Web (server/edge) | Sentry DSN for server/edge reporting (falls back to `NEXT_PUBLIC_SENTRY_DSN`) |
| `SENTRY_ORG` | Web build | Sentry org (source map upload) |
| `SENTRY_PROJECT` | Web build | Sentry project (source map upload) |

---

### Google / OAuth

| Variable | Used By | Purpose |
|--------|--------|--------|
| `GOOGLE_CLIENT_ID` | API | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | API | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | API | OAuth callback URL |

---

### Email (Gmail)

| Variable | Used By | Purpose |
|--------|--------|--------|
| `GMAIL_USER` | API | Gmail SMTP username |
| `GMAIL_PASS` | API | Gmail SMTP password |

---

### Runtime flags

| Variable | Used By | Purpose |
|--------|--------|--------|
| `DEVELOPMENT_MODE` | API | Enables development behavior |

---

### Security / admin

| Variable | Used By | Purpose |
|--------|--------|--------|
| `WAITLIST_PASSWORD` | Web API | Protect waitlist endpoints (server-only) |
| `SUPER_ADMIN_EMAIL` | Web API | Super admin identity (server-only) |
| `SUPER_ADMIN_PASSWORD` | Web API | Super admin password (server-only) |
| `SLACK_WEBHOOK_URL` | Web API | Post support messages to Slack |
| `SECURITY_WEBHOOK_URL` | Web API | Send security events to an external webhook |

---

### AI / moderation

| Variable | Used By | Purpose |
|--------|--------|--------|
| `OPENAI_API_KEY` | Web API | Server-only key for content moderation calls |

---

### Dev tooling (scripts / CI)

| Variable | Used By | Purpose |
|--------|--------|--------|
| `SUPABASE_ACCESS_TOKEN` | Scripts / CI | Non-interactive Supabase CLI auth (preferred over `supabase login` in CI) |
| `SUPABASE_PROJECT_REF` | Scripts / CI | Supabase project ref for generating schema-derived types |
| `SUPABASE_PROJECT_ID` | Scripts / CI | Alias for `SUPABASE_PROJECT_REF` (compat) |
| `PROJECT_REF` | Scripts / CI | Alias for `SUPABASE_PROJECT_REF` (compat) |
| `SUPABASE_GEN_MODE` | Scripts / CI | Type generation mode: `remote` (default) or `local` |

---

## Runtime-provided (not set by us)

These are set by the platform/framework at runtime and are not secrets:

- `NODE_ENV` (Node/Next.js)
- `NEXT_RUNTIME` (Next.js runtime selector: `nodejs` vs `edge`)
- `NGROK_URL` (optional dev helper; adds an allowed CORS origin when set)

## Environment-specific values

### App URL / Redirects

| Environment | Value |
|------------|-------|
| Production | `https://yourapp.com` |
| Local (web) | `http://localhost:3002` |
| Local (device) | `http://<LAN-IP>:<port>` |
| Tunnel (ngrok) | `https://*.ngrok-free.app` |

---

## Enforcement Rules

- Client code must **never** reference server-only variables
- Secrets must **never** appear in Expo or Next public envs
- `SUPABASE_SERVICE_ROLE_KEY` must never exist in `app/mobile`
- New env vars require updating this document