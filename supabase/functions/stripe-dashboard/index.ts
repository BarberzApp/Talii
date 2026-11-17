// Stripe Express dashboard link (or onboarding link if setup is incomplete) for
// the calling barber.
//
// Still called by the mobile app (EarningsDashboard) until Phase 4 moves it to the
// Next.js API. The caller's JWT is verified with auth.getUser and the barber row is
// resolved from the authenticated user id; any barberId in the body is ignored.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

const APP_URL = Deno.env.get('APP_URL') || 'https://www.bocmstyle.com'

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
      console.error('stripe-dashboard: missing environment configuration')
      return json({ error: 'Server not configured' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

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

    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('id, stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (barberError) {
      console.error('stripe-dashboard: barber lookup failed', barberError.message)
      return json({ error: 'Failed to load barber' }, 500)
    }
    if (!barber) {
      return json({ error: 'Barber not found' }, 404)
    }
    if (!barber.stripe_account_id) {
      return json({ error: 'No Stripe account found for this barber' }, 400)
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-05-28.basil' as any })

    try {
      const loginLink = await stripe.accounts.createLoginLink(barber.stripe_account_id)
      return json({ url: loginLink.url, accountId: barber.stripe_account_id, type: 'dashboard' })
    } catch (dashboardError: any) {
      // Login links fail until onboarding is complete; send an onboarding link instead.
      if (typeof dashboardError?.message === 'string' && dashboardError.message.includes('onboarding')) {
        const accountLink = await stripe.accountLinks.create({
          account: barber.stripe_account_id,
          refresh_url: `${APP_URL}/barber/connect/refresh`,
          return_url: `${APP_URL}/barber/connect/return`,
          type: 'account_onboarding',
        })
        return json({
          url: accountLink.url,
          accountId: barber.stripe_account_id,
          type: 'onboarding',
          message: 'Please complete your Stripe account setup to access the dashboard',
        })
      }
      console.error('stripe-dashboard: failed to create login link', dashboardError?.message)
      return json({ error: 'Failed to create dashboard link' }, 500)
    }
  } catch (error) {
    console.error('stripe-dashboard: unexpected error', error instanceof Error ? error.message : error)
    return json({ error: 'Stripe dashboard function failed' }, 500)
  }
})
