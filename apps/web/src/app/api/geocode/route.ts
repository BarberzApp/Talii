import { z } from 'zod'
import { ApiError } from '@/server/errors'
import { defineRoute } from '@/server/route'
import { autocompleteAddress, geocodeAddress, reverseGeocode } from '@/server/geocode'
import { limiters } from '@/server/rate-limit'

/**
 * GET /api/geocode   (user)   Google Maps proxy, US only. Replaces /api/nominatim with the same
 * query parameters and response shapes. Signed-in users only (every call costs money; no public
 * page needs it — see docs/development/ENV.md for the key's restrictions and quota).
 * 30 requests per minute per user.
 *   ?q=<text>                         Places Autocomplete → [GeocodeResult] (at most 3, with coordinates)
 *   ?q=<text>&type=geocode            Geocoding → [GeocodeResult] (at most 5)
 *   ?city=&state=[&type=geocode]      text built as "city, state"
 *   ?latlng=<lat,lon>&type=reverse    Reverse geocoding → { name, city, state, country } | null
 * GeocodeResult: { place_id, display_name, lat, lon (strings), address: { house_number, road, city,
 *                  state, postcode, country } }
 * Errors: 401 UNAUTHORIZED, 400 VALIDATION_ERROR, 429 RATE_LIMITED, 502 GEOCODING_FAILED,
 *         503 GEOCODING_UNAVAILABLE
 */
export const GET = defineRoute(
  {
    auth: 'user',
    query: z
      .object({
        type: z.enum(['autocomplete', 'geocode', 'reverse']).default('autocomplete'),
        q: z.string().trim().min(1).max(200).optional(),
        city: z.string().trim().min(1).max(80).optional(),
        state: z.string().trim().min(1).max(40).optional(),
        latlng: z
          .string()
          .regex(/^-?\d{1,2}(\.\d+)?,-?\d{1,3}(\.\d+)?$/, 'must be "lat,lon"')
          .optional(),
      })
      .refine((v) => (v.type === 'reverse' ? !!v.latlng : !!(v.q || v.city || v.state)), 'missing query'),
  },
  async ({ user, query }) => {
    if (!limiters.geocode.hit(`user:${user.id}`)) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.')
    }

    if (query.type === 'reverse') {
      const [lat, lon] = (query.latlng as string).split(',').map(Number)
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'query.latlng: out of range')
      }
      // A bare null would become {} through defineRoute; send it explicitly.
      return Response.json(await reverseGeocode(lat, lon), { headers: { 'Cache-Control': 'no-store' } })
    }

    const text = query.city || query.state ? [query.city, query.state].filter(Boolean).join(', ') : (query.q as string)
    return query.type === 'geocode' ? geocodeAddress(text) : autocompleteAddress(text)
  }
)
