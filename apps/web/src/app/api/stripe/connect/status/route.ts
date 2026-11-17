import { defineRoute } from '@/server/route'
import { refreshStatus } from '@/server/stripe/connect'

/**
 * GET /api/stripe/connect/status   (barber)
 * Reads the caller's account from Stripe and stores the flags.
 * 200 { hasAccount, chargesEnabled, payoutsEnabled, detailsSubmitted, feeExempt }
 * Errors: 403 ACCOUNT_MISMATCH, 502 STRIPE_ERROR
 */
export const GET = defineRoute({ auth: 'barber' }, async ({ barber }) => refreshStatus(barber.id))
