import assert from 'node:assert/strict'
import { buildBookingPaymentMetadata, parseBookingPaymentMetadata } from './stripe-metadata'

{
  const metadata = buildBookingPaymentMetadata('booking-1')
  assert.deepEqual(metadata, { bookingId: 'booking-1' })
  assert.equal(parseBookingPaymentMetadata(metadata), 'booking-1')
}

{
  assert.equal(parseBookingPaymentMetadata({}), null)
  assert.equal(parseBookingPaymentMetadata(null), null)
  assert.equal(parseBookingPaymentMetadata({ bookingId: '   ' }), null)
  assert.equal(parseBookingPaymentMetadata({ barberId: 'x' }), null)
}

console.log('stripe-metadata.test.ts: OK')
