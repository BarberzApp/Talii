import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { optionalCallerId } from '@/server/caller'
import { listBarbers, NEARBY_MAX_RESULTS } from '@/server/discovery'
import { queryInt } from '@/server/validation'

/**
 * GET /api/barbers?lat=&lng=&radiusMiles=&q=&limit=&offset=   (public; a Bearer token is optional)
 *  lat+lng: listed barbers within radiusMiles (default 25, max 100), nearest first; q narrows them.
 *           Paging stops at the nearest 200.
 *  else:    listed barbers whose business name, name, username, city or state contains q
 *           (all listed barbers when q is empty), alphabetical.
 * With a valid token, users the caller blocked or who blocked the caller are left out.
 * 200 { barbers: [{ id, user_id, business_name, bio, specialties, city, state, name, username,
 *       avatar_url, distance_miles | null, rating: { review_count, average_rating | null } }],
 *       pagination: { limit, offset, hasMore } }
 */
export const GET = defineRoute(
  {
    auth: 'public',
    query: z
      .object({
        lat: z.coerce.number().min(-90).max(90).optional(),
        lng: z.coerce.number().min(-180).max(180).optional(),
        radiusMiles: z.coerce.number().positive().max(100).default(25),
        q: z.string().trim().max(80).optional(),
        limit: queryInt(1, 100, 20),
        offset: queryInt(0, 10_000, 0),
      })
      .refine((v) => (v.lat === undefined) === (v.lng === undefined), 'lat and lng go together')
      .refine(
        (v) => v.lat === undefined || v.offset + v.limit <= NEARBY_MAX_RESULTS,
        `nearby results stop at ${NEARBY_MAX_RESULTS}`
      ),
  },
  async ({ req, query }) => listBarbers(query, await optionalCallerId(req))
)
