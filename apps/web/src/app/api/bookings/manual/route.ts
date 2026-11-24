import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { createManualBooking } from '@/server/bookings/manual'
import { isoDateTime, optionalText, uuid } from '@/server/validation'

/**
 * POST /api/bookings/manual   (barber)
 * A walk-in or phone booking on the caller's own calendar. No payment, confirmed at once.
 * Body: { serviceId (one of the caller's services), startsAt (ISO), customerName, notes? }
 * 201 { booking }
 * Errors: 400 INVALID_SERVICE, 409 SLOT_TAKEN
 */
export const POST = defineRoute(
  {
    auth: 'barber',
    body: z.object({
      serviceId: uuid,
      startsAt: isoDateTime,
      customerName: z.string().trim().min(1).max(100),
      notes: optionalText(500),
    }),
  },
  async ({ barber, body }) => {
    const booking = await createManualBooking(barber.id, body)
    return Response.json({ booking }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  }
)
