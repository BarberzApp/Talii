import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { setReviewHidden } from '@/server/admin'
import { idParams } from '@/server/validation'

/**
 * PATCH /api/admin/reviews/:id   (admin)
 * Body: { isHidden }
 * 200 { review }   404 REVIEW_NOT_FOUND
 */
export const PATCH = defineRoute(
  { auth: 'admin', params: idParams, body: z.object({ isHidden: z.boolean() }).strict() },
  async ({ params, body }) => setReviewHidden(params.id, body.isHidden)
)
