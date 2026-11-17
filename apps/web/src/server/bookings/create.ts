import 'server-only'
import * as Sentry from '@sentry/nextjs'
import {
  bookingFeeAmounts,
  buildBookingPaymentMetadata,
  findSlot,
  localDateInTimeZone,
  type Tables,
} from '@barber-app/shared'
import { getStripe, getSupabaseAdmin, type Db } from '../clients'
import { ApiError, PG, pgCode } from '../errors'
import { callStripe } from '../stripe/errors'
import { computeDaySlots, loadBarberForBooking } from './availability'
import { cancelPaymentIntentQuietly, releaseExpiredHolds } from './holds'
import {
  HOLD_MINUTES,
  MAX_ACTIVE_HOLDS_PER_CLIENT,
  MAX_UPCOMING_BOOKINGS_PER_BARBER,
  MAX_UPCOMING_BOOKINGS_TOTAL,
} from './policy'

export type BookingRow = Tables<'bookings'>

export interface CreateBookingInput {
  barberId: string
  serviceId: string
  startsAt: string
  addonIds: string[]
  notes?: string
}

export interface CreateBookingResult {
  booking: BookingRow
  /** PaymentIntent client secret for the Payment Element; null when no fee is due. */
  clientSecret: string | null
}

/**
 * The one booking path for web and mobile.
 *
 * 1. Validate barber, service, the barber's Stripe readiness and the slot
 *    (re-checked with the availability engine in the barber's time zone).
 * 2. `create_booking_hold` inserts a pending booking that holds the slot for
 *    HOLD_MINUTES (the overlap constraint makes this race-safe).
 * 3. Fee-exempt barber: confirm immediately. Otherwise create the PaymentIntent
 *    (destination charge, idempotent per booking) and store its id. The
 *    webhook confirms the booking on payment_intent.succeeded.
 */
export async function createBooking(
  clientId: string,
  input: CreateBookingInput,
  now: Date = new Date()
): Promise<CreateBookingResult> {
  const db = getSupabaseAdmin()

  const barber = await loadBarberForBooking(db, input.barberId)
  if (!barber) throw new ApiError(404, 'BARBER_NOT_FOUND', 'Barber not found.')
  if (barber.user_id === clientId) {
    throw new ApiError(400, 'CANNOT_BOOK_SELF', 'You cannot book an appointment with yourself.')
  }
  if (!barber.listed) throw new ApiError(404, 'BARBER_NOT_FOUND', 'Barber not found.')

  const { data: service, error: serviceError } = await db
    .from('services')
    .select('id, barber_id, duration_minutes, is_active')
    .eq('id', input.serviceId)
    .maybeSingle()
  if (serviceError) throw serviceError
  if (!service || service.barber_id !== barber.id || !service.is_active) {
    throw new ApiError(400, 'INVALID_SERVICE', 'This service is not available.')
  }

  const { data: billing, error: billingError } = await db
    .from('barber_billing')
    .select('fee_exempt, charges_enabled, stripe_account_id')
    .eq('barber_id', barber.id)
    .maybeSingle()
  if (billingError) throw billingError
  const feeExempt = billing?.fee_exempt ?? false
  if (!feeExempt && (!billing?.charges_enabled || !billing.stripe_account_id)) {
    throw new ApiError(409, 'BARBER_NOT_READY', 'This barber cannot take bookings yet.')
  }

  await assertBookingAllowance(db, clientId, barber.id, now)

  // Re-check the slot exactly as GET /api/barbers/:id/availability computes it.
  const date = localDateInTimeZone(input.startsAt, barber.timezone)
  const slots = await computeDaySlots(db, {
    barberId: barber.id,
    timeZone: barber.timezone,
    date,
    durationMinutes: service.duration_minutes,
    now,
  })
  const slot = findSlot(slots, input.startsAt)
  if (!slot) throw new ApiError(400, 'OUTSIDE_HOURS', "That time is outside the barber's hours.")
  if (slot.reason === 'past') throw new ApiError(400, 'SLOT_IN_PAST', 'That time has already passed.')
  if (!slot.available) throw new ApiError(409, 'SLOT_TAKEN', 'That time was just booked. Please pick another.')

  const fees = bookingFeeAmounts(feeExempt)

  // Release expired holds here (not only inside create_booking_hold) so their
  // PaymentIntents are cancelled too and cannot be paid late.
  await releaseExpiredHolds(db, barber.id, now)

  const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000)

  const { data: hold, error: holdError } = await db.rpc('create_booking_hold', {
    p_barber_id: barber.id,
    p_client_id: clientId,
    p_service_id: service.id,
    p_starts_at: slot.startsAt,
    p_hold_expires_at: holdExpiresAt.toISOString(),
    p_booking_fee_cents: fees.bookingFeeCents,
    p_application_fee_cents: fees.applicationFeeCents,
    p_barber_fee_share_cents: fees.barberFeeShareCents,
    p_addon_ids: input.addonIds,
    p_notes: input.notes,
  })
  if (holdError) {
    const code = pgCode(holdError)
    if (code === PG.exclusionViolation) {
      throw new ApiError(409, 'SLOT_TAKEN', 'That time was just booked. Please pick another.')
    }
    if (code === PG.invalidParameterValue) {
      throw new ApiError(400, 'INVALID_SELECTION', 'The service or one of the add-ons is not available.')
    }
    throw holdError
  }
  if (!hold) throw new Error('create_booking_hold returned no row')

  if (fees.bookingFeeCents === 0) {
    const { data: confirmed, error } = await db
      .from('bookings')
      .update({ status: 'confirmed', hold_expires_at: null })
      .eq('id', hold.id)
      .select('*')
      .single()
    if (error) throw error
    return { booking: confirmed, clientSecret: null }
  }

  // Destination charge: the barber's account receives amount - application fee (120).
  const destination = billing?.stripe_account_id as string
  let paymentIntent
  try {
    paymentIntent = await callStripe('paymentIntents.create', () =>
      getStripe().paymentIntents.create(
        {
          amount: fees.bookingFeeCents,
          currency: 'usd',
          application_fee_amount: fees.applicationFeeCents,
          transfer_data: { destination },
          metadata: buildBookingPaymentMetadata(hold.id),
          automatic_payment_methods: { enabled: true },
          description: 'Talii booking fee',
        },
        { idempotencyKey: `booking-${hold.id}-payment-intent` }
      )
    )
  } catch (error) {
    await releaseHold(db, hold.id, 'payment_setup_failed')
    throw error
  }

  const { data: booking, error: saveError } = await db
    .from('bookings')
    .update({ payment_intent_id: paymentIntent.id })
    .eq('id', hold.id)
    .select('*')
    .single()
  if (saveError) {
    // Without the stored id the client never gets the secret; cancel both sides.
    await cancelPaymentIntentQuietly(paymentIntent.id)
    await releaseHold(db, hold.id, 'payment_setup_failed')
    throw saveError
  }

  if (!paymentIntent.client_secret) throw new Error('PaymentIntent has no client secret')
  return { booking, clientSecret: paymentIntent.client_secret }
}

/**
 * Limits per client: unpaid holds (MAX_ACTIVE_HOLDS_PER_CLIENT) and upcoming
 * pending/confirmed bookings, per barber and overall. Expired holds do not count.
 */
async function assertBookingAllowance(db: Db, clientId: string, barberId: string, now: Date): Promise<void> {
  const { data, error } = await db
    .from('bookings')
    .select('barber_id, status, hold_expires_at')
    .eq('client_id', clientId)
    .in('status', ['pending', 'confirmed'])
    .gt('starts_at', now.toISOString())
  if (error) throw error

  const live = (data ?? []).filter(
    (b) => b.status === 'confirmed' || (b.hold_expires_at !== null && Date.parse(b.hold_expires_at) > now.getTime())
  )
  if (live.filter((b) => b.status === 'pending').length >= MAX_ACTIVE_HOLDS_PER_CLIENT) {
    throw new ApiError(
      429,
      'TOO_MANY_HOLDS',
      'You have unfinished bookings. Complete or cancel them before starting another.'
    )
  }
  if (live.filter((b) => b.barber_id === barberId).length >= MAX_UPCOMING_BOOKINGS_PER_BARBER) {
    throw new ApiError(
      409,
      'BOOKING_LIMIT_REACHED',
      `You can have at most ${MAX_UPCOMING_BOOKINGS_PER_BARBER} upcoming bookings with one barber.`
    )
  }
  if (live.length >= MAX_UPCOMING_BOOKINGS_TOTAL) {
    throw new ApiError(
      409,
      'BOOKING_LIMIT_REACHED',
      `You can have at most ${MAX_UPCOMING_BOOKINGS_TOTAL} upcoming bookings.`
    )
  }
}

/** Cancels a still-pending hold. Best effort: errors are reported, not thrown. */
export async function releaseHold(db: Db, bookingId: string, reason: string): Promise<void> {
  const { error } = await db
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      hold_expires_at: null,
      payment_status: 'failed',
    })
    .eq('id', bookingId)
    .eq('status', 'pending')
  if (error) Sentry.captureException(error, { tags: { operation: 'releaseHold' } })
}
