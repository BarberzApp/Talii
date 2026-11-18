import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { unblockUser } from '@/server/safety'
import { uuid } from '@/server/validation'

/**
 * DELETE /api/blocks/:userId   (user)
 * 200 { removed: boolean }   (false when there was no block)
 */
export const DELETE = defineRoute(
  { auth: 'user', params: z.object({ userId: uuid }) },
  async ({ user, params }) => unblockUser(user.id, params.userId)
)
