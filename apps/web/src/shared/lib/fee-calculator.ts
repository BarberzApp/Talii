// Fee calculation utilities - re-exported from shared domain logic
export * from '@barber-app/shared';

// For backwards compatibility with local imports if needed
export { 
  TOTAL_PRICE_CENTS as PLATFORM_FEE_CENTS,
  STRIPE_FEE_CENTS,
  BOCM_SHARE_PERCENTAGE,
  BARBER_SHARE_PERCENTAGE,
  calculateFeeBreakdown,
  calculateBarberPayout,
  calculatePlatformFee
} from '@barber-app/shared';
