import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { optionalCallerId } from '@/server/caller'
import { getBarberProfile } from '@/server/discovery'

/**
 * GET /api/barbers/by-username/:username   (public; a Bearer token is optional)
 * Same response as GET /api/barbers/:id; the username matches ignoring case. Used by /book/[username].
 */
export const GET = defineRoute(
  { auth: 'public', params: z.object({ username: z.string().regex(/^[A-Za-z0-9_]{3,30}$/, 'invalid username') }) },
  async ({ req, params }) => getBarberProfile({ username: params.username }, await optionalCallerId(req))
)
