import assert from 'node:assert/strict'
import {
  buildAvailabilitySlots,
  dayOfWeekForDate,
  findSlot,
  isValidTimeZone,
  localDateInTimeZone,
  localDayBounds,
  zonedTimeToUtc,
  type Slot,
} from './availability'

function times(slots: Slot[]) {
  return slots.map((s) => `${s.time}:${s.available ? 'y' : 'n'}`)
}

const base = { busy: [], windows: [{ start_time: '09:00', end_time: '17:00' }] }

// 1) special hours closed → no slots
{
  const slots = buildAvailabilitySlots({
    ...base,
    date: '2026-01-01',
    timeZone: 'UTC',
    durationMinutes: 30,
    specialHours: { is_closed: true },
  })
  assert.equal(slots.length, 0)
}

// 2) special hours replace the weekly windows
{
  const slots = buildAvailabilitySlots({
    ...base,
    date: '2026-01-01',
    timeZone: 'UTC',
    durationMinutes: 30,
    intervalMinutes: 30,
    specialHours: { start_time: '10:00:00', end_time: '11:00:00' },
  })
  assert.deepEqual(times(slots), ['10:00:y', '10:30:y'])
}

// 3) default 15-minute grid; a slot must end by the window end
{
  const slots = buildAvailabilitySlots({
    busy: [],
    windows: [{ start_time: '09:00', end_time: '11:00' }],
    date: '2026-01-01',
    timeZone: 'UTC',
    durationMinutes: 45,
  })
  assert.deepEqual(times(slots), ['09:00:y', '09:15:y', '09:30:y', '09:45:y', '10:00:y', '10:15:y'])
}

// 4) non-UTC zone: New York in winter is UTC-5; busy instants are compared as instants,
//    and back-to-back bookings do not conflict
{
  const slots = buildAvailabilitySlots({
    windows: [{ start_time: '09:00', end_time: '10:00' }],
    busy: [{ startsAt: '2026-01-15T14:00:00Z', endsAt: '2026-01-15T14:30:00Z' }],
    date: '2026-01-15',
    timeZone: 'America/New_York',
    durationMinutes: 30,
  })
  assert.deepEqual(times(slots), ['09:00:n', '09:15:n', '09:30:y'])
  assert.equal(slots[0].startsAt, '2026-01-15T14:00:00.000Z')
  assert.equal(slots[0].reason, 'booked')
  assert.equal(slots[2].endsAt, '2026-01-15T15:00:00.000Z')
}

// 5) a zone ahead of UTC: Tokyo 09:00 on June 1 is 00:00Z on June 1, and a booking that
//    starts on the previous UTC date still blocks it (the old engine compared date strings)
{
  const slots = buildAvailabilitySlots({
    windows: [{ start_time: '09:00', end_time: '10:00' }],
    busy: [{ startsAt: '2026-05-31T23:30:00Z', endsAt: '2026-06-01T00:30:00Z' }],
    date: '2026-06-01',
    timeZone: 'Asia/Tokyo',
    durationMinutes: 30,
    intervalMinutes: 30,
  })
  assert.deepEqual(times(slots), ['09:00:n', '09:30:y'])
  assert.equal(slots[0].startsAt, '2026-06-01T00:00:00.000Z')
  assert.equal(localDateInTimeZone('2026-05-31T23:30:00Z', 'Asia/Tokyo'), '2026-06-01')
}

// 6) DST spring forward (New York, 2026-03-08, 02:00 → 03:00): 01:00-04:00 local is only
//    two real hours; slots run in real time and skip the missing hour
{
  const slots = buildAvailabilitySlots({
    windows: [{ start_time: '01:00', end_time: '04:00' }],
    busy: [],
    date: '2026-03-08',
    timeZone: 'America/New_York',
    durationMinutes: 60,
    intervalMinutes: 30,
  })
  assert.deepEqual(times(slots), ['01:00:y', '01:30:y', '03:00:y'])
  assert.deepEqual(
    slots.map((s) => s.startsAt),
    ['2026-03-08T06:00:00.000Z', '2026-03-08T06:30:00.000Z', '2026-03-08T07:00:00.000Z']
  )
  // A wall time inside the gap moves forward by the gap (02:30 → 03:30 EDT).
  assert.equal(zonedTimeToUtc('2026-03-08', 150, 'America/New_York').toISOString(), '2026-03-08T07:30:00.000Z')
  // The local day is 23 hours long.
  const day = localDayBounds('2026-03-08', 'America/New_York')
  assert.equal(day.start.toISOString(), '2026-03-08T05:00:00.000Z')
  assert.equal(day.end.toISOString(), '2026-03-09T04:00:00.000Z')
}

// 7) DST fall back (New York, 2026-11-01, 02:00 → 01:00): 00:00-03:00 local is four real
//    hours, so the repeated 01:00 hour yields two distinct slots
{
  const slots = buildAvailabilitySlots({
    windows: [{ start_time: '00:00', end_time: '03:00' }],
    busy: [{ startsAt: '2026-11-01T06:00:00Z', endsAt: '2026-11-01T07:00:00Z' }],
    date: '2026-11-01',
    timeZone: 'America/New_York',
    durationMinutes: 60,
    intervalMinutes: 60,
  })
  assert.deepEqual(times(slots), ['00:00:y', '01:00:y', '01:00:n', '02:00:y'])
  assert.deepEqual(
    slots.map((s) => s.startsAt),
    [
      '2026-11-01T04:00:00.000Z',
      '2026-11-01T05:00:00.000Z',
      '2026-11-01T06:00:00.000Z',
      '2026-11-01T07:00:00.000Z',
    ]
  )
  // An ambiguous wall time resolves to the earlier instant (01:30 EDT).
  assert.equal(zonedTimeToUtc('2026-11-01', 90, 'America/New_York').toISOString(), '2026-11-01T05:30:00.000Z')
}

// 8) slots before now + lead time are unavailable ("past")
{
  const slots = buildAvailabilitySlots({
    windows: [{ start_time: '09:00', end_time: '10:00' }],
    busy: [],
    date: '2026-01-15',
    timeZone: 'Europe/London',
    durationMinutes: 30,
    now: new Date('2026-01-15T09:05:00Z'),
    minLeadMinutes: 10,
  })
  assert.deepEqual(times(slots), ['09:00:n', '09:15:y', '09:30:y'])
  assert.equal(slots[0].reason, 'past')
}

// 9) several windows (split shift), overlapping windows de-duplicated, "24:00" end
{
  const slots = buildAvailabilitySlots({
    windows: [
      { start_time: '22:00', end_time: '24:00:00' },
      { start_time: '09:00', end_time: '10:00' },
      { start_time: '09:00', end_time: '09:30' },
    ],
    busy: [],
    date: '2026-01-15',
    timeZone: 'America/Los_Angeles',
    durationMinutes: 60,
    intervalMinutes: 60,
  })
  assert.deepEqual(times(slots), ['09:00:y', '22:00:y', '23:00:y'])
  assert.equal(slots[2].endsAt, '2026-01-16T08:00:00.000Z')
}

// 10) invalid input → no slots; helpers
{
  assert.deepEqual(
    buildAvailabilitySlots({ ...base, date: '2026-02-30', timeZone: 'UTC', durationMinutes: 30 }),
    []
  )
  assert.deepEqual(
    buildAvailabilitySlots({ ...base, date: '2026-01-01', timeZone: 'Not/AZone', durationMinutes: 30 }),
    []
  )
  assert.equal(isValidTimeZone('America/Chicago'), true)
  assert.equal(isValidTimeZone('Mars/Olympus'), false)
  assert.equal(dayOfWeekForDate('2026-03-08'), 0) // a Sunday
  const slots = buildAvailabilitySlots({ ...base, date: '2026-01-01', timeZone: 'UTC', durationMinutes: 30 })
  assert.equal(findSlot(slots, '2026-01-01T09:15:00+00:00')?.time, '09:15')
  assert.equal(findSlot(slots, '2026-01-01T09:10:00Z'), undefined)
}

console.log('availability.test.ts: OK')
