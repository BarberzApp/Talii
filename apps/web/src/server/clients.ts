import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import type { Database } from '@barber-app/shared'
import { getServerEnv } from './env'

/**
 * The Stripe API version every request uses. Pinned so a library upgrade never
 * silently changes webhook payloads or response shapes. It must equal the
 * installed library's `Stripe.LatestApiVersion`; when upgrading `stripe`, update
 * this constant (and the webhook endpoint's version in the Stripe dashboard).
 */
export const STRIPE_API_VERSION = '2025-08-27.basil' satisfies Stripe.LatestApiVersion

export type Db = SupabaseClient<Database>

let supabaseAdmin: Db | undefined
let stripe: Stripe | undefined

/**
 * Service-role Supabase client. Bypasses row-level security: every caller is
 * responsible for checking ownership before reading or writing.
 */
export function getSupabaseAdmin(): Db {
  if (!supabaseAdmin) {
    const env = getServerEnv()
    supabaseAdmin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'x-application-name': 'talii-api' } },
    })
  }
  return supabaseAdmin
}

export function getStripe(): Stripe {
  if (!stripe) {
    const env = getServerEnv()
    stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      appInfo: { name: 'talii-api' },
      maxNetworkRetries: 2,
      typescript: true,
    })
  }
  return stripe
}
