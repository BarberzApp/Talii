import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { optionalCallerId } from '@/server/caller'
import { listBarberReviews } from '@/server/discovery'
import { idParams, queryInt } from '@/server/validation'

/**
 * GET /api/barbers/:id/reviews?limit=&offset=   (public; a Bearer token is optional)
 * Visible reviews of a listed barber, newest first (from the public_reviews view). With a valid
 * token, reviews by users blocked either way are left out.
 * 200 { reviews: [{ id, barber_id, rating, comment, created_at, reviewer_name, reviewer_avatar_url }],
 *       rating: { review_count, average_rating | null }, pagination: { limit, offset, total } }
 */
export const GET = defineRoute(
  {
    auth: 'public',
    params: idParams,
    query: z.object({ limit: queryInt(1, 50, 20), offset: queryInt(0, 100_000, 0) }),
  },
  async ({ req, params, query }) => listBarberReviews(params.id, await optionalCallerId(req), query)
)
