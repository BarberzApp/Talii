import { z } from 'zod'
import { isValidTimeZone } from '@barber-app/shared'
import { defineRoute } from '@/server/route'
import { becomeBarber } from '@/server/account'
import { optionalText } from '@/server/validation'

/**
 * POST /api/me/barber   (user)   Turns the caller into a barber (onboarding).
 * Body: { businessName?, timezone? (IANA, default America/New_York) }
 * 201 { barber, created: true } — or 200 { barber, created: false } when the caller already is one.
 * 403 BARBER_ACCESS_REMOVED when an admin demoted this barber (only an admin can restore it).
 * The listing is public by default but has no services or hours until onboarding adds them.
 */
export const POST = defineRoute(
  {
    auth: 'user',
    body: z
      .object({
        businessName: optionalText(80),
        timezone: z.string().refine(isValidTimeZone, 'must be an IANA time zone').optional(),
      })
      .strict()
      .default({}),
  },
  async ({ user, body }) => {
    const result = await becomeBarber(user.id, body)
    return Response.json(result, { status: result.created ? 201 : 200, headers: { 'Cache-Control': 'no-store' } })
  }
)
