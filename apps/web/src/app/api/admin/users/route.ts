import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { listUsers } from '@/server/admin'
import { queryBool, queryInt } from '@/server/validation'

/**
 * GET /api/admin/users?q=&role=client|barber&disabled=true|false&limit=&offset=   (admin)
 * q matches name, username or email (case-insensitive substring). Newest first.
 * 200 { users: [{ id, name, username, email, phone, role, is_disabled, deleted_at, avatar_url, created_at,
 *       barber: { id, business_name, is_public, listing_suspended, listed, onboarding_complete } | null,
 *       billing: { charges_enabled, details_submitted, fee_exempt } | null }],
 *       pagination: { limit, offset, total } }
 */
export const GET = defineRoute(
  {
    auth: 'admin',
    query: z.object({
      q: z.string().max(100).optional(),
      role: z.enum(['client', 'barber']).optional(),
      disabled: queryBool.optional(),
      limit: queryInt(1, 100, 25),
      offset: queryInt(0, 100_000, 0),
    }),
  },
  async ({ query }) => listUsers(query)
)
