import { defineRoute } from '@/server/route'
import { startOnboarding } from '@/server/stripe/connect'

/**
 * POST /api/stripe/connect/onboarding   (barber)
 * Creates the caller's Express account if needed (or reuses the stored one after
 * checking metadata.barber_id) and returns a Stripe onboarding link.
 * Body: none. 200 { url, type: "onboarding" }
 * Errors: 403 ACCOUNT_MISMATCH, 502 STRIPE_ERROR
 */
export const POST = defineRoute({ auth: 'barber' }, async ({ barber, user }) => startOnboarding(barber.id, user))
