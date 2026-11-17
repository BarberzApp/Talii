import 'server-only'

/**
 * Booking rules in one place. See docs/BACKEND_REBUILD_PLAN.md (Phase 3a).
 */

/**
 * How long a pending booking holds its slot while the client pays the fee.
 * Ten minutes covers the Payment Element (including 3-D Secure) without
 * blocking a barber's calendar for long. An expired hold still blocks the slot
 * until the next booking attempt for that barber cancels it
 * (`create_booking_hold` does that); availability already shows it as free.
 * If a payment succeeds after its hold was released, the webhook refunds it.
 */
export const HOLD_MINUTES = 10

/** Distance between bookable slot starts. GET availability and POST bookings use the same grid. */
export const SLOT_INTERVAL_MINUTES = 15

/** Slots must start at least this many minutes from now. */
export const MIN_LEAD_MINUTES = 0

/**
 * A payment that succeeds this long after its hold expired is still applied
 * without re-checking (Stripe and our clock can disagree slightly). Later, or
 * once the start time has passed, the slot is re-validated first and the fee
 * is refunded if it is no longer bookable.
 */
export const HOLD_GRACE_MINUTES = 2

/** A client may hold at most this many unpaid slots at once (stops calendar squatting). */
export const MAX_ACTIVE_HOLDS_PER_CLIENT = 3

/**
 * Caps on a client's upcoming bookings (pending holds + confirmed, starting in
 * the future). Apply to fee-exempt barbers too.
 */
export const MAX_UPCOMING_BOOKINGS_PER_BARBER = 5
export const MAX_UPCOMING_BOOKINGS_TOTAL = 10

/**
 * Refund policy for the booking fee when a paid booking is cancelled:
 * - cancelled by the barber: full fee refund, always;
 * - cancelled by the client more than 24 hours before the start: full fee refund;
 * - cancelled by the client within 24 hours of the start: no refund.
 * Refunds reverse the barber's transfer and the platform's application fee
 * proportionally (`reverse_transfer`, `refund_application_fee`).
 * Completed and no-show bookings cannot be cancelled, and nobody can cancel
 * once the start time has passed (the barber marks it completed or no-show).
 */
export const CLIENT_FREE_CANCELLATION_HOURS = 24

export type CancelledBy = 'client' | 'barber'

export function feeRefundDue(cancelledBy: CancelledBy, startsAt: string, now: Date): boolean {
  if (cancelledBy === 'barber') return true
  return Date.parse(startsAt) - now.getTime() > CLIENT_FREE_CANCELLATION_HOURS * 60 * 60 * 1000
}

/** Statuses that hold a slot (the overlap constraint covers exactly these). */
export const ACTIVE_STATUSES = ['pending', 'confirmed'] as const

export const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const PAYMENT_STATUSES = ['none', 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
