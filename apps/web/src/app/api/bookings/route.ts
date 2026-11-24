import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { createBooking } from '@/server/bookings/create'
import { listBookings } from '@/server/bookings/list'
import { BOOKING_STATUSES } from '@/server/bookings/policy'
import { commaList, isoDateTime, optionalText, queryInt, uuid } from '@/server/validation'

/**
 * GET /api/bookings   (user)
 * Query: as=client|barber (default client), status=pending,confirmed,...,
 *        from=<ISO>, to=<ISO> (on starts_at, [from, to)), order=asc|desc (default desc),
 *        limit=1..100 (default 20), offset>=0 (default 0)
 * 200 { bookings: [...with service, addons, barber, client], pagination: { limit, offset, total } }
 */
export const GET = defineRoute(
  {
    auth: 'user',
    query: z.object({
      as: z.enum(['client', 'barber']).default('client'),
      status: commaList(z.enum(BOOKING_STATUSES)).optional(),
      from: isoDateTime.optional(),
      to: isoDateTime.optional(),
      order: z.enum(['asc', 'desc']).default('desc'),
      limit: queryInt(1, 100, 20),
      offset: queryInt(0, 100_000, 0),
    }),
  },
  async ({ user, query }) =>
    listBookings(user.id, {
      as: query.as,
      statuses: query.status,
      from: query.from,
      to: query.to,
      order: query.order,
      limit: query.limit,
      offset: query.offset,
    })
)

/**
 * POST /api/bookings   (user)
 * Body: { barberId, serviceId, startsAt (ISO instant from the availability route),
 *         addonIds?: uuid[], notes?: string }
 * 201 { booking, clientSecret }   clientSecret is null when the barber is fee-exempt
 *     (booking already confirmed); otherwise confirm it with the Payment Element.
 * Errors: 404 BARBER_NOT_FOUND, 400 CANNOT_BOOK_SELF | INVALID_SERVICE | OUTSIDE_HOURS |
 *         SLOT_IN_PAST | INVALID_SELECTION, 409 SLOT_TAKEN | BARBER_NOT_READY |
 *         BOOKING_LIMIT_REACHED (5 upcoming per barber, 10 overall), 429 TOO_MANY_HOLDS
 *         (3 unpaid holds), 502 STRIPE_ERROR
 */
export const POST = defineRoute(
  {
    auth: 'user',
    body: z.object({
      barberId: uuid,
      serviceId: uuid,
      startsAt: isoDateTime,
      addonIds: z
        .array(uuid)
        .max(20)
        .default([])
        .transform((ids) => [...new Set(ids)]),
      notes: optionalText(500),
    }),
  },
  async ({ user, body }) => {
    const result = await createBooking(user.id, body)
    return Response.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  }
)
