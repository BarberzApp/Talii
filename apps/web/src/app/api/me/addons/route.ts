import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { createAddon, listAddons } from '@/server/catalog'
import { nullableText } from '@/server/validation'

/**
 * GET /api/me/addons   (barber)
 * 200 { addons: [service_addons row, including inactive] }
 */
export const GET = defineRoute({ auth: 'barber' }, async ({ barber }) => listAddons(barber.id))

/**
 * POST /api/me/addons   (barber)
 * Body: { name, description?, priceCents (0-100000), isActive? }
 * 201 { addon }
 */
export const POST = defineRoute(
  {
    auth: 'barber',
    body: z
      .object({
        name: z.string().trim().min(1).max(80),
        description: nullableText(500),
        priceCents: z.number().int().min(0).max(100_000),
        isActive: z.boolean().optional(),
      })
      .strict(),
  },
  async ({ barber, body }) =>
    Response.json(await createAddon(barber.id, body), { status: 201, headers: { 'Cache-Control': 'no-store' } })
)
