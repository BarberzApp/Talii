import 'server-only'
import { getSupabaseAdmin } from '../clients'
import { ApiError, PG, pgCode } from '../errors'
import type { BookingRow } from './create'
import { releaseExpiredHolds } from './holds'

export interface ManualBookingInput {
  serviceId: string
  startsAt: string
  customerName: string
  notes?: string
}

/**
 * A walk-in or phone booking on the barber's own calendar: source 'manual',
 * no client account, no payment, confirmed immediately. Working hours are not
 * enforced (barbers may fit someone in), but the overlap constraint is.
 */
export async function createManualBooking(barberId: string, input: ManualBookingInput): Promise<BookingRow> {
  const db = getSupabaseAdmin()

  const { data: service, error: serviceError } = await db
    .from('services')
    .select('id, barber_id, duration_minutes, price_cents')
    .eq('id', input.serviceId)
    .maybeSingle()
  if (serviceError) throw serviceError
  if (!service || service.barber_id !== barberId) {
    throw new ApiError(400, 'INVALID_SERVICE', 'Choose one of your own services.')
  }

  const startsAt = new Date(input.startsAt)
  const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000)

  // Expired app holds would otherwise still block the slot; their PaymentIntents are cancelled too.
  await releaseExpiredHolds(db, barberId)

  const { data: booking, error } = await db
    .from('bookings')
    .insert({
      barber_id: barberId,
      client_id: null,
      customer_name: input.customerName,
      service_id: service.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      source: 'manual',
      status: 'confirmed',
      payment_status: 'none',
      service_price_cents: service.price_cents,
      notes: input.notes ?? null,
    })
    .select('*')
    .single()
  if (error) {
    if (pgCode(error) === PG.exclusionViolation) {
      throw new ApiError(409, 'SLOT_TAKEN', 'You already have a booking at that time.')
    }
    throw error
  }
  return booking
}
