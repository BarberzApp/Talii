import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { listReviewsForModeration } from '@/server/admin'
import { queryBool, queryInt, uuid } from '@/server/validation'

/**
 * GET /api/admin/reviews?hidden=true|false&barberId=&limit=&offset=   (admin)   Includes hidden reviews.
 * 200 { reviews: [{ id, booking_id, barber_id, client_id, rating, comment, is_hidden, created_at,
 *       updated_at, reviewer_username, barber_business_name }], pagination: { limit, offset, total } }
 */
export const GET = defineRoute(
  {
    auth: 'admin',
    query: z.object({
      hidden: queryBool.optional(),
      barberId: uuid.optional(),
      limit: queryInt(1, 100, 25),
      offset: queryInt(0, 100_000, 0),
    }),
  },
  async ({ query }) => listReviewsForModeration(query)
)
