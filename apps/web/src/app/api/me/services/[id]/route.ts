import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { deleteService, updateService } from '@/server/catalog'
import { idParams, nullableText } from '@/server/validation'

/**
 * PATCH /api/me/services/:id   (barber, own service)
 * Body: any of { name, description, durationMinutes, priceCents, isActive }
 * 200 { service }   404 SERVICE_NOT_FOUND
 * Price and duration changes apply to new bookings only (bookings snapshot them).
 */
export const PATCH = defineRoute(
  {
    auth: 'barber',
    params: idParams,
    body: z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        description: nullableText(500),
        durationMinutes: z.number().int().min(5).max(480).optional(),
        priceCents: z.number().int().min(0).max(100_000).optional(),
        isActive: z.boolean().optional(),
      })
      .strict()
      .refine((b) => Object.values(b).some((v) => v !== undefined), 'send at least one field'),
  },
  async ({ barber, params, body }) => updateService(barber.id, params.id, body)
)

/**
 * DELETE /api/me/services/:id   (barber, own service)
 * 200 { deleted: true, deactivated: false } — or { deleted: false, deactivated: true } when bookings
 * reference it (it is set inactive instead).   404 SERVICE_NOT_FOUND
 */
export const DELETE = defineRoute({ auth: 'barber', params: idParams }, async ({ barber, params }) =>
  deleteService(barber.id, params.id)
)
