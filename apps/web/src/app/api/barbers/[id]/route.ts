import { defineRoute } from '@/server/route'
import { optionalCallerId } from '@/server/caller'
import { getBarberProfile } from '@/server/discovery'
import { idParams } from '@/server/validation'

/**
 * GET /api/barbers/:id   (public; a Bearer token is optional)
 * A listed barber's public profile. 404 BARBER_NOT_FOUND when unlisted, disabled, unknown, or
 * blocked either way with the signed-in caller.
 * 200 { barber: { id, user_id, business_name, bio, specialties, instagram, tiktok, city, state,
 *       timezone, portfolio, created_at },
 *       profile: { id, name, username, avatar_url, cover_photo_url },
 *       services: [{ id, name, description, duration_minutes, price_cents }]  (active, cheapest first),
 *       addons: [{ id, name, description, price_cents }],
 *       rating: { review_count, average_rating | null } }
 */
export const GET = defineRoute({ auth: 'public', params: idParams }, async ({ req, params }) =>
  getBarberProfile({ id: params.id }, await optionalCallerId(req))
)
