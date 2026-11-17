// Stripe Connect onboarding for the calling barber.
//
// Still called by the mobile app (BarberOnboardingPage, barberStripeHelper) until
// Phase 4 moves it to the Next.js API. Security rules:
// - The caller's Supabase JWT is verified with auth.getUser (the platform's
//   verify_jwt only checks the signature, and the anon key passes that).
// - The barber row is resolved from the authenticated user id. Any barberId or
//   email in the body is ignored.
// - An existing Stripe account is never adopted by matching an email, and the
//   account status is never set to active/ready here; the account.updated webhook
//   and /api/connect/refresh-account-status derive it from Stripe.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const APP_URL = Deno.env.get('APP_URL') || 'https://www.bocmstyle.com'
const RETURN_URL = `${APP_URL}/barber/connect/return`
const REFRESH_URL = `${APP_URL}/barber/connect/refresh`

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!stripeKey || !supabaseUrl || !serviceKey) {
      console.error('stripe-connect: missing environment configuration')
      return json({ error: 'Server not configured' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 1) Authenticate the caller.
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    const user = userData?.user
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }
    if (!user.email) {
      return json({ error: 'Your account has no email address' }, 400)
    }

    // 2) Resolve the caller's own barber row.
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('id, stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (barberError) {
      console.error('stripe-connect: barber lookup failed', barberError.message)
      return json({ error: 'Failed to load barber' }, 500)
    }
    if (!barber) {
      return json({ error: 'Barber not found' }, 404)
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-05-28.basil' as any })

    // 3) Resume onboarding for the account already saved on this barber.
    if (barber.stripe_account_id) {
      try {
        const existing = await stripe.accounts.retrieve(barber.stripe_account_id)
        const link = await stripe.accountLinks.create({
          account: existing.id,
          refresh_url: REFRESH_URL,
          return_url: RETURN_URL,
          type: 'account_onboarding',
        })
        return json({ url: link.url, accountId: existing.id, existing: true })
      } catch (_err) {
        console.log('stripe-connect: saved account invalid, creating a new one')
      }
    }

    // 4) Create a new Express account. The idempotency key makes retries and
    //    double taps return the same account instead of creating another.
    const account = await stripe.accounts.create(
      {
        type: 'express',
        email: user.email,
        business_profile: { url: `${APP_URL}/barber/${barber.id}` },
        metadata: { barber_id: barber.id, user_id: user.id },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      },
      { idempotencyKey: `connect-account-${barber.id}-${barber.stripe_account_id ?? 'none'}` }
    )

    const { error: updateError } = await supabase
      .from('barbers')
      .update({
        stripe_account_id: account.id,
        stripe_account_status: 'pending',
        stripe_account_ready: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barber.id)
    if (updateError) {
      // Keep the Stripe account: a retry with the same idempotency key returns it.
      console.error('stripe-connect: failed to save account id', updateError.message)
      return json({ error: 'Failed to update barber record' }, 500)
    }

    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: REFRESH_URL,
      return_url: RETURN_URL,
      type: 'account_onboarding',
    })

    return json({ url: link.url, accountId: account.id })
  } catch (error) {
    console.error('stripe-connect: unexpected error', error instanceof Error ? error.message : error)
    return json({ error: 'Stripe connect function failed' }, 500)
  }
})
