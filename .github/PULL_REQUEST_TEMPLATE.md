## Summary
- What changed and why (1-3 bullets)

## How To Fill This Out
- If you touched shared logic, check the parity items and add/adjust tests.
- List the exact test commands you ran (or mark N/A with a reason).

## Backend Parity Checklist
- [ ] Shared domain logic updated in `packages/shared` (not duplicated in apps)
- [ ] Parity tests updated for availability/fees/metadata (or N/A)
- [ ] Web + mobile behavior reviewed for parity impact (or N/A)

## Testing Strategy (select one)
- [ ] Jest only (web/mobile app tests)
- [ ] Node test runner for shared logic + Jest for apps
- [ ] Vitest for shared logic + Jest for apps (justify if chosen)

## Core Logic Touched (check if applicable)
- [ ] Auth/session
- [ ] Booking/availability
- [ ] Payments/Stripe metadata
- [ ] Fees/payout logic
- [ ] Notifications/observability

## Verification
- [ ] Tests run (list commands or mark N/A)
  - 