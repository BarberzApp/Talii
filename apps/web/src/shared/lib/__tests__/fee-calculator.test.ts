import { describe, it, expect } from '@jest/globals'
import { 
  calculateFeeBreakdown, 
  calculateBarberPayout, 
  calculatePlatformFee,
  TOTAL_PRICE_CENTS,
  STRIPE_FEE_CENTS,
  BOCM_SHARE_PERCENTAGE,
  BARBER_SHARE_PERCENTAGE
} from '../fee-calculator'

describe('Fee Calculator', () => {
  describe('calculateFeeBreakdown', () => {
    it('should calculate correct fee breakdown accounting for Stripe fee', () => {
      const breakdown = calculateFeeBreakdown()
      
      // Customer pays $3.40
      expect(breakdown.platformFee).toBe(340) // $3.40 in cents
      
      // Stripe takes $0.40
      expect(breakdown.stripeFee).toBe(40) // $0.40 in cents
      
      // Net after Stripe: $3.40 - $0.40 = $3.00
      expect(breakdown.netAfterStripe).toBe(300) // $3.00 in cents
      
      // BOCM gets 60% of net: $3.00 * 0.60 = $1.80
      expect(breakdown.bocmGrossShare).toBe(180) // $1.80 in cents
      
      // Barber gets 40% of net: $3.00 * 0.40 = $1.20
      expect(breakdown.barberShare).toBe(120) // $1.20 in cents
      
      // applicationFeeAmount must equal total - barber_share
      expect(breakdown.applicationFeeAmount).toBe(220) // $2.20 in cents
    })

    it('should ensure bocmGrossShare + barberShare equals netAfterStripe', () => {
      const breakdown = calculateFeeBreakdown()
      
      // The shares should add up to the net amount after Stripe
      expect(breakdown.bocmGrossShare + breakdown.barberShare).toBe(breakdown.netAfterStripe)
      expect(breakdown.bocmGrossShare + breakdown.barberShare).toBe(300) // $3.00
    })

    it('should ensure platformFee equals stripeFee + netAfterStripe', () => {
      const breakdown = calculateFeeBreakdown()
      
      // Total should equal Stripe fee + net amount
      expect(breakdown.platformFee).toBe(breakdown.stripeFee + breakdown.netAfterStripe)
      expect(breakdown.platformFee).toBe(340) // $3.40
    })

    it('should calculate correct percentages', () => {
      const breakdown = calculateFeeBreakdown()
      
      // BOCM should get 60% of net
      const expectedBocmShare = Math.round(breakdown.netAfterStripe * BOCM_SHARE_PERCENTAGE)
      expect(breakdown.bocmGrossShare).toBe(expectedBocmShare)
      
      // Barber should get 40% of net
      const expectedBarberShare = Math.round(breakdown.netAfterStripe * BARBER_SHARE_PERCENTAGE)
      expect(breakdown.barberShare).toBe(expectedBarberShare)
    })
  })

  describe('calculateBarberPayout', () => {
    it('should return barber share for fee-only payments', () => {
      const payout = calculateBarberPayout()
      
      // For fee-only, barber only gets their share of the fee ($1.20)
      // Service is paid directly at appointment, not through Stripe
      expect(payout).toBe(120) // $1.20 in cents
    })
  })

  describe('calculatePlatformFee', () => {
    it('should return the correct application_fee_amount', () => {
      const platformFee = calculatePlatformFee()
      
      // Platform withholds enough to ensure barber gets exactly $1.20
      // $3.40 - $1.20 = $2.20 (220 cents)
      expect(platformFee).toBe(220) // $2.20 in cents
    })

    it('should match applicationFeeAmount from calculateFeeBreakdown', () => {
      const platformFee = calculatePlatformFee()
      const { applicationFeeAmount } = calculateFeeBreakdown()
      
      expect(platformFee).toBe(applicationFeeAmount)
      expect(platformFee).toBe(220) // $2.20
    })
  })

  describe('Fee Breakdown Summary', () => {
    it('should provide correct fee breakdown summary', () => {
      const breakdown = calculateFeeBreakdown()
      
      // Summary:
      // Customer pays: $3.40
      // Stripe fee: $0.40
      // Net after Stripe: $3.00
      // BOCM receives: $1.80 (60%)
      // Barber receives: $1.20 (40%)
      // Withheld by platform (applicationFeeAmount): $3.40 - $1.20 = $2.20
      
      expect(breakdown.platformFee).toBe(340) // $3.40
      expect(breakdown.stripeFee).toBe(40) // $0.40
      expect(breakdown.netAfterStripe).toBe(300) // $3.00
      expect(breakdown.bocmGrossShare).toBe(180) // $1.80
      expect(breakdown.barberShare).toBe(120) // $1.20
      expect(breakdown.applicationFeeAmount).toBe(340 - 120) // $2.20
      
      // Verify math
      expect(breakdown.bocmGrossShare + breakdown.barberShare).toBe(breakdown.netAfterStripe)
      expect(breakdown.stripeFee + breakdown.netAfterStripe).toBe(breakdown.platformFee)
    })
  })
})
