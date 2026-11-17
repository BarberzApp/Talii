import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'
import { findSlot, localDateInTimeZone, parseBookingPaymentMetadata, type Json } from '@barber-app/shared'
import { getStripe, getSupabaseAdmin, type Db } from '../clients'
import { getServerEnv } from '../env'
import { errorResponse, INTERNAL_ERROR_MESSAGE, PG, pgCode } from '../errors'
import { paymentStatusFromCharge, recordCharge, recordRefund, stripeId } from '../payments'
import type { BookingRow } from '../bookings/create'
import { computeDaySlots, loadBarberForBooking } from '../bookings/availability'
import { HOLD_GRACE_MINUTES } from '../bookings/policy'
import { isAccountGoneError } from './connect'
import { refundPaymentIntentInFull } from './refunds'

/**
 * POST /api/webhooks/stripe
 *
 * 1. Verify the signature on the raw body (400 if it fails).
 * 2. Insert the event into stripe_events. If the id is already there and was
 *    processed, return 200 (duplicate delivery). If it is there but not
 *    processed (an earlier attempt failed transiently), process it again; all
 *    handlers are idempotent.
 * 3. Apply the event, then set processed_at (and error, when a paid event could
 *    not be applied: that also goes to Sentry).
 *
 * Status codes: 200 for everything handled or deliberately ignored (events that
 * are not ours, types we do not use). 500 only for transient failures
 * (database or Stripe unavailable) so Stripe retries; processed_at stays null.
 */
export async function handleStripeWebhook(req: Request): Promise<Response> {
  let event: Stripe.Event
  let rawBody: string
  try {
    const signature = req.headers.get('stripe-signature')
    rawBody = await req.text()
    if (!signature) return errorResponse(400, 'INVALID_SIGNATURE', 'Missing Stripe signature.')
    const verified = verifyEvent(rawBody, signature)
    if (!verified) return errorResponse(400, 'INVALID_SIGNATURE', 'Invalid Stripe signature.')
    event = verified
  } catch (error) {
    Sentry.captureException(error, { tags: { webhook: 'stripe' } })
    return errorResponse(500, 'INTERNAL', INTERNAL_ERROR_MESSAGE)
  }

  const db = getSupabaseAdmin()
  try {
    const fresh = await recordEvent(db, event, rawBody)
    if (!fresh) return Response.json({ received: true, duplicate: true })

    const outcome = await dispatch(db, event)

    const { error } = await db
      .from('stripe_events')
      .update({ processed_at: new Date().toISOString(), error: outcome.error ?? null })
      .eq('id', event.id)
    if (error) throw error

    return Response.json({ received: true, ...(outcome.ignored ? { ignored: true } : {}) })
  } catch (error) {
    Sentry.captureException(error, { tags: { webhook_event: event.id, webhook_event_type: event.type } })
    try {
      await db
        .from('stripe_events')
        .update({ error: `transient failure, awaiting retry: ${describe(error)}` })
        .eq('id', event.id)
    } catch {
      // The database may be what failed; Stripe will retry.
    }
    return errorResponse(500, 'WEBHOOK_RETRY', 'Temporary failure; please retry.')
  }
}

function verifyEvent(rawBody: string, signature: string): Stripe.Event | null {
  const env = getServerEnv()
  const stripe = getStripe()
  const secrets = [env.STRIPE_WEBHOOK_SECRET, env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (s): s is string => !!s
  )
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, secret)
    } catch {
      // try the next secret
    }
  }
  return null
}

/** Inserts the event row. Returns false when it was already processed. */
async function recordEvent(db: Db, event: Stripe.Event, rawBody: string): Promise<boolean> {
  const { error } = await db
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, payload: JSON.parse(rawBody) as Json })
  if (!error) return true
  if (pgCode(error) !== PG.uniqueViolation) throw error

  const { data: existing, error: readError } = await db
    .from('stripe_events')
    .select('processed_at')
    .eq('id', event.id)
    .maybeSingle()
  if (readError) throw readError
  return !existing?.processed_at
}

interface Outcome {
  /** Durable note stored on stripe_events.error (a paid event that could not be applied). */
  error?: string
  /** Not ours, or nothing to do. */
  ignored?: boolean
}

/** Payment and refund events we act on only when they happen on the platform account. */
const PLATFORM_ONLY_PREFIXES = ['payment_intent.', 'charge.', 'refund.']

async function dispatch(db: Db, event: Stripe.Event): Promise<Outcome> {
  // Our booking fees are destination charges on the platform account. The same
  // event types from a connected account (event.account set) are not ours.
  if (event.account && PLATFORM_ONLY_PREFIXES.some((p) => event.type.startsWith(p))) {
    return { ignored: true }
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      return onPaymentSucceeded(db, event, event.data.object)
    case 'payment_intent.payment_failed':
      // Sent for every failed attempt; the intent stays payable and the client
      // may retry with another card. The hold's expiry or the client's cancel
      // governs the slot, so nothing changes here (the event row is the record).
      return {}
    case 'payment_intent.canceled':
      return onPaymentCanceled(db, event.data.object)
    case 'charge.refunded':
      return onChargeRefunded(db, event, event.data.object)
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed':
    case 'charge.refund.updated':
      return onRefundChanged(db, event, event.data.object)
    case 'account.updated':
      return onAccountUpdated(db, event, event.data.object)
    case 'account.application.deauthorized':
      return onAccountDeauthorized(db, event)
    default:
      return { ignored: true }
  }
}

// ---------------------------------------------------------------------------
// Bookings and payments
// ---------------------------------------------------------------------------

async function bookingById(db: Db, id: string): Promise<BookingRow | null> {
  const { data, error } = await db.from('bookings').select('*').eq('id', id).maybeSingle()
  if (error) {
    // A malformed id in metadata (not a uuid) is not ours, not a transient error.
    if (pgCode(error) === '22P02') return null
    throw error
  }
  return data
}

async function bookingByPaymentIntent(db: Db, paymentIntentId: string): Promise<BookingRow | null> {
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .eq('payment_intent_id', paymentIntentId)
    .maybeSingle()
  if (error) throw error
  if (data) return data

  // A PaymentIntent we refunded without attaching it to the booking still has a charge row.
  const { data: charge, error: chargeError } = await db
    .from('payments')
    .select('booking_id')
    .eq('stripe_object_id', paymentIntentId)
    .maybeSingle()
  if (chargeError) throw chargeError
  return charge ? bookingById(db, charge.booking_id) : null
}

async function bookingForPaymentIntent(db: Db, pi: Stripe.PaymentIntent) {
  const metadataId = parseBookingPaymentMetadata(pi.metadata)
  const booking = metadataId ? await bookingById(db, metadataId) : await bookingByPaymentIntent(db, pi.id)
  return { metadataId, booking }
}

async function onPaymentSucceeded(db: Db, event: Stripe.Event, pi: Stripe.PaymentIntent): Promise<Outcome> {
  const { metadataId, booking } = await bookingForPaymentIntent(db, pi)
  if (!booking) {
    if (!metadataId) return { ignored: true } // not a booking payment
    // Ours by metadata, but the booking is gone (or from another environment
    // sharing this Stripe account). Do not refund blindly: record and alert.
    return alert(event, `PaymentIntent ${pi.id} succeeded but booking ${metadataId} does not exist; not refunded`)
  }

  if (booking.payment_intent_id && booking.payment_intent_id !== pi.id) {
    await recordCharge(db, booking.id, pi)
    return refundUnapplied(db, event, pi, booking, `booking ${booking.id} is paid by ${booking.payment_intent_id}`)
  }

  await recordCharge(db, booking.id, pi)

  if (booking.status === 'pending') {
    const problem = await latePaymentProblem(db, booking, new Date())
    if (problem) {
      const { data: released, error } = await db
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'late_payment',
          hold_expires_at: null,
        })
        .eq('id', booking.id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (released) return refundUnapplied(db, event, pi, released, `payment for booking ${booking.id} arrived late: ${problem}`)
      const fresh = await bookingById(db, booking.id)
      if (!fresh) throw new Error(`booking ${booking.id} disappeared`)
      return afterPending(db, event, pi, fresh)
    }

    const { data: confirmed, error } = await db
      .from('bookings')
      .update({ status: 'confirmed', payment_status: 'succeeded', hold_expires_at: null, payment_intent_id: pi.id })
      .eq('id', booking.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (confirmed) return {}
    // Changed underneath us (cancelled meanwhile): fall through with the fresh row.
    const fresh = await bookingById(db, booking.id)
    if (!fresh) throw new Error(`booking ${booking.id} disappeared`)
    return afterPending(db, event, pi, fresh)
  }

  return afterPending(db, event, pi, booking)
}

/**
 * For a payment on a still-pending booking: null when it can be confirmed, or
 * why not. Within the hold (plus HOLD_GRACE_MINUTES) the slot is trusted; after
 * that it is re-validated with the availability engine. A booking whose start
 * time has passed is never confirmed.
 */
async function latePaymentProblem(db: Db, booking: BookingRow, now: Date): Promise<string | null> {
  if (Date.parse(booking.starts_at) <= now.getTime()) return 'the start time had passed'
  const holdEnd = booking.hold_expires_at ? Date.parse(booking.hold_expires_at) : Number.NaN
  if (Number.isFinite(holdEnd) && holdEnd + HOLD_GRACE_MINUTES * 60_000 >= now.getTime()) return null

  const barber = await loadBarberForBooking(db, booking.barber_id)
  if (!barber || !barber.listed) return 'the barber is no longer listed'
  const durationMinutes = Math.round((Date.parse(booking.ends_at) - Date.parse(booking.starts_at)) / 60_000)
  // The booking's own hold has expired, so it does not count as busy here.
  const slots = await computeDaySlots(db, {
    barberId: barber.id,
    timeZone: barber.timezone,
    date: localDateInTimeZone(booking.starts_at, barber.timezone),
    durationMinutes,
    now,
  })
  const slot = findSlot(slots, booking.starts_at)
  if (!slot || !slot.available) return 'the hold had expired and the slot is no longer available'
  return null
}

async function afterPending(
  db: Db,
  event: Stripe.Event,
  pi: Stripe.PaymentIntent,
  booking: BookingRow
): Promise<Outcome> {
  if (booking.status === 'cancelled') {
    if (booking.payment_intent_id === pi.id && booking.payment_status !== 'pending' && booking.payment_status !== 'failed') {
      // Paid before it was cancelled (the cancellation applied the refund policy),
      // or already refunded here.
      return {}
    }
    return refundUnapplied(
      db,
      event,
      pi,
      booking,
      `booking ${booking.id} was cancelled (${booking.cancellation_reason ?? 'no reason'}) before payment succeeded`
    )
  }
  // Already confirmed (duplicate or out-of-order delivery), completed or no-show.
  if (booking.payment_status === 'pending' || booking.payment_status === 'failed') {
    const { error } = await db
      .from('bookings')
      .update({ payment_status: 'succeeded', payment_intent_id: pi.id })
      .eq('id', booking.id)
    if (error) throw error
  }
  return {}
}

/** The payment cannot be applied to its booking: refund it in full and record why. */
async function refundUnapplied(
  db: Db,
  event: Stripe.Event,
  pi: Stripe.PaymentIntent,
  booking: BookingRow,
  why: string
): Promise<Outcome> {
  const { refund } = await refundPaymentIntentInFull(db, {
    bookingId: booking.id,
    paymentIntentId: pi.id,
    idempotencyKey: `pi-${pi.id}-unapplied-refund`,
    reason: 'booking_unavailable',
  })
  const refundOk = !refund || (refund.status !== 'failed' && refund.status !== 'canceled')

  if (refundOk && (!booking.payment_intent_id || booking.payment_intent_id === pi.id)) {
    const { error } = await db
      .from('bookings')
      .update({ payment_status: 'refunded', payment_intent_id: pi.id })
      .eq('id', booking.id)
    if (error) throw error
  }

  if (!refund) return alert(event, `${why}; it was already refunded`)
  if (!refundOk) return alert(event, `${why}; refund ${refund.id} ended ${refund.status}, needs manual follow-up`)
  return alert(event, `${why}; refunded ${refund.id}`)
}

/** payment_intent.canceled: the intent can never be paid, so release its hold. */
async function onPaymentCanceled(db: Db, pi: Stripe.PaymentIntent): Promise<Outcome> {
  const { booking } = await bookingForPaymentIntent(db, pi)
  if (!booking) return { ignored: true }
  if (booking.payment_intent_id && booking.payment_intent_id !== pi.id) return { ignored: true }

  if (booking.status === 'pending') {
    const { error } = await db
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'payment_canceled',
        hold_expires_at: null,
        payment_status: 'failed',
      })
      .eq('id', booking.id)
      .eq('status', 'pending')
    if (error) throw error
  } else if (booking.status === 'cancelled' && booking.payment_status === 'pending') {
    const { error } = await db.from('bookings').update({ payment_status: 'failed' }).eq('id', booking.id)
    if (error) throw error
  }
  return {}
}

async function onChargeRefunded(db: Db, event: Stripe.Event, charge: Stripe.Charge): Promise<Outcome> {
  const paymentIntentId = stripeId(charge.payment_intent)
  if (!paymentIntentId) return { ignored: true }
  const booking = await bookingByPaymentIntent(db, paymentIntentId)
  if (!booking) return { ignored: true }

  // One payments row per refund id; amount_refunded is a running total and is
  // only used to derive the booking's payment status.
  const stripe = getStripe()
  let startingAfter: string | undefined
  for (;;) {
    const page = await stripe.refunds.list({
      charge: charge.id,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    for (const refund of page.data) await recordRefund(db, booking.id, refund)
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1].id
  }

  return applyRefundStatus(db, event, booking, paymentIntentId, charge)
}

async function onRefundChanged(db: Db, event: Stripe.Event, refund: Stripe.Refund): Promise<Outcome> {
  const paymentIntentId = stripeId(refund.payment_intent)
  if (!paymentIntentId) return { ignored: true }
  const booking = await bookingByPaymentIntent(db, paymentIntentId)
  if (!booking) return { ignored: true }

  await recordRefund(db, booking.id, refund)

  let outcome: Outcome = {}
  const chargeId = stripeId(refund.charge)
  if (chargeId) {
    const charge = await getStripe().charges.retrieve(chargeId)
    outcome = await applyRefundStatus(db, event, booking, paymentIntentId, charge)
  }
  if (refund.status === 'failed' || refund.status === 'canceled') {
    return alert(
      event,
      `refund ${refund.id} for booking ${booking.id} (${booking.status}) ended ${refund.status}` +
        (outcome.error ? `; ${outcome.error}` : '')
    )
  }
  return outcome
}

async function applyRefundStatus(
  db: Db,
  event: Stripe.Event,
  booking: BookingRow,
  paymentIntentId: string,
  charge: Pick<Stripe.Charge, 'refunded' | 'amount_refunded'>
): Promise<Outcome> {
  if (booking.payment_intent_id !== paymentIntentId) return {}
  const wasRefunded = booking.payment_status === 'refunded' || booking.payment_status === 'partially_refunded'
  // Nothing refunded any more (a refund failed or was canceled) → back to succeeded.
  const status = paymentStatusFromCharge(charge) ?? (wasRefunded ? 'succeeded' : null)
  if (!status || status === booking.payment_status) return {}
  const { error } = await db.from('bookings').update({ payment_status: status }).eq('id', booking.id)
  if (error) throw error
  if (wasRefunded && status === 'succeeded') {
    // Never silent: a client who was told they were refunded has been charged after all.
    return alert(event, `booking ${booking.id} (${booking.status}) was marked refunded but its charge is no longer refunded`)
  }
  return {}
}

// ---------------------------------------------------------------------------
// Connect accounts
// ---------------------------------------------------------------------------

async function onAccountUpdated(db: Db, event: Stripe.Event, payload: Stripe.Account): Promise<Outcome> {
  const { data: billing, error } = await db
    .from('barber_billing')
    .select('barber_id')
    .eq('stripe_account_id', payload.id)
    .maybeSingle()
  if (error) throw error
  if (!billing) return { ignored: true }

  // Events can arrive out of order; store what Stripe says now, not the payload.
  let account: Stripe.Account
  try {
    account = await getStripe().accounts.retrieve(payload.id)
  } catch (err) {
    if (!isAccountGoneError(err)) throw err // transient: Stripe retries the event
    const { error: goneError } = await db
      .from('barber_billing')
      .update({ charges_enabled: false, payouts_enabled: false })
      .eq('barber_id', billing.barber_id)
    if (goneError) throw goneError
    return {}
  }

  const metadataBarber = account.metadata?.barber_id
  if (metadataBarber && metadataBarber !== billing.barber_id) {
    return alert(
      event,
      `account ${account.id} belongs to barber ${metadataBarber} but is stored on barber ${billing.barber_id}; not updated`
    )
  }

  const { error: updateError } = await db
    .from('barber_billing')
    .update({
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
    })
    .eq('barber_id', billing.barber_id)
  if (updateError) throw updateError
  return {}
}

async function onAccountDeauthorized(db: Db, event: Stripe.Event): Promise<Outcome> {
  // data.object is our Application; the connected account is event.account.
  const accountId = event.account
  if (!accountId) return { ignored: true }

  const { data, error } = await db
    .from('barber_billing')
    .update({ charges_enabled: false, payouts_enabled: false })
    .eq('stripe_account_id', accountId)
    .select('barber_id')
  if (error) throw error
  return data && data.length > 0 ? {} : { ignored: true }
}

// ---------------------------------------------------------------------------

function alert(event: Stripe.Event, message: string): Outcome {
  Sentry.captureMessage(`Stripe webhook: ${message}`, {
    level: 'error',
    tags: { webhook_event: event.id, webhook_event_type: event.type },
  })
  return { error: message }
}

function describe(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; message?: unknown }
    const parts = [typeof e.code === 'string' ? e.code : null, typeof e.message === 'string' ? e.message : null]
    const text = parts.filter(Boolean).join(' ')
    if (text) return text.slice(0, 500)
  }
  return 'unknown error'
}
