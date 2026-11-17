import { handleStripeWebhook } from '@/server/stripe/webhook'

/**
 * POST /api/webhooks/stripe   (Stripe only; authenticated by the Stripe-Signature header)
 *
 * Events used: payment_intent.succeeded, payment_intent.payment_failed,
 * payment_intent.canceled, charge.refunded, refund.created/updated/failed,
 * charge.refund.updated, account.updated, account.application.deauthorized.
 * See src/server/stripe/webhook.ts.
 */
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  return handleStripeWebhook(req)
}
