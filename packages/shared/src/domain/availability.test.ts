import assert from 'node:assert/strict'
import { buildAvailabilitySlots } from './availability'

function times(slots: Array<{ time: string; available: boolean }>) {
  return slots.map(s => `${s.time}:${s.available ? 'y' : 'n'}`)
}

// 1) special hours closed → no slots
{
  const slots = buildAvailabilitySlots({
    selectedDate: '2026-01-01',
    durationMinutes: 30,
    bookings: [],
    specialHours: { is_closed: true },
    availabilityWindow: { start_time: '09:00', end_time: '17:00' },
  })
  assert.equal(slots.length, 0)
}

// 2) special hours override availability
{
  const slots = buildAvailabilitySlots({
    selectedDate: '2026-01-01',
    durationMinutes: 30,
    bookings: [],
    specialHours: { start_time: '10:00', end_time: '11:00' },
    availabilityWindow: { start_time: '09:00', end_time: '17:00' },
  })
  assert.deepEqual(times(slots), ['10:00:y', '10:30:y'])
}

// 3) duration/interval stepping (min interval=max(duration,10))
{
  const slots = buildAvailabilitySlots({
    selectedDate: '2026-01-01',
    durationMinutes: 45,
    bookings: [],
    availabilityWindow: { start_time: '09:00', end_time: '11:00' },
  })
  // 09:00-09:45, 09:45-10:30, 10:30-11:15 (last one should be excluded)
  assert.deepEqual(times(slots), ['09:00:y', '09:45:y'])
}

// 4) overlap exclusion against bookings using date/end_time
{
  const slots = buildAvailabilitySlots({
    selectedDate: '2026-01-01',
    durationMinutes: 30,
    bookings: [
      { date: '2026-01-01T09:15:00.000Z', end_time: '2026-01-01T09:45:00.000Z', status: 'confirmed' },
    ],
    availabilityWindow: { start_time: '09:00', end_time: '10:00' },
    intervalMinutes: 15,
  })
  // Slots: 09:00-09:30 overlaps; 09:15-09:45 overlaps; 09:30-10:00 overlaps (09:30-09:45)
  assert.deepEqual(times(slots), ['09:00:n', '09:15:n', '09:30:n'])
}

console.log('availability.test.ts: OK')

