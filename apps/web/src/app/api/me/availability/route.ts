import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { getWeek, replaceWeek } from '@/server/schedule'
import { clockTime } from '@/server/validation'

/**
 * GET /api/me/availability   (barber)
 * 200 { availability: [{ id, day_of_week (0 = Sunday), start_time "HH:MM:SS", end_time }] }
 * Times are local wall-clock in the barber's timezone.
 */
export const GET = defineRoute({ auth: 'barber' }, async ({ barber }) => getWeek(barber.id))

/**
 * PUT /api/me/availability   (barber)   Replaces the whole weekly schedule atomically.
 * Body: { windows: [{ dayOfWeek 0-6, startTime "HH:MM", endTime "HH:MM" | "24:00" }] }  (max 50; [] clears)
 * Each window needs start < end; windows on the same day must not overlap (touching is fine).
 * 200 { availability }   400 INVALID_SCHEDULE
 */
export const PUT = defineRoute(
  {
    auth: 'barber',
    body: z
      .object({
        windows: z
          .array(
            z
              .object({ dayOfWeek: z.number().int().min(0).max(6), startTime: clockTime, endTime: clockTime })
              .strict()
          )
          .max(50),
      })
      .strict(),
  },
  async ({ barber, body }) => replaceWeek(barber.id, body.windows)
)
