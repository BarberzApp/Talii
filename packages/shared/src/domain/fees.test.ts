import assert from 'node:assert/strict'
import {
  calculateFeeBreakdown,
  TOTAL_PRICE_CENTS,
  STRIPE_FEE_CENTS,
  BOCM_SHARE_PERCENTAGE,
  BARBER_SHARE_PERCENTAGE,
} from './fees'

{
  const breakdown = calculateFeeBreakdown()

  assert.equal(breakdown.platformFee, TOTAL_PRICE_CENTS)
  assert.equal(breakdown.stripeFee, STRIPE_FEE_CENTS)
  assert.equal(breakdown.netAfterStripe, TOTAL_PRICE_CENTS - STRIPE_FEE_CENTS)

  assert.equal(
    breakdown.bocmGrossShare,
    Math.round(breakdown.netAfterStripe * BOCM_SHARE_PERCENTAGE)
  )
  assert.equal(
    breakdown.barberShare,
    Math.round(breakdown.netAfterStripe * BARBER_SHARE_PERCENTAGE)
  )
  assert.equal(breakdown.bocmNetShare, breakdown.bocmGrossShare - STRIPE_FEE_CENTS)
}

console.log('fees.test.ts: OK')
