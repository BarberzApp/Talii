import 'server-only'
import { getSupabaseAdmin } from '../clients'
import { ApiError } from '../errors'
import type { BookingStatus } from './policy'

export interface ListBookingsInput {
  as: 'client' | 'barber'
  statuses?: BookingStatus[]
  from?: string
  to?: string
  order: 'asc' | 'desc'
  limit: number
  offset: number
}

/**
 * Columns returned per booking. Profiles are embedded with explicit safe
 * columns only (never email or phone).
 */
const BOOKING_SELECT = `
  id, barber_id, client_id, customer_name, service_id, starts_at, ends_at, source, status,
  payment_status, hold_expires_at, service_price_cents, addon_total_cents, booking_fee_cents,
  notes, cancelled_at, cancellation_reason, created_at, updated_at,
  service:services(id, name, duration_minutes),
  addons:booking_addons(addon_id, name, price_cents),
  barber:barbers(id, business_name, timezone, city, state, profile:profiles!barbers_user_id_fkey(name, username, avatar_url)),
  client:profiles!bookings_client_id_fkey(name, username, avatar_url)
` as const

/** The caller's bookings as client (default) or as the barber, newest first by default. */
export async function listBookings(userId: string, input: ListBookingsInput) {
  const db = getSupabaseAdmin()

  let query = db.from('bookings').select(BOOKING_SELECT, { count: 'exact' })

  if (input.as === 'barber') {
    const { data: barber, error } = await db.from('barbers').select('id').eq('user_id', userId).maybeSingle()
    if (error) throw error
    if (!barber) throw new ApiError(403, 'NOT_A_BARBER', 'This action needs a barber account.')
    query = query.eq('barber_id', barber.id)
  } else {
    query = query.eq('client_id', userId)
  }

  if (input.statuses && input.statuses.length > 0) query = query.in('status', input.statuses)
  if (input.from) query = query.gte('starts_at', input.from)
  if (input.to) query = query.lt('starts_at', input.to)

  const { data, error, count } = await query
    .order('starts_at', { ascending: input.order === 'asc' })
    .order('id', { ascending: true })
    .range(input.offset, input.offset + input.limit - 1)
  if (error) throw error

  return {
    bookings: data ?? [],
    pagination: { limit: input.limit, offset: input.offset, total: count ?? 0 },
  }
}
