import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { logger } from '@/shared/lib/logger'
import { ApiAuthError, getCallerBarber, validateBearerToken } from '@/shared/lib/api-auth'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
})

/**
 * Returns a Stripe Express dashboard login link for the caller's own barber.
 * Auth: Bearer token. Body `{ barberId }` is accepted for compatibility but must be
 * the caller's own barber id.
 */
export async function POST(request: Request) {
  try {
    const user = await validateBearerToken(request)
    const barber = await getCallerBarber<{ id: string; stripe_account_id: string | null }>(
      user.id,
      'id, stripe_account_id'
    )

    const body = (await request.json().catch(() => ({}))) as { barberId?: unknown }
    if (body.barberId !== undefined && body.barberId !== barber.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!barber.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe account found' }, { status: 400 })
    }

    const loginLink = await stripe.accounts.createLoginLink(barber.stripe_account_id)
    if (!loginLink.url) {
      return NextResponse.json({ error: 'Failed to generate dashboard link' }, { status: 500 })
    }

    return NextResponse.json({ url: loginLink.url })
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error('Error creating dashboard link', error)
    return NextResponse.json({ error: 'Failed to create dashboard link' }, { status: 500 })
  }
}
