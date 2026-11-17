import 'server-only'
import {
  buildAvailabilitySlots,
  dayOfWeekForDate,
  isValidTimeZone,
  localDayBounds,
  type BusyInterval,
  type Slot,
} from '@barber-app/shared'
import type { Db } from '../clients'
import { ACTIVE_STATUSES, MIN_LEAD_MINUTES, SLOT_INTERVAL_MINUTES } from './policy'

export interface BarberForBooking {
  id: string
  user_id: string
  timezone: string
  /** is_public and the owner's profile is not disabled. */
  listed: boolean
}

/** Loads a barber with its listing state, or null when the id does not exist. */
export async function loadBarberForBooking(db: Db, barberId: string): Promise<BarberForBooking | null> {
  const { data: barber, error } = await db
    .from('barbers')
    .select('id, user_id, timezone, is_public')
    .eq('id', barberId)
    .maybeSingle()
  if (error) throw error
  if (!barber) return null

  const { data: owner, error: ownerError } = await db
    .from('profiles')
    .select('is_disabled')
    .eq('id', barber.user_id)
    .maybeSingle()
  if (ownerError) throw ownerError

  return {
    id: barber.id,
    user_id: barber.user_id,
    timezone: barber.timezone,
    listed: barber.is_public && !!owner && !owner.is_disabled,
  }
}

/**
 * Pending holds and confirmed bookings overlapping [from, to). Holds whose
 * expiry has passed are left out: the next `create_booking_hold` for this
 * barber cancels them, so the slot is effectively free.
 */
export async function loadBusyIntervals(
  db: Db,
  barberId: string,
  from: Date,
  to: Date,
  now: Date
): Promise<BusyInterval[]> {
  const { data, error } = await db
    .from('bookings')
    .select('starts_at, ends_at, status, hold_expires_at')
    .eq('barber_id', barberId)
    .in('status', [...ACTIVE_STATUSES])
    .lt('starts_at', to.toISOString())
    .gt('ends_at', from.toISOString())
  if (error) throw error

  return (data ?? [])
    .filter(
      (b) => !(b.status === 'pending' && b.hold_expires_at && Date.parse(b.hold_expires_at) <= now.getTime())
    )
    .map((b) => ({ startsAt: b.starts_at, endsAt: b.ends_at }))
}

/**
 * Slots for one local date in the barber's time zone, from weekly
 * availability, that date's special hours and existing bookings.
 */
export async function computeDaySlots(
  db: Db,
  args: { barberId: string; timeZone: string; date: string; durationMinutes: number; now: Date }
): Promise<Slot[]> {
  const { barberId, timeZone, date, durationMinutes, now } = args
  if (!isValidTimeZone(timeZone)) {
    // Data problem (the barber settings route must validate time zones): report as a 500.
    throw new Error(`Barber ${barberId} has an unknown time zone`)
  }

  const { start, end } = localDayBounds(date, timeZone)

  const [windowsResult, specialResult, busy] = await Promise.all([
    db
      .from('availability')
      .select('start_time, end_time')
      .eq('barber_id', barberId)
      .eq('day_of_week', dayOfWeekForDate(date)),
    db
      .from('special_hours')
      .select('is_closed, start_time, end_time')
      .eq('barber_id', barberId)
      .eq('date', date)
      .maybeSingle(),
    loadBusyIntervals(db, barberId, start, end, now),
  ])
  if (windowsResult.error) throw windowsResult.error
  if (specialResult.error) throw specialResult.error

  return buildAvailabilitySlots({
    date,
    timeZone,
    durationMinutes,
    intervalMinutes: SLOT_INTERVAL_MINUTES,
    windows: windowsResult.data ?? [],
    specialHours: specialResult.data,
    busy,
    now,
    minLeadMinutes: MIN_LEAD_MINUTES,
  })
}
