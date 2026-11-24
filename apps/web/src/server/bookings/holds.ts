import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getStripe, type Db } from '../clients'

/**
 * Cancels a PaymentIntent so it can no longer be paid. Best effort: a failure
 * is reported, not thrown. If the intent had already succeeded, the webhook
 * finds its booking released and refunds it.
 */
export async function cancelPaymentIntentQuietly(paymentIntentId: string): Promise<void> {
  try {
    await getStripe().paymentIntents.cancel(paymentIntentId)
  } catch (error) {
    Sentry.captureException(error, { tags: { stripe_operation: 'paymentIntents.cancel' } })
  }
}

/**
 * Releases this barber's expired holds (same rule as create_booking_hold's own
 * cleanup, which stays as a safety net) and cancels their PaymentIntents so a
 * late payment is not possible. Returns the number released.
 */
export async function releaseExpiredHolds(db: Db, barberId: string, now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString()
  const { data, error } = await db
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: nowIso, cancellation_reason: 'hold_expired', hold_expires_at: null })
    .eq('barber_id', barberId)
    .eq('status', 'pending')
    .lt('hold_expires_at', nowIso)
    .select('id, payment_intent_id')
  if (error) throw error

  for (const row of data ?? []) {
    if (row.payment_intent_id) await cancelPaymentIntentQuietly(row.payment_intent_id)
  }
  return data?.length ?? 0
}
