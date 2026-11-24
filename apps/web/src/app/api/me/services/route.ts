import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { createService, listServices } from '@/server/catalog'
import { nullableText } from '@/server/validation'

/**
 * GET /api/me/services   (barber)
 * 200 { services: [services row, including inactive] }
 */
export const GET = defineRoute({ auth: 'barber' }, async ({ barber }) => listServices(barber.id))

/**
 * POST /api/me/services   (barber)
 * Body: { name, description?, durationMinutes (5-480), priceCents (0-100000), isActive? }
 * 201 { service }
 */
export const POST = defineRoute(
  {
    auth: 'barber',
    body: z
      .object({
        name: z.string().trim().min(1).max(80),
        description: nullableText(500),
        durationMinutes: z.number().int().min(5).max(480),
        priceCents: z.number().int().min(0).max(100_000),
        isActive: z.boolean().optional(),
      })
      .strict(),
  },
  async ({ barber, body }) =>
    Response.json(await createService(barber.id, body), { status: 201, headers: { 'Cache-Control': 'no-store' } })
)
