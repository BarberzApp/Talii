# Fee Calculator Update Summary

**Date:** December 11, 2024
**Issue:** Fee calculation didn't account for Stripe's $0.38 fee
**Status:** **FIXED**

---

## **Problem**

The fee calculation was splitting $3.38 directly 60/40, but Stripe takes $0.38 first, leaving $3.00 to split.

**Old Calculation:**
- Customer pays: $3.38
- BOCM gets: $2.03 (60% of $3.38) **WRONG**
- Barber gets: $1.35 (40% of $3.38) **WRONG**

**Correct Calculation:**
- Customer pays: $3.38
- Stripe fee: $0.38
- Net after Stripe: $3.00
- BOCM gets: $1.80 (60% of $3.00)
- Barber gets: $1.20 (40% of $3.00)

---

## **What Was Fixed**

### **1. Edge Function (`create-payment-intent/index.ts`)**
- Updated to account for Stripe's $0.38 fee
- Splits $3.00 (net after Stripe) 60/40
- BOCM: $1.80, Barber: $1.20

### **2. Website Fee Calculator (`src/shared/lib/fee-calculator.ts`)**
- Added `STRIPE_FEE_CENTS = 38` constant
- Updated `calculateFeeBreakdown()` to account for Stripe fee
- Returns `stripeFee` and `netAfterStripe` in breakdown
- Updated `calculateBarberPayout()` and `calculatePlatformFee()` to use net amount

### **3. Landing Page Calculator (`src/app/landing/landing-page.tsx`)**
- Updated from $1.35 to $1.20 per cut
- Updated display text: "$1.35" → "$1.20"
- Updated initial state: `135` → `120`

### **4. Test File Created (`src/shared/lib/__tests__/fee-calculator.test.ts`)**
- Comprehensive test suite with 8 test cases
- Tests fee breakdown calculation
- Tests barber payout calculation
- Tests platform fee calculation
- Verifies math: shares add up correctly

---

## **New Fee Breakdown**

| Item | Amount | Notes |
|------|--------|-------|
| **Customer Pays** | $3.38 | Platform fee only |
| **Stripe Fee** | -$0.38 | Stripe's processing fee (2.9% + $0.30) |
| **Net After Stripe** | $3.00 | Amount available to split |
| **BOCM (60%)** | $1.80 | Platform's share |
| **Barber (40%)** | $1.20 | Barber's share |

---

## **Code Changes**

### **Edge Function:**
```typescript
// Before:
const bocmShare = Math.round(platformFee * 0.60) // $2.03

// After:
const stripeFee = 38 // $0.38
const netAfterStripe = platformFee - stripeFee // $3.00
const bocmShare = Math.round(netAfterStripe * 0.60) // $1.80
const barberShare = Math.round(netAfterStripe * 0.40) // $1.20
```

### **Fee Calculator:**
```typescript
// Before:
export function calculateFeeBreakdown(): FeeBreakdown {
 const bocmShare = Math.round(PLATFORM_FEE_CENTS * 0.60) // $2.03
 const barberShare = PLATFORM_FEE_CENTS - bocmShare // $1.35
}

// After:
export function calculateFeeBreakdown(): FeeBreakdown {
 const netAfterStripe = PLATFORM_FEE_CENTS - STRIPE_FEE_CENTS // $3.00
 const bocmShare = Math.round(netAfterStripe * 0.60) // $1.80
 const barberShare = Math.round(netAfterStripe * 0.40) // $1.20
}
```

### **Landing Page:**
```typescript
// Before:
const bonus = cuts * 1.35; //

// After:
const bonus = cuts * 1.20; // (40% of $3.00)
```

---

## **Test Coverage**

Created comprehensive test suite with 8 test cases:

1. Correct fee breakdown accounting for Stripe fee
2. Shares add up to net after Stripe
3. Platform fee equals Stripe fee + net
4. Correct percentage calculations
5. Barber payout for fee-only payments
6. Barber payout for full payments
7. Platform fee calculation
8. Complete fee breakdown summary

---

## **Files Updated**

1. `supabase/functions/create-payment-intent/index.ts`
2. `src/shared/lib/fee-calculator.ts`
3. `src/app/landing/landing-page.tsx`
4. `src/shared/lib/__tests__/fee-calculator.test.ts` (new)

---

## **Next Steps**

1. **Deploy Edge Function** to Supabase
2. **Run Tests** to verify calculations
3. **Test Booking Flow** to ensure correct charges
4. **Verify Landing Page** shows correct $1.20 per cut

---

## **Verification**

To verify the fix works:

1. **Edge Function:**
 - Customer should be charged exactly $3.38
 - BOCM should receive $1.80
 - Barber should receive $1.20

2. **Website Calculator:**
 - Landing page should show "$1.20 per cut"
 - Calculator should calculate: `cuts × $1.20`

3. **Tests:**
 - Run: `npm test -- fee-calculator.test.ts`
 - All 8 tests should pass

---

## **Summary**

The fee calculation now correctly accounts for Stripe's $0.38 fee and splits the remaining $3.00 60/40 between BOCM and the barber. All related code has been updated to reflect this change.

