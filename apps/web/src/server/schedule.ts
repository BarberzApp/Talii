import 'server-only'
import { localDateInTimeZone, localDayBounds, localTimeInTimeZone, parseClockToMinutes } from '@barber-app/shared'
import { ACTIVE_STATUSES } from './bookings/policy'
import { getSupabaseAdmin } from './clients'
import { ApiError, pgCode, PG } from './errors'

/**
 * A barber's weekly hours and per-date special hours. Times are local
 * wall-clock "HH:MM" in barbers.timezone; "24:00" means end of day.
 */

export interface WeeklyWindow {
  dayOfWeek: number
  startTime: string
  endTime: string
}

/** "HH:MM" (or "24:00") → minutes; the route's zod schema has already checked the format. */
function minutes(clock: string): number {
  const m = parseClockToMinutes(clock)
  if (m === null) throw new ApiError(400, 'VALIDATION_ERROR', `Invalid time ${clock}.`)
  return m
}

/** Throws 400 INVALID_SCHEDULE unless each window has start < end and no two windows on a day overlap. */
export function assertValidWeek(windows: WeeklyWindow[]): void {
  const byDay = new Map<number, Array<{ start: number; end: number }>>()
  for (const w of windows) {
    const start = minutes(w.startTime)
    const end = minutes(w.endTime)
    if (start >= 1440 || end <= start) {
      throw new ApiError(400, 'INVALID_SCHEDULE', `Day ${w.dayOfWeek}: ${w.startTime}-${w.endTime} must start before it ends.`)
    }
    const list = byDay.get(w.dayOfWeek) ?? []
    list.push({ start, end })
    byDay.set(w.dayOfWeek, list)
  }
  for (const [day, list] of byDay) {
    list.sort((a, b) => a.start - b.start)
    for (let i = 1; i < list.length; i++) {
      if (list[i].start < list[i - 1].end) {
        throw new ApiError(400, 'INVALID_SCHEDULE', `Day ${day}: windows overlap.`)
      }
    }
  }
}

export async function getWeek(barberId: string) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('availability')
    .select('id, day_of_week, start_time, end_time')
    .eq('barber_id', barberId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })
  if (error) throw error
  return { availability: data ?? [] }
}

/** Replaces the whole weekly schedule in one transaction (replace_availability). */
export async function replaceWeek(barberId: string, windows: WeeklyWindow[]) {
  assertValidWeek(windows)
  const db = getSupabaseAdmin()
  const { error } = await db.rpc('replace_availability', {
    p_barber_id: barberId,
    p_windows: windows.map((w) => ({
      day_of_week: w.dayOfWeek,
      start_time: w.startTime,
      end_time: w.endTime,
    })),
  })
  if (error) {
    const code = pgCode(error)
    if (code === PG.invalidParameterValue || code === PG.uniqueViolation || code === '23514') {
      throw new ApiError(400, 'INVALID_SCHEDULE', 'Those hours could not be saved: check for overlapping windows.')
    }
    throw error
  }
  return getWeek(barberId)
}

const SPECIAL_HOURS_COLUMNS = 'id, date, is_closed, start_time, end_time, reason, created_at, updated_at'

export async function listSpecialHours(barberId: string, range: { from?: string; to?: string }) {
  const db = getSupabaseAdmin()
  let query = db.from('special_hours').select(SPECIAL_HOURS_COLUMNS).eq('barber_id', barberId)
  if (range.from) query = query.gte('date', range.from)
  if (range.to) query = query.lte('date', range.to)
  const { data, error } = await query.order('date', { ascending: true }).limit(500)
  if (error) throw error
  return { specialHours: data ?? [] }
}

export type SpecialHoursInput =
  | { date: string; isClosed: true; reason?: string | null }
  | { date: string; isClosed: false; startTime: string; endTime: string; reason?: string | null }

/**
 * Creates or replaces the override for one date. Existing bookings are not
 * touched; the response lists active bookings on that local date that fall
 * outside the new hours so the barber can deal with them.
 */
export async function putSpecialHours(barberId: string, timeZone: string, input: SpecialHoursInput) {
  let start: number | null = null
  let end: number | null = null
  if (!input.isClosed) {
    start = minutes(input.startTime)
    end = minutes(input.endTime)
    if (start >= 1440 || end <= start) {
      throw new ApiError(400, 'INVALID_SCHEDULE', 'Special hours must start before they end.')
    }
  }

  const db = getSupabaseAdmin()
  const row = {
    barber_id: barberId,
    date: input.date,
    is_closed: input.isClosed,
    start_time: input.isClosed ? null : input.startTime,
    end_time: input.isClosed ? null : input.endTime,
    reason: input.reason ?? null,
  }
  const { data, error } = await db
    .from('special_hours')
    .upsert(row, { onConflict: 'barber_id,date' })
    .select(SPECIAL_HOURS_COLUMNS)
    .single()
  if (error) throw error

  const { start: dayStart, end: dayEnd } = localDayBounds(input.date, timeZone)
  const { data: bookings, error: bookingsError } = await db
    .from('bookings')
    .select('id, starts_at, ends_at, status')
    .eq('barber_id', barberId)
    .in('status', [...ACTIVE_STATUSES])
    .gte('starts_at', dayStart.toISOString())
    .lt('starts_at', dayEnd.toISOString())
  if (bookingsError) throw bookingsError

  // Compare in the barber's wall-clock time (correct on DST days, when the
  // local day is 23 or 25 hours long). An end on a later local date is past 24:00.
  const wallClock = (instant: string): number => {
    const m = minutes(localTimeInTimeZone(instant, timeZone))
    return localDateInTimeZone(instant, timeZone) > input.date ? 1440 + m : m
  }
  const outside = (bookings ?? []).filter((b) => {
    if (input.isClosed) return true
    return wallClock(b.starts_at) < (start as number) || wallClock(b.ends_at) > (end as number)
  })

  return { specialHours: data, bookingsOutsideHours: outside }
}

export async function deleteSpecialHours(barberId: string, date: string) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('special_hours')
    .delete()
    .eq('barber_id', barberId)
    .eq('date', date)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new ApiError(404, 'SPECIAL_HOURS_NOT_FOUND', 'No special hours on that date.')
  return { deleted: true }
}
