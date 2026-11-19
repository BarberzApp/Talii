import { isApiError } from './errors'

/**
 * Friendlier wording for booking errors (POST /api/bookings and PATCH /api/bookings/:id).
 * Falls back to the server's message, which is already safe to show.
 */
const BOOKING_MESSAGES: Record<string, string> = {
  SLOT_TAKEN: 'Someone just booked that time. Please pick another slot.',
  BOOKING_LIMIT_REACHED:
    'You have reached the limit of upcoming bookings (5 with one barber, 10 in total). Cancel or finish one first.',
  TOO_MANY_HOLDS: 'You have unpaid bookings in progress. Finish or cancel them before starting another.',
  BARBER_NOT_READY: 'This barber is not accepting online bookings yet. Please try again later.',
  BARBER_NOT_FOUND: 'This barber is no longer available.',
  CANNOT_BOOK_SELF: 'You cannot book an appointment with yourself.',
  INVALID_SERVICE: 'This service is no longer available.',
  OUTSIDE_HOURS: 'That time is outside the barber’s hours. Please pick another slot.',
  SLOT_IN_PAST: 'That time has already passed. Please pick another slot.',
  INVALID_SELECTION: 'One of the selected add-ons is no longer available.',
  STRIPE_ERROR: 'Payment could not be started. Please try again.',
  BOOKING_NOT_CANCELLABLE: 'This booking can no longer be cancelled.',
  TOO_LATE_TO_CANCEL: 'This appointment has already started, so it can no longer be cancelled.',
  BOOKING_CHANGED: 'This booking just changed. Refresh and try again.',
  UNAUTHORIZED: 'Please sign in to continue.',
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
}

export function bookingErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!isApiError(error)) return fallback
  return BOOKING_MESSAGES[error.code] ?? (error.message || fallback)
}
