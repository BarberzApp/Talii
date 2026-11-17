/**
 * Availability engine.
 *
 * Builds bookable slots for one barber on one local calendar date. Working
 * hours (`availability`, `special_hours`) are wall-clock times in the barber's
 * IANA time zone; bookings are absolute instants (`starts_at` / `ends_at`).
 * Every slot is computed as an absolute instant, so the result is the same on
 * any server or device regardless of the machine's own time zone, including on
 * daylight-saving change days.
 *
 * Only the platform `Intl` API is used (no time-zone library).
 */

export type ClockTime = string // "HH:MM" or "HH:MM:SS"; "24:00" means end of day

export interface AvailabilityWindow {
  start_time: ClockTime
  end_time: ClockTime
}

export interface SpecialHoursLike {
  is_closed?: boolean | null
  start_time?: ClockTime | null
  end_time?: ClockTime | null
}

/** An existing booking (or hold) that blocks time. ISO 8601 instants. */
export interface BusyInterval {
  startsAt: string
  endsAt: string
}

export type SlotUnavailableReason = 'booked' | 'past'

export interface Slot {
  /** Slot start as an ISO 8601 UTC instant. */
  startsAt: string
  /** Slot end (start + duration) as an ISO 8601 UTC instant. */
  endsAt: string
  /** Local wall-clock start "HH:MM" in the barber's time zone, for display. */
  time: string
  available: boolean
  reason?: SlotUnavailableReason
}

export interface BuildSlotsInput {
  /** Local calendar date in the barber's time zone, "YYYY-MM-DD". */
  date: string
  /** The barber's IANA time zone, e.g. "America/New_York". */
  timeZone: string
  durationMinutes: number
  /** Distance between slot starts. Defaults to DEFAULT_SLOT_INTERVAL_MINUTES. */
  intervalMinutes?: number
  /** Weekly windows for this date's weekday (several allowed, e.g. split shifts). */
  windows: AvailabilityWindow[]
  /** A per-date override. Closed means no slots; open replaces `windows`. */
  specialHours?: SpecialHoursLike | null
  /** Pending holds and confirmed bookings that block time. */
  busy: BusyInterval[]
  /** Slots starting before `now + minLeadMinutes` are unavailable ("past"). */
  now?: Date
  minLeadMinutes?: number
}

export const DEFAULT_SLOT_INTERVAL_MINUTES = 15

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

// ---------------------------------------------------------------------------
// Time-zone helpers
// ---------------------------------------------------------------------------

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatterCache.set(timeZone, fmt)
  }
  return fmt
}

/** True when `timeZone` is an IANA zone the runtime understands. */
export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || timeZone.length === 0) return false
  try {
    formatterFor(timeZone)
    return true
  } catch {
    return false
  }
}

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function localParts(instantMs: number, timeZone: string): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantMs))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN)
  const hour = get('hour')
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: hour === 24 ? 0 : hour, // some engines print midnight as 24
    minute: get('minute'),
    second: get('second'),
  }
}

/** Offset of `timeZone` from UTC at an instant, in minutes (New York in winter: -300). */
function offsetMinutes(instantMs: number, timeZone: string): number {
  const p = localParts(instantMs, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const truncated = instantMs - (((instantMs % 1000) + 1000) % 1000)
  return Math.round((asUtc - truncated) / MINUTE_MS)
}

function parseDate(date: string): { year: number; month: number; day: number } | null {
  const m = DATE_RE.exec(date)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null
  }
  return { year, month, day }
}

/** True for a real calendar date written "YYYY-MM-DD". */
export function isValidDateString(date: string): boolean {
  return parseDate(date) !== null
}

/** Weekday of a calendar date, 0 = Sunday (matches `availability.day_of_week`). */
export function dayOfWeekForDate(date: string): number {
  const d = parseDate(date)
  if (!d) throw new RangeError(`Invalid date: ${date}`)
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()
}

/** The calendar date "YYYY-MM-DD" one day after `date`. */
export function addDays(date: string, days: number): string {
  const d = parseDate(date)
  if (!d) throw new RangeError(`Invalid date: ${date}`)
  return new Date(Date.UTC(d.year, d.month - 1, d.day + days)).toISOString().slice(0, 10)
}

/**
 * Converts a local wall-clock time on a local date to a UTC instant.
 *
 * `minutesFromMidnight` may be 1440 ("24:00", the end of the day).
 * Daylight-saving rules (same as Temporal's "compatible" disambiguation):
 * - a time that occurs twice (clocks go back) resolves to the earlier instant;
 * - a time that does not exist (clocks go forward) is moved forward by the gap,
 *   e.g. 02:30 on a New York spring-forward day becomes 03:30 EDT.
 */
export function zonedTimeToUtc(date: string, minutesFromMidnight: number, timeZone: string): Date {
  const d = parseDate(date)
  if (!d) throw new RangeError(`Invalid date: ${date}`)
  const localAsUtc = Date.UTC(d.year, d.month - 1, d.day, 0, minutesFromMidnight)

  const before = offsetMinutes(localAsUtc - DAY_MS, timeZone)
  const after = offsetMinutes(localAsUtc + DAY_MS, timeZone)

  const candidates: number[] = []
  for (const off of before === after ? [before] : [before, after]) {
    const utc = localAsUtc - off * MINUTE_MS
    if (offsetMinutes(utc, timeZone) === off) candidates.push(utc)
  }

  if (candidates.length > 0) return new Date(Math.min(...candidates))
  // Inside a spring-forward gap: interpret with the pre-transition offset.
  return new Date(localAsUtc - before * MINUTE_MS)
}

/** Local calendar date "YYYY-MM-DD" of an instant in a time zone. */
export function localDateInTimeZone(instant: Date | string, timeZone: string): string {
  const ms = typeof instant === 'string' ? Date.parse(instant) : instant.getTime()
  const p = localParts(ms, timeZone)
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Local wall-clock "HH:MM" of an instant in a time zone. */
export function localTimeInTimeZone(instant: Date | string, timeZone: string): string {
  const ms = typeof instant === 'string' ? Date.parse(instant) : instant.getTime()
  const p = localParts(ms, timeZone)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/** UTC instants bounding a local calendar day: [start, end). */
export function localDayBounds(date: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(date, 0, timeZone),
    end: zonedTimeToUtc(addDays(date, 1), 0, timeZone),
  }
}

// ---------------------------------------------------------------------------
// Slot building
// ---------------------------------------------------------------------------

/** "HH:MM[:SS]" to minutes after midnight. "24:00" is allowed (1440). */
export function parseClockToMinutes(clock: ClockTime): number | null {
  const parts = String(clock).split(':')
  if (parts.length < 2) return null
  const hh = Number(parts[0])
  const mm = Number(parts[1])
  const ss = parts.length > 2 ? Number(parts[2]) : 0
  if (![hh, mm, ss].every(Number.isInteger)) return null
  if (hh === 24 && mm === 0 && ss === 0) return 1440
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null
  return hh * 60 + mm
}

/** The working windows that apply to a date, as minutes after local midnight. */
function effectiveWindows(input: BuildSlotsInput): Array<{ start: number; end: number }> {
  const { specialHours } = input
  if (specialHours?.is_closed) return []

  const source: AvailabilityWindow[] =
    specialHours?.start_time && specialHours?.end_time
      ? [{ start_time: specialHours.start_time, end_time: specialHours.end_time }]
      : input.windows ?? []

  const result: Array<{ start: number; end: number }> = []
  for (const w of source) {
    const start = parseClockToMinutes(w.start_time)
    const end = parseClockToMinutes(w.end_time)
    if (start === null || end === null || end <= start) continue
    result.push({ start, end })
  }
  return result
}

/**
 * Builds the slots for one local date.
 *
 * Slots are generated in real elapsed time from each window's start, every
 * `intervalMinutes`, and must end (start + duration) by the window's end. A
 * slot is unavailable when it overlaps a busy interval ("booked", half-open
 * ranges, so back-to-back is fine) or starts before `now + minLeadMinutes`
 * ("past"). Returns [] for an invalid date, time zone or duration.
 */
export function buildAvailabilitySlots(input: BuildSlotsInput): Slot[] {
  const { date, timeZone, durationMinutes } = input
  if (!parseDate(date) || !isValidTimeZone(timeZone)) return []
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return []

  const interval =
    Number.isFinite(input.intervalMinutes) && (input.intervalMinutes as number) > 0
      ? (input.intervalMinutes as number)
      : DEFAULT_SLOT_INTERVAL_MINUTES

  const busy: Array<{ start: number; end: number }> = []
  for (const b of input.busy ?? []) {
    const start = Date.parse(b.startsAt)
    const end = Date.parse(b.endsAt)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) busy.push({ start, end })
  }

  const earliest =
    input.now !== undefined ? input.now.getTime() + Math.max(0, input.minLeadMinutes ?? 0) * MINUTE_MS : -Infinity

  const byStart = new Map<number, Slot>()
  for (const w of effectiveWindows(input)) {
    const windowStart = zonedTimeToUtc(date, w.start, timeZone).getTime()
    const windowEnd = zonedTimeToUtc(date, w.end, timeZone).getTime()

    for (let t = windowStart; t + durationMinutes * MINUTE_MS <= windowEnd; t += interval * MINUTE_MS) {
      if (byStart.has(t)) continue
      const end = t + durationMinutes * MINUTE_MS
      const booked = busy.some((b) => t < b.end && b.start < end)
      const past = t < earliest
      byStart.set(t, {
        startsAt: new Date(t).toISOString(),
        endsAt: new Date(end).toISOString(),
        time: localTimeInTimeZone(new Date(t), timeZone),
        available: !booked && !past,
        ...(past ? { reason: 'past' as const } : booked ? { reason: 'booked' as const } : {}),
      })
    }
  }

  return [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([, slot]) => slot)
}

/** The slot starting exactly at `startsAt` (same instant), or undefined. */
export function findSlot(slots: Slot[], startsAt: string | Date): Slot | undefined {
  const ms = typeof startsAt === 'string' ? Date.parse(startsAt) : startsAt.getTime()
  if (!Number.isFinite(ms)) return undefined
  return slots.find((s) => Date.parse(s.startsAt) === ms)
}
