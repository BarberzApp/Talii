// Fee calculation utilities and constants
export const TOTAL_PRICE_CENTS = 340; // $3.40 in cents (what customer pays)
export const STRIPE_FEE_CENTS = 40; // $0.40 in cents (approx. 2.9% + $0.30 on $3.40)
export const BOCM_SHARE_PERCENTAGE = 0.60; // 60%
export const BARBER_SHARE_PERCENTAGE = 0.40; // 40%

export interface FeeBreakdown {
  platformFee: number; // Total platform fee in cents ($3.40)
  stripeFee: number; // Stripe's fee in cents ($0.40) - absorbed by platform
  netAfterStripe: number; // Net amount after Stripe fee in cents ($3.00)
  bocmGrossShare: number; // Platform's gross share in cents (60% of net = $1.80)
  bocmNetShare: number; // Platform's net share after Stripe fee (180 - 40 = 140)
  barberShare: number; // Barber's share in cents (40% of net = $1.20)
}

/**
 * Calculates the breakdown of the platform fee.
 * 
 * Logic:
 * 1. Customer pays $3.40 (TOTAL_PRICE_CENTS)
 * 2. Stripe takes approx $0.40 (STRIPE_FEE_CENTS)
 * 3. Net remainder is $3.00 (netAfterStripe)
 * 4. Split $3.00 60/40:
 *    - Platform gross: $1.80 (bocmGrossShare)
 *    - Barber: $1.20 (barberShare)
 * 5. Platform absorbs the Stripe fee:
 *    - Platform net: $1.80 - $0.40 = $1.40 (bocmNetShare)
 */
export function calculateFeeBreakdown(): FeeBreakdown {
  const netAfterStripe = TOTAL_PRICE_CENTS - STRIPE_FEE_CENTS; // 300 cents
  
  const bocmGrossShare = Math.round(netAfterStripe * BOCM_SHARE_PERCENTAGE); // 180 cents
  const barberShare = Math.round(netAfterStripe * BARBER_SHARE_PERCENTAGE); // 120 cents
  
  const bocmNetShare = bocmGrossShare - STRIPE_FEE_CENTS; // 140 cents

  return {
    platformFee: TOTAL_PRICE_CENTS,
    stripeFee: STRIPE_FEE_CENTS,
    netAfterStripe,
    bocmGrossShare,
    bocmNetShare,
    barberShare
  };
}

export function calculateBarberPayout(): number {
  const { barberShare } = calculateFeeBreakdown();
  return barberShare; // 120 cents
}

export function calculatePlatformFee(): number {
  const { bocmGrossShare } = calculateFeeBreakdown();
  return bocmGrossShare; // 180 cents (this is the application_fee_amount)
}
