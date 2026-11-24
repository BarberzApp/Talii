import { defineRoute } from '@/server/route'
import { dashboardLink } from '@/server/stripe/connect'

/**
 * POST /api/stripe/connect/dashboard   (barber)
 * Express dashboard login link once details are submitted; otherwise an
 * onboarding link (creating the account if there is none).
 * Body: none. 200 { url, type: "dashboard" | "onboarding" }
 * Errors: 403 ACCOUNT_MISMATCH, 502 STRIPE_ERROR
 */
export const POST = defineRoute({ auth: 'barber' }, async ({ barber, user }) => dashboardLink(barber.id, user))
