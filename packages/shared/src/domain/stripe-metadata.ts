/**
 * Stripe metadata contract for booking-fee PaymentIntents.
 *
 * The booking row is the source of truth (barber, service, time, amounts). The
 * PaymentIntent carries only the booking id so the webhook can find it.
 * Stripe metadata values must be strings.
 */
export interface BookingPaymentMetadata {
  bookingId: string
  [key: string]: string
}

export function buildBookingPaymentMetadata(bookingId: string): BookingPaymentMetadata {
  return { bookingId }
}

/** The booking id from PaymentIntent metadata, or null when it is not one of ours. */
export function parseBookingPaymentMetadata(
  metadata: Record<string, string> | null | undefined
): string | null {
  const value = metadata?.bookingId
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
