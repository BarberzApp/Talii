import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'
import { getStripe, getSupabaseAdmin } from '../clients'
import { ApiError } from '../errors'
import { callStripe, isStripeError } from '../stripe/errors'
import { refundPaymentIntentInFull } from '../stripe/refunds'
import type { BookingRow } from './create'
import { feeRefundDue, type CancelledBy } from './policy'

export type BookingAction =
  | { action: 'cancel'; reason?: string }
  | { action: 'complete' }
  | { action: 'no_show' }

export interface BookingActionResult {
  booking: BookingRow
  refund: { id: string; amountCents: number; status: string } | null
}

/**
 * Applies a client or barber action to a booking.
 *
 * cancel   client or owning barber; booking pending or confirmed and not yet
 *          started. A paid fee is refunded per `feeRefundDue` (policy.ts). An
 *          unpaid hold's PaymentIntent is cancelled so it cannot be paid
 *          afterwards; if it turns out to have been paid already, the booking
 *          is treated as paid.
 * complete owning barber only; booking confirmed and its start time passed.
 * no_show  same rules as complete.
 */
export async function applyBookingAction(
  callerId: string,
  bookingId: string,
  action: BookingAction,
  now: Date = new Date()
): Promise<BookingActionResult> {
  const db = getSupabaseAdmin()

  const { data: booking, error } = await db.from('bookings').select('*').eq('id', bookingId).maybeSingle()
  if (error) throw error

  const { data: callerBarber, error: barberError } = await db
    .from('barbers')
    .select('id')
    .eq('user_id', callerId)
    .maybeSingle()
  if (barberError) throw barberError

  const isOwningBarber = !!booking && !!callerBarber && callerBarber.id === booking.barber_id
  const isClient = !!booking && booking.client_id === callerId
  if (!booking || (!isOwningBarber && !isClient)) {
    throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.')
  }

  if (action.action === 'cancel') {
    return cancelBooking(booking, isOwningBarber ? 'barber' : 'client', action.reason, now)
  }

  if (!isOwningBarber) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the barber can update this booking.')
  }
  if (booking.status !== 'confirmed') {
    throw new ApiError(409, 'INVALID_STATUS', `A ${booking.status} booking cannot be marked ${label(action.action)}.`)
  }
  if (Date.parse(booking.starts_at) > now.getTime()) {
    throw new ApiError(409, 'TOO_EARLY', 'This appointment has not started yet.')
  }

  const { data: updated, error: updateError } = await db
    .from('bookings')
    .update({ status: action.action === 'complete' ? 'completed' : 'no_show' })
    .eq('id', booking.id)
    .eq('status', 'confirmed')
    .select('*')
    .maybeSingle()
  if (updateError) throw updateError
  if (!updated) throw new ApiError(409, 'BOOKING_CHANGED', 'This booking changed. Refresh and try again.')
  return { booking: updated, refund: null }
}

function label(action: 'complete' | 'no_show'): string {
  return action === 'complete' ? 'completed' : 'a no-show'
}

const MAX_CANCEL_ATTEMPTS = 3

function isPaid(booking: BookingRow): boolean {
  return (
    !!booking.payment_intent_id &&
    (booking.payment_status === 'succeeded' || booking.payment_status === 'partially_refunded')
  )
}

/**
 * Stops an unpaid hold's PaymentIntent. Returns true when it could not be
 * cancelled because it had already succeeded (the webhook may not have run
 * yet), i.e. the booking is in fact paid.
 */
async function stopUnpaidIntent(paymentIntentId: string): Promise<boolean> {
  const stripe = getStripe()
  try {
    await stripe.paymentIntents.cancel(paymentIntentId)
    return false
  } catch (cancelError) {
    if (!isStripeError(cancelError)) throw cancelError
  }
  const intent = await callStripe('paymentIntents.retrieve', () => stripe.paymentIntents.retrieve(paymentIntentId))
  if (intent.status === 'succeeded') return true
  if (intent.status !== 'canceled') {
    // e.g. processing: if it later succeeds, the webhook refunds it (booking cancelled).
    Sentry.captureMessage(`PaymentIntent ${paymentIntentId} could not be cancelled (status ${intent.status})`, {
      level: 'warning',
    })
  }
  return false
}

/**
 * Cancels a booking. Every write is conditional on the status and
 * payment_status this request read; if the webhook changed the row meanwhile
 * (for example confirmed the payment), the row is re-read and the decision is
 * made again. A refund issued in an earlier pass is kept, never repeated.
 */
async function cancelBooking(
  initial: BookingRow,
  cancelledBy: CancelledBy,
  reason: string | undefined,
  now: Date
): Promise<BookingActionResult> {
  const db = getSupabaseAdmin()
  let booking = initial
  let refund: Stripe.Refund | null = null
  let refundSettled = false // a full refund was issued, or found already complete, in this request

  for (let attempt = 0; attempt < MAX_CANCEL_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const { data: fresh, error } = await db.from('bookings').select('*').eq('id', booking.id).maybeSingle()
      if (error) throw error
      if (!fresh) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.')
      booking = fresh
    }

    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      if (refundSettled) alertRefundWithoutCancel(booking.id)
      throw new ApiError(409, 'BOOKING_NOT_CANCELLABLE', `A ${booking.status} booking cannot be cancelled.`)
    }
    if (Date.parse(booking.starts_at) <= now.getTime()) {
      if (refundSettled) alertRefundWithoutCancel(booking.id)
      throw new ApiError(
        409,
        'TOO_LATE_TO_CANCEL',
        'This appointment has already started. The barber can mark it completed or a no-show.'
      )
    }

    let paid = isPaid(booking)
    if (!paid && booking.status === 'pending' && booking.payment_intent_id && booking.payment_status === 'pending') {
      paid = await stopUnpaidIntent(booking.payment_intent_id)
    }

    let paymentStatus = booking.payment_status
    if (paid) {
      if (!refundSettled && feeRefundDue(cancelledBy, booking.starts_at, now)) {
        const paymentIntentId = booking.payment_intent_id as string
        const result = await callStripe('refunds.create', () =>
          refundPaymentIntentInFull(db, {
            bookingId: booking.id,
            paymentIntentId,
            idempotencyKey: `booking-${booking.id}-cancel-refund`,
            reason: `cancelled_by_${cancelledBy}`,
          })
        )
        refund = result.refund
        refundSettled = result.alreadyRefunded || (refund?.status !== 'failed' && refund?.status !== 'canceled')
      }
      if (refundSettled) paymentStatus = 'refunded'
      else if (paymentStatus === 'pending') paymentStatus = 'succeeded' // paid; webhook not processed yet
    }

    const { data: updated, error } = await db
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: now.toISOString(),
        cancellation_reason: `cancelled_by_${cancelledBy}${reason ? `: ${reason}` : ''}`,
        hold_expires_at: null,
        payment_status: paymentStatus,
      })
      .eq('id', booking.id)
      .eq('status', booking.status)
      .eq('payment_status', booking.payment_status)
      .select('*')
      .maybeSingle()
    if (error) throw error

    if (updated) {
      return {
        booking: updated,
        refund: refund ? { id: refund.id, amountCents: refund.amount, status: refund.status ?? 'pending' } : null,
      }
    }
  }

  if (refundSettled) alertRefundWithoutCancel(booking.id)
  throw new ApiError(409, 'BOOKING_CHANGED', 'This booking changed. Refresh and try again.')
}

function alertRefundWithoutCancel(bookingId: string): void {
  Sentry.captureMessage('Refund issued but the booking could not be cancelled', {
    level: 'error',
    tags: { booking_id: bookingId },
  })
}
