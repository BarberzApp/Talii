import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { getEarnings } from '@/server/earnings'
import { instantOrDate, queryInt } from '@/server/validation'

/**
 * GET /api/earnings?from=&to=&limit=&offset=   (barber)
 * from/to: ISO instant or YYYY-MM-DD (UTC midnight); appointments with starts_at in
 * [from, to). Defaults to the last 30 days. Max 366 days. Totals cover the whole
 * range; the booking list is one page (limit 1..500, default 100).
 * 200 { from, to, currency, totals: { feeShareEarnedCents, feeShareReversedCents,
 *       netFeeShareCents, refundedToClientsCents, completedBookings, noShowBookings,
 *       cancelledBookings, upcomingBookings, serviceRevenueCents },
 *       bookings: [{ id, startsAt, status, source, paymentStatus, customerName, serviceName,
 *       servicePriceCents, addonTotalCents, feeShareCents }],
 *       pagination: { limit, offset, total }, truncated }
 */
export const GET = defineRoute(
  {
    auth: 'barber',
    query: z.object({
      from: instantOrDate.optional(),
      to: instantOrDate.optional(),
      limit: queryInt(1, 500, 100),
      offset: queryInt(0, 100_000, 0),
    }),
  },
  async ({ barber, query }) => {
    const to = query.to ?? new Date()
    const from = query.from ?? new Date(to.getTime() - 30 * 86_400_000)
    return getEarnings(barber.id, from, to, { limit: query.limit, offset: query.offset })
  }
)
