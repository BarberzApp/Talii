import assert from 'node:assert/strict'
import {
  bookingFeeAmounts,
  calculateBarberPayout,
  calculateFeeBreakdown,
  calculatePlatformFee,
  TOTAL_PRICE_CENTS,
  STRIPE_FEE_CENTS,
  PLATFORM_SHARE,
  BARBER_SHARE,
} from './fees'

{
  const breakdown = calculateFeeBreakdown()

  assert.equal(breakdown.platformFee, TOTAL_PRICE_CENTS)
  assert.equal(breakdown.stripeFee, STRIPE_FEE_CENTS)
  assert.equal(breakdown.netAfterStripe, TOTAL_PRICE_CENTS - STRIPE_FEE_CENTS)
  assert.equal(breakdown.platformGrossShare, Math.round(breakdown.netAfterStripe * PLATFORM_SHARE))
  assert.equal(breakdown.barberShare, Math.round(breakdown.netAfterStripe * BARBER_SHARE))
  assert.equal(breakdown.platformNetShare, breakdown.platformGrossShare - STRIPE_FEE_CENTS)
  assert.equal(breakdown.platformGrossShare + breakdown.barberShare, breakdown.netAfterStripe)

  // The fixed numbers the business agreed on.
  assert.equal(breakdown.platformFee, 340)
  assert.equal(breakdown.applicationFeeAmount, 220)
  assert.equal(breakdown.barberShare, 120)
  assert.equal(breakdown.platformNetShare, 140)
  assert.equal(calculateBarberPayout(), 120)
  assert.equal(calculatePlatformFee(), 220)
  assert.equal(breakdown.platformFee - breakdown.applicationFeeAmount, breakdown.barberShare)
}

{
  assert.deepEqual(bookingFeeAmounts(false), {
    bookingFeeCents: 340,
    applicationFeeCents: 220,
    barberFeeShareCents: 120,
  })
  assert.deepEqual(bookingFeeAmounts(true), {
    bookingFeeCents: 0,
    applicationFeeCents: 0,
    barberFeeShareCents: 0,
  })
}

console.log('fees.test.ts: OK')
