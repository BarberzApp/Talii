import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'
import { getStripe, type Db } from '../clients'
import { recordRefund } from '../payments'
import { isStripeError } from './errors'

export interface FullRefundResult {
  /** The refund created now, or null when the payment was already fully refunded. */
  refund: Stripe.Refund | null
  alreadyRefunded: boolean
}

/**
 * Refunds whatever is left of a PaymentIntent's charge, reversing the
 * barber's transfer and the platform fee proportionally.
 *
 * Safe to repeat, also after Stripe's 24-hour idempotency window:
 * - if `payments` already records refunds covering the whole charge, nothing is sent;
 * - Stripe's `charge_already_refunded` counts as done, not as an error.
 * Other Stripe errors are thrown (wrap with callStripe for a 502).
 * A refund that comes back failed or canceled is recorded and alerted.
 */
export async function refundPaymentIntentInFull(
  db: Db,
  args: { bookingId: string; paymentIntentId: string; idempotencyKey: string; reason: string }
): Promise<FullRefundResult> {
  const { data: rows, error } = await db
    .from('payments')
    .select('type, amount_cents, status')
    .eq('payment_intent_id', args.paymentIntentId)
  if (error) throw error

  const charge = (rows ?? []).find((r) => r.type === 'charge' && r.status === 'succeeded')
  const refunded = (rows ?? [])
    .filter((r) => r.type === 'refund' && (r.status === 'succeeded' || r.status === 'pending'))
    .reduce((sum, r) => sum + r.amount_cents, 0)
  if (charge && refunded >= charge.amount_cents) return { refund: null, alreadyRefunded: true }

  let refund: Stripe.Refund
  try {
    refund = await getStripe().refunds.create(
      {
        payment_intent: args.paymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: { bookingId: args.bookingId, reason: args.reason },
      },
      { idempotencyKey: args.idempotencyKey }
    )
  } catch (err) {
    if (isStripeError(err) && err.code === 'charge_already_refunded') return { refund: null, alreadyRefunded: true }
    throw err
  }

  await recordRefund(db, args.bookingId, refund)
  if (refund.status === 'failed' || refund.status === 'canceled') {
    Sentry.captureMessage(`Refund ${refund.id} for booking ${args.bookingId} ended ${refund.status}`, {
      level: 'error',
      tags: { booking_id: args.bookingId },
    })
  }
  return { refund, alreadyRefunded: false }
}
