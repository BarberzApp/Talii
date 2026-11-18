# Local Development & Setup

Follow these steps to set up a local development environment for the Talii monorepo.

---

## 1. Local Monorepo Setup

The monorepo relies on npm workspaces. Run commands in the workspace using the `-w` flag rather than changing directories manually.

### Initial Setup

```bash
# Clone the repository and install all dependencies
npm install

# Build the shared packages
npm run build -w packages/shared
```

### Starting Development Servers

```bash
# Launch the Next.js API Gateway and Web Application (Port 3002)
npm run dev

# Launch the Expo Mobile Server
npm -w apps/mobile start
```

---

## 2. Setting Up Local Stripe Integrations

Because booking fulfillment requires a Stripe webhook response, you must tunnel Stripe webhook callbacks back to your local development machine.

### Step 1: Install the Stripe CLI
Install the Stripe CLI via homebrew (macOS) or download the binary:
```bash
brew install stripe/stripe-cli/stripe
```

### Step 2: Log in to Stripe
```bash
stripe login
```

### Step 3: Listen for Webhook Events
Tunnel Stripe events to the Next.js gateway webhook handler on port **3002**:
```bash
stripe listen --forward-to localhost:3002/api/webhooks/stripe
```
*This command will output a webhook signature secret starting with `whsec_...`. Copy this value.*

### Step 4: Configure Local Secrets
Paste the copied webhook signing secret into `apps/web/.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_your_copied_secret
```

---

## 3. Database Type Generation

When database schemas change in Supabase, sync local TypeScript types:

```bash
# Generate types from a remote Supabase instance
SUPABASE_PROJECT_REF=your-project-ref npm run types:generate
```

---

## 4. Making an Account Admin

Admin is `app_metadata.role = 'admin'` on the auth user (server-controlled; profile columns and `user_metadata` are ignored). `scripts/set-admin.ts` sets it by email. It reads the project URL and service-role key from the environment only; nothing is stored in the script.

```bash
# Local stack (the seed already makes admin@example.com an admin)
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local service_role key from `supabase status`> \
  npx tsx scripts/set-admin.ts you@example.com

# Another environment: point the variables at that project. Any non-local host needs --yes.
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<that project's key> \
  npx tsx scripts/set-admin.ts owner@yourdomain.com --yes

# Or load the variables from an env file you choose
npx tsx --env-file=path/to/env-file scripts/set-admin.ts owner@yourdomain.com --yes

# Remove admin again
npx tsx scripts/set-admin.ts owner@yourdomain.com --remove --yes
```

`SUPABASE_URL` falls back to `NEXT_PUBLIC_SUPABASE_URL`. The API (`/api/admin/*`, `GET /api/me` → `isAdmin`) sees the change immediately; database policies that use `is_admin()` see it after the user's access token refreshes (sign out and back in).

---

## 5. Troubleshooting Local Setup

* **API Connection Failures on Device**: If testing on a physical mobile device, the device cannot reach `localhost`. Replace `EXPO_PUBLIC_API_URL` with your local LAN IP (e.g., `http://192.168.1.50:3002`).
* **Stripe Connect URL Mismatches**: Local sandbox accounts require standard redirect pages. Ensure your test barber email has completed the Stripe Express workflow using the provided test banking numbers.

---

## Related Documentation

- **[Documentation Index](../DOC_INDEX.md)**: Web application documentation overview.
- **[Database Schema](../database/SCHEMA.md)**: Structure of the database profiles and tables.
- **[RLS Policies](../database/SCHEMA.md)**: Supabase Row Level Security policy documentation.
- **[Root README](../../README.md)**: Monorepo system overview.
