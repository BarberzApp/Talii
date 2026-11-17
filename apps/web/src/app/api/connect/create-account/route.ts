import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { handleCorsPreflight, withCors } from '@/shared/lib/cors'
import { ApiAuthError, getCallerBarber, validateBearerToken } from '@/shared/lib/api-auth'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  return process.env.NODE_ENV === 'production'
    ? 'https://bocmstyle.com'
    : 'http://localhost:3002'
}

const APP_URL = getBaseUrl()

// Web URLs that redirect to mobile deep links
const RETURN_URL = `${APP_URL}/barber/connect/return`
const REFRESH_URL = `${APP_URL}/barber/connect/refresh`

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
})

type CallerBarber = {
  id: string
  stripe_account_id: string | null
}

async function syncAccountStatus(barberId: string, stripeAccountId: string) {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId)
    const { error } = await supabaseAdmin
      .from('barbers')
      .update({
        stripe_account_status: account.charges_enabled ? 'active' : 'pending',
        stripe_account_ready: Boolean(account.charges_enabled && account.details_submitted),
        updated_at: new Date().toISOString(),
      })
      .eq('id', barberId)
    if (error) logger.error('Error updating account status', error)
  } catch (error) {
    logger.error('Error checking Stripe account status', error)
  }
}

function json(request: NextRequest, body: unknown, status = 200) {
  return withCors(request, NextResponse.json(body, { status }))
}

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request) ?? new NextResponse(null, { status: 204 })
}

/**
 * Creates (or resumes) Stripe Connect Express onboarding for the caller's own barber.
 * Auth: Bearer token; the barber is resolved from the token's user id.
 * Body: { barberId?, email? } kept for compatibility. A barberId that is not the
 * caller's is rejected; the email defaults to the authenticated user's email.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await validateBearerToken(request)
    const barber = await getCallerBarber<CallerBarber>(user.id, 'id, stripe_account_id')

    const body = (await request.json().catch(() => ({}))) as { barberId?: unknown; email?: unknown }
    if (body.barberId !== undefined && body.barberId !== barber.id) {
      return json(request, { error: 'Forbidden' }, 403)
    }

    const email =
      user.email ||
      (typeof body.email === 'string' && body.email.includes('@') ? body.email : undefined)
    if (!email) {
      return json(request, { error: 'Valid email is required' }, 400)
    }

    // Resume onboarding for an account we already saved for this barber.
    if (barber.stripe_account_id) {
      try {
        const existingAccount = await stripe.accounts.retrieve(barber.stripe_account_id)
        await syncAccountStatus(barber.id, existingAccount.id)

        const accountLink = await stripe.accountLinks.create({
          account: existingAccount.id,
          refresh_url: REFRESH_URL,
          return_url: RETURN_URL,
          type: 'account_onboarding',
        })

        return json(request, { url: accountLink.url, accountId: existingAccount.id, existing: true })
      } catch {
        logger.debug('Saved Stripe account not found or invalid, creating a new one')
      }
    }

    // The idempotency key ties account creation to this barber (and to the account
    // being replaced, if any), so a retry or double-click returns the same account
    // instead of creating a second one.
    const idempotencyKey = `connect-account-${barber.id}-${barber.stripe_account_id ?? 'none'}`
    const account = await stripe.accounts.create(
      {
        type: 'express',
        email,
        business_profile: {
          url: `${APP_URL}/barber/${barber.id}`,
        },
        metadata: {
          barber_id: barber.id,
          user_id: user.id,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      },
      { idempotencyKey }
    )

    const { error: updateError } = await supabaseAdmin
      .from('barbers')
      .update({
        stripe_account_id: account.id,
        stripe_account_status: 'pending',
        stripe_account_ready: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barber.id)

    if (updateError) {
      // Do not delete the Stripe account: a retry with the same idempotency key
      // returns it and we try saving again.
      logger.error('Error saving Stripe account id to barber', updateError)
      return json(request, { error: 'Failed to update barber record' }, 500)
    }

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: REFRESH_URL,
      return_url: RETURN_URL,
      type: 'account_onboarding',
    })

    return json(request, { url: accountLink.url, accountId: account.id })
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return json(request, { error: error.message }, error.status)
    }
    logger.error('Error creating Stripe Connect account', error)
    return json(request, { error: 'Failed to create Stripe account' }, 500)
  }
}
