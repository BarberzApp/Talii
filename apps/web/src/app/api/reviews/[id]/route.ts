import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { deleteReview, updateReview } from '@/server/reviews'
import { idParams, nullableText } from '@/server/validation'

/**
 * PATCH /api/reviews/:id   (user, author only)
 * Body: any of { rating 1-5, comment (null clears) }
 * 200 { review }   404 REVIEW_NOT_FOUND   409 REVIEW_HIDDEN (hidden by a moderator)   400 INAPPROPRIATE_CONTENT
 */
export const PATCH = defineRoute(
  {
    auth: 'user',
    params: idParams,
    body: z
      .object({ rating: z.number().int().min(1).max(5).optional(), comment: nullableText(500) })
      .strict()
      .refine((b) => b.rating !== undefined || b.comment !== undefined, 'send rating or comment'),
  },
  async ({ user, params, body }) => updateReview(user.id, params.id, body)
)

/**
 * DELETE /api/reviews/:id   (user, author only)
 * 200 { deleted: true }   404 REVIEW_NOT_FOUND   409 REVIEW_HIDDEN
 */
export const DELETE = defineRoute({ auth: 'user', params: idParams }, async ({ user, params }) =>
  deleteReview(user.id, params.id)
)
