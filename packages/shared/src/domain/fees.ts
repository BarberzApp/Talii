// Booking fee model. Integer cents throughout.
//
// The customer pays only the booking fee online; the service itself is paid in
// person. The fee is a Stripe destination charge: the platform keeps the
// application fee and the barber's connected account receives the rest.
export const TOTAL_PRICE_CENTS = 340 // $3.40 booking fee the customer pays
export const STRIPE_FEE_CENTS = 40 // ~$0.40 (2.9% + $0.30 on $3.40), absorbed by the platform
export const PLATFORM_SHARE = 0.6 // platform's share of the fee after Stripe's cut
export const BARBER_SHARE = 0.4 // barber's share of the fee after Stripe's cut

export interface FeeBreakdown {
  platformFee: number // Total booking fee in cents (340)
  stripeFee: number // Stripe's fee in cents (40), absorbed by the platform
  netAfterStripe: number // Fee after Stripe's cut (300)
  platformGrossShare: number // Platform's share of the net (60% = 180)
  platformNetShare: number // Platform's share after paying Stripe (180 - 40 = 140)
  barberShare: number // Barber's share of the net (40% = 120)
  applicationFeeAmount: number // Withheld by the platform on the charge (340 - 120 = 220)
}

/**
 * Breakdown of the booking fee:
 * 1. Customer pays 340.
 * 2. Stripe takes about 40; 300 remains.
 * 3. 300 splits 60/40: platform 180, barber 120.
 * 4. The platform absorbs Stripe's fee: platform nets 140.
 * 5. For a destination charge the transfer is amount - application_fee_amount,
 *    so application_fee_amount = 340 - 120 = 220 and the barber gets exactly 120.
 */
export function calculateFeeBreakdown(): FeeBreakdown {
  const netAfterStripe = TOTAL_PRICE_CENTS - STRIPE_FEE_CENTS
  const platformGrossShare = Math.round(netAfterStripe * PLATFORM_SHARE)
  const barberShare = Math.round(netAfterStripe * BARBER_SHARE)

  return {
    platformFee: TOTAL_PRICE_CENTS,
    stripeFee: STRIPE_FEE_CENTS,
    netAfterStripe,
    platformGrossShare,
    platformNetShare: platformGrossShare - STRIPE_FEE_CENTS,
    barberShare,
    applicationFeeAmount: TOTAL_PRICE_CENTS - barberShare,
  }
}

export function calculateBarberPayout(): number {
  return calculateFeeBreakdown().barberShare // 120
}

export function calculatePlatformFee(): number {
  return calculateFeeBreakdown().applicationFeeAmount // 220
}

/** The fee columns stored on a booking (all 0 when the barber is fee-exempt). */
export interface BookingFeeAmounts {
  bookingFeeCents: number
  applicationFeeCents: number
  barberFeeShareCents: number
}

export function bookingFeeAmounts(feeExempt: boolean): BookingFeeAmounts {
  if (feeExempt) return { bookingFeeCents: 0, applicationFeeCents: 0, barberFeeShareCents: 0 }
  const fee = calculateFeeBreakdown()
  return {
    bookingFeeCents: fee.platformFee,
    applicationFeeCents: fee.applicationFeeAmount,
    barberFeeShareCents: fee.barberShare,
  }
}
