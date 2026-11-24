import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { deleteAddon, updateAddon } from '@/server/catalog'
import { idParams, nullableText } from '@/server/validation'

/**
 * PATCH /api/me/addons/:id   (barber, own add-on)
 * Body: any of { name, description, priceCents, isActive }
 * 200 { addon }   404 ADDON_NOT_FOUND
 */
export const PATCH = defineRoute(
  {
    auth: 'barber',
    params: idParams,
    body: z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        description: nullableText(500),
        priceCents: z.number().int().min(0).max(100_000).optional(),
        isActive: z.boolean().optional(),
      })
      .strict()
      .refine((b) => Object.values(b).some((v) => v !== undefined), 'send at least one field'),
  },
  async ({ barber, params, body }) => updateAddon(barber.id, params.id, body)
)

/**
 * DELETE /api/me/addons/:id   (barber, own add-on)
 * 200 { deleted: true, deactivated: false } — or { deleted: false, deactivated: true } when bookings
 * reference it.   404 ADDON_NOT_FOUND
 */
export const DELETE = defineRoute({ auth: 'barber', params: idParams }, async ({ barber, params }) =>
  deleteAddon(barber.id, params.id)
)
