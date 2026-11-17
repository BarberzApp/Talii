import 'server-only'
import type Stripe from 'stripe'
import type { Db } from './clients'

/**
 * Writes to `payments`. One row per Stripe object, keyed by `stripe_object_id`:
 * charges use the PaymentIntent id (pi_...), refunds the refund id (re_...).
 */

/** Records the charge for a succeeded PaymentIntent. A repeat is a no-op. */
export async function recordCharge(db: Db, bookingId: string, pi: Stripe.PaymentIntent): Promise<void> {
  const { error } = await db.from('payments').upsert(
    {
      booking_id: bookingId,
      type: 'charge',
      stripe_object_id: pi.id,
      payment_intent_id: pi.id,
      amount_cents: pi.amount_received || pi.amount,
      application_fee_cents: pi.application_fee_amount ?? 0,
      currency: pi.currency,
      status: 'succeeded',
    },
    { onConflict: 'stripe_object_id', ignoreDuplicates: true }
  )
  if (error) throw error
}

/**
 * Records one Stripe refund, or updates its status if already recorded.
 * `amount_cents` is this refund's own amount, never the charge's running
 * `amount_refunded` total.
 */
export async function recordRefund(db: Db, bookingId: string, refund: Stripe.Refund): Promise<void> {
  const { error } = await db.from('payments').upsert(
    {
      booking_id: bookingId,
      type: 'refund',
      stripe_object_id: refund.id,
      payment_intent_id: stripeId(refund.payment_intent),
      amount_cents: refund.amount,
      currency: refund.currency,
      status: refund.status ?? 'pending',
    },
    { onConflict: 'stripe_object_id' }
  )
  if (error) throw error
}

/** Booking payment status implied by a charge's refund state, or null if nothing is refunded. */
export function paymentStatusFromCharge(charge: Pick<Stripe.Charge, 'refunded' | 'amount_refunded'>) {
  if (charge.refunded) return 'refunded' as const
  if (charge.amount_refunded > 0) return 'partially_refunded' as const
  return null
}

/** The id of an expandable Stripe field. */
export function stripeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}
