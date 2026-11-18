import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { blockUser, listBlocks } from '@/server/safety'
import { uuid } from '@/server/validation'

/**
 * GET /api/blocks   (user)   Users the caller blocked, newest first.
 * 200 { blocks: [{ userId, createdAt, name, username, avatarUrl }] }  (name etc. null if disabled)
 */
export const GET = defineRoute({ auth: 'user' }, async ({ user }) => listBlocks(user.id))

/**
 * POST /api/blocks   (user)
 * Body: { userId }
 * Hides both users from each other in barber discovery and reviews.
 * 201 { blocked: true } (new) | 200 { blocked: true } (already blocked)
 * Errors: 400 CANNOT_BLOCK_SELF, 404 USER_NOT_FOUND
 */
export const POST = defineRoute(
  { auth: 'user', body: z.object({ userId: uuid }).strict() },
  async ({ user, body }) => {
    const { created } = await blockUser(user.id, body.userId)
    return Response.json({ blocked: true }, { status: created ? 201 : 200, headers: { 'Cache-Control': 'no-store' } })
  }
)
