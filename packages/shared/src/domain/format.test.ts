import assert from 'node:assert/strict'
import { test } from 'node:test'
import { centsToDollarInput, dollarsToCents, formatBookingTime, formatCents, formatClockTime, formatInTimeZone } from './format'

test('formatCents', () => {
  assert.equal(formatCents(2550), '$25.50')
  assert.equal(formatCents(340), '$3.40')
  assert.equal(formatCents(2500, { compact: true }), '$25')
  assert.equal(formatCents(null), '$0.00')
})

test('dollarsToCents / centsToDollarInput', () => {
  assert.equal(dollarsToCents('25'), 2500)
  assert.equal(dollarsToCents('25.5'), 2550)
  assert.equal(dollarsToCents('$1,025.05'), 102505)
  assert.equal(dollarsToCents(19.99), 1999)
  assert.equal(dollarsToCents('abc'), null)
  assert.equal(dollarsToCents('1.234'), null)
  assert.equal(centsToDollarInput(2550), '25.50')
})

test('times are shown in the barber time zone, not the device zone', () => {
  const instant = '2026-11-18T19:30:00.000Z'
  assert.equal(formatBookingTime(instant, 'America/New_York'), '2:30 PM')
  assert.equal(formatBookingTime(instant, 'America/Los_Angeles'), '11:30 AM')
  assert.equal(formatInTimeZone(instant, 'Asia/Tokyo', { day: 'numeric' }), '19')
  assert.equal(formatInTimeZone(instant, 'Not/AZone', { year: 'numeric' }), '2026')
})

test('formatClockTime', () => {
  assert.equal(formatClockTime('09:00:00'), '9:00 AM')
  assert.equal(formatClockTime('13:05'), '1:05 PM')
  assert.equal(formatClockTime('00:30'), '12:30 AM')
  assert.equal(formatClockTime('24:00'), '12:00 AM')
})
