import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { ApiAuthError, getCallerBarber, validateBearerToken } from '@/shared/lib/api-auth'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
})

/**
 * Re-reads the caller's own Stripe Connect account and stores its status.
 * Auth: Bearer token. Body `{ userId }` is accepted for compatibility but must equal
 * the token's user id.
 */
export async function POST(request: Request) {
  try {
    const user = await validateBearerToken(request)

    const body = (await request.json().catch(() => ({}))) as { userId?: unknown }
    if (body.userId !== undefined && body.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let barber: { id: string; stripe_account_id: string | null; stripe_account_status: string | null }
    try {
      barber = await getCallerBarber(user.id, 'id, stripe_account_id, stripe_account_status')
    } catch (err) {
      if (err instanceof ApiAuthError) {
        return NextResponse.json({ error: 'Barber record not found' }, { status: 404 })
      }
      throw err
    }

    if (!barber.stripe_account_id) {
      return NextResponse.json({
        success: false,
        message: 'No Stripe account found',
        data: {
          hasStripeAccount: false,
          status: null
        }
      })
    }

    // Check current status with Stripe
    try {
      const stripeAccount = await stripe.accounts.retrieve(barber.stripe_account_id)
      
      const newStatus = stripeAccount.charges_enabled ? 'active' : 'pending'
      const accountReady = Boolean(stripeAccount.charges_enabled && stripeAccount.details_submitted)

      // Always write both fields: status can stay 'pending' while readiness changes.
      const { error: updateError } = await supabaseAdmin
        .from('barbers')
        .update({
          stripe_account_status: newStatus,
          stripe_account_ready: accountReady,
          updated_at: new Date().toISOString(),
        })
        .eq('id', barber.id)

      if (updateError) {
        logger.error('Error updating account status', updateError)
      }

      return NextResponse.json({
        success: true,
        message: 'Account status refreshed',
        data: {
          hasStripeAccount: true,
          stripeAccountId: barber.stripe_account_id,
          previousStatus: barber.stripe_account_status,
          currentStatus: newStatus,
          chargesEnabled: stripeAccount.charges_enabled,
          detailsSubmitted: stripeAccount.details_submitted,
          payoutsEnabled: stripeAccount.payouts_enabled,
          accountReady
        }
      })

    } catch (stripeError: any) {
      logger.error('Error retrieving Stripe account', stripeError)
      
      // Specifically handle the "key does not have access to account" error
      // This happens when the account was deleted in Stripe or keys were swapped (Test/Live)
      const isMissingAccount = 
        stripeError.type === 'StripeInvalidRequestError' && 
        (stripeError.message?.includes('does not have access to account') || 
         stripeError.message?.includes('No such account') ||
         stripeError.code === 'resource_missing');

      if (isMissingAccount) {
        logger.warn('Stripe account invalid or missing, marking for re-connect', { 
          stripeAccountId: barber.stripe_account_id,
          error: stripeError.message
        })

        return NextResponse.json({
          success: false,
          message: 'Stripe account invalid or access revoked',
          data: {
            hasStripeAccount: false,
            needsReconnect: true,
            error: stripeError.message
          }
        })
      }

      return NextResponse.json(
        { error: 'Failed to retrieve Stripe account status' },
        { status: 500 }
      )
    }

  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    logger.error('Error refreshing account status', error)
    return NextResponse.json(
      { error: 'Failed to refresh account status' },
      { status: 500 }
    )
  }
} 