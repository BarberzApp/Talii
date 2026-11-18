import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { deleteSpecialHours, listSpecialHours, putSpecialHours } from '@/server/schedule'
import { calendarDate, clockTime, nullableText } from '@/server/validation'

/**
 * GET /api/me/special-hours?from=YYYY-MM-DD&to=YYYY-MM-DD   (barber)
 * 200 { specialHours: [{ id, date, is_closed, start_time, end_time, reason, created_at, updated_at }] }
 * `reason` is private to the barber (not readable through the public Data API).
 */
export const GET = defineRoute(
  { auth: 'barber', query: z.object({ from: calendarDate.optional(), to: calendarDate.optional() }) },
  async ({ barber, query }) => listSpecialHours(barber.id, query)
)

/**
 * PUT /api/me/special-hours   (barber)   Creates or replaces the override for one date.
 * Body: { date, isClosed: true, reason? } | { date, isClosed: false, startTime, endTime, reason? }
 * 200 { specialHours, bookingsOutsideHours: [{ id, starts_at, ends_at, status }] }
 *     Existing bookings are not changed; the list shows active ones the new hours no longer cover.
 */
export const PUT = defineRoute(
  {
    auth: 'barber',
    body: z.discriminatedUnion('isClosed', [
      z.object({ date: calendarDate, isClosed: z.literal(true), reason: nullableText(200) }).strict(),
      z
        .object({
          date: calendarDate,
          isClosed: z.literal(false),
          startTime: clockTime,
          endTime: clockTime,
          reason: nullableText(200),
        })
        .strict(),
    ]),
  },
  async ({ barber, body }) => putSpecialHours(barber.id, barber.timezone, body)
)

/**
 * DELETE /api/me/special-hours?date=YYYY-MM-DD   (barber)
 * 200 { deleted: true }   404 SPECIAL_HOURS_NOT_FOUND
 */
export const DELETE = defineRoute(
  { auth: 'barber', query: z.object({ date: calendarDate }) },
  async ({ barber, query }) => deleteSpecialHours(barber.id, query.date)
)
