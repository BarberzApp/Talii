export type ClockTime = string // "HH:MM" (optionally "HH:MM:SS" tolerated for parsing)

export interface AvailabilityWindow {
  start_time: ClockTime
  end_time: ClockTime
}

export interface SpecialHoursLike {
  is_closed?: boolean | null
  start_time?: ClockTime | null
  end_time?: ClockTime | null
}

export interface BookingTimeLike {
  date: string
  end_time?: string | null
  status?: string | null
}

export interface Slot {
  time: string // "HH:MM"
  available: boolean
  reason?: string
}

function parseClockToMinutes(clock: ClockTime): number | null {
  const parts = clock.split(':')
  if (parts.length < 2) return null
  const hh = Number(parts[0])
  const mm = Number(parts[1])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

function minutesToHHMM(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60)
  const mm = totalMinutes % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function extractHHMMFromTimestamp(ts: string): string | null {
  // Accepts ISO-ish timestamps: "YYYY-MM-DDTHH:MM..." (we intentionally treat as local clock strings)
  const tIndex = ts.indexOf('T')
  if (tIndex === -1) return null
  const timePart = ts.slice(tIndex + 1)
  if (timePart.length < 5) return null
  return timePart.slice(0, 5)
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export interface BuildSlotsInput {
  selectedDate: string // YYYY-MM-DD
  durationMinutes: number
  intervalMinutes?: number
  availabilityWindow?: AvailabilityWindow | null
  specialHours?: SpecialHoursLike | null
  bookings: BookingTimeLike[]
}

/**
 * Booking-parity availability engine.
 *
 * Timezone semantics (by design): treat availability/special_hours as plain local clock strings.
 * To keep behavior deterministic across server/client, we do *minutes-since-midnight* math and
 * extract HH:MM from booking timestamps without timezone conversion.
 */
export function buildAvailabilitySlots(input: BuildSlotsInput): Slot[] {
  const {
    selectedDate,
    durationMinutes,
    intervalMinutes,
    availabilityWindow,
    specialHours,
    bookings,
  } = input

  if (!selectedDate || typeof selectedDate !== 'string') return []
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return []

  const interval = Number.isFinite(intervalMinutes) && (intervalMinutes as number) > 0
    ? (intervalMinutes as number)
    : Math.max(durationMinutes, 10)

  // Closed day via special hours
  if (specialHours?.is_closed) return []

  // Determine working window
  let start: number | null = null
  let end: number | null = null

  if (specialHours?.start_time && specialHours?.end_time) {
    start = parseClockToMinutes(String(specialHours.start_time))
    end = parseClockToMinutes(String(specialHours.end_time))
  } else if (availabilityWindow?.start_time && availabilityWindow?.end_time) {
    start = parseClockToMinutes(String(availabilityWindow.start_time))
    end = parseClockToMinutes(String(availabilityWindow.end_time))
  }

  if (start === null || end === null || end <= start) return []

  // Build booking intervals (minutes since midnight) for same date only
  const bookingIntervals: Array<{ start: number; end: number }> = []
  for (const b of bookings || []) {
    if (!b?.date) continue
    const bookingDate = String(b.date).split('T')[0]
    if (bookingDate !== selectedDate) continue
    if (b.status === 'cancelled') continue

    const startHHMM = extractHHMMFromTimestamp(String(b.date))
    if (!startHHMM) continue
    const startMin = parseClockToMinutes(startHHMM)
    if (startMin === null) continue

    let endMin: number | null = null
    if (b.end_time) {
      const endHHMM = extractHHMMFromTimestamp(String(b.end_time))
      if (endHHMM) endMin = parseClockToMinutes(endHHMM)
    }

    // If end_time missing, treat as a point event (still blocks that start moment)
    const endFinal = endMin !== null && endMin >= startMin ? endMin : startMin
    bookingIntervals.push({ start: startMin, end: endFinal })
  }

  const slots: Slot[] = []
  for (let m = start; m < end; m += interval) {
    const slotEnd = m + durationMinutes
    if (slotEnd > end) continue

    const hasConflict = bookingIntervals.some(bi => overlaps(m, slotEnd, bi.start, bi.end))
    slots.push({
      time: minutesToHHMM(m),
      available: !hasConflict,
      reason: hasConflict ? 'conflict' : undefined,
    })
  }

  return slots
}

