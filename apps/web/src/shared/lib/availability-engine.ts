// Shared domain logic shim for the web app.
// Source of truth: packages/shared
// NOTE: We import via a relative path so this works even when workspace linking isn't installed.

export { buildAvailabilitySlots } from '../../../../../packages/shared/src/domain/availability'
export type { Slot, BuildSlotsInput } from '../../../../../packages/shared/src/domain/availability'

