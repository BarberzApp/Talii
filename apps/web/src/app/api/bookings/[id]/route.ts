import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { applyBookingAction } from '@/server/bookings/update'
import { idParams, optionalText } from '@/server/validation'

/**
 * PATCH /api/bookings/:id   (user)
 * Body: { action: "cancel", reason?: string } — client or owning barber, while pending/confirmed
 *         and before the start time. A paid fee is refunded in full when the barber cancels,
 *         or when the client cancels more than 24 hours before the start; otherwise not.
 *       { action: "complete" } | { action: "no_show" } — owning barber, confirmed, after start.
 * 200 { booking, refund: { id, amountCents, status } | null }
 * Errors: 404 BOOKING_NOT_FOUND, 403 FORBIDDEN, 409 BOOKING_NOT_CANCELLABLE | INVALID_STATUS |
 *         TOO_EARLY | TOO_LATE_TO_CANCEL | BOOKING_CHANGED, 502 STRIPE_ERROR
 */
export const PATCH = defineRoute(
  {
    auth: 'user',
    params: idParams,
    body: z.discriminatedUnion('action', [
      z.object({ action: z.literal('cancel'), reason: optionalText(500) }),
      z.object({ action: z.literal('complete') }),
      z.object({ action: z.literal('no_show') }),
    ]),
  },
  async ({ user, params, body }) => applyBookingAction(user.id, params.id, body)
)
