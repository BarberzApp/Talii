import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { createReview, listOwnReviews } from '@/server/reviews'
import { nullableText, uuid } from '@/server/validation'

/**
 * GET /api/reviews?bookingId=   (user)   The caller's own reviews (to show "reviewed" state).
 * 200 { reviews: [{ id, booking_id, barber_id, rating, comment, is_hidden, created_at, updated_at }] }
 */
export const GET = defineRoute(
  { auth: 'user', query: z.object({ bookingId: uuid.optional() }) },
  async ({ user, query }) => listOwnReviews(user.id, query.bookingId)
)

/**
 * POST /api/reviews   (user)
 * Body: { bookingId, rating 1-5, comment? (max 500) }
 * Only the client of a completed booking, once per booking. The comment passes the shared word filter.
 * 201 { review }
 * Errors: 404 BOOKING_NOT_FOUND, 409 BOOKING_NOT_COMPLETED | ALREADY_REVIEWED, 400 INAPPROPRIATE_CONTENT
 */
export const POST = defineRoute(
  {
    auth: 'user',
    body: z
      .object({ bookingId: uuid, rating: z.number().int().min(1).max(5), comment: nullableText(500) })
      .strict(),
  },
  async ({ user, body }) =>
    Response.json(await createReview(user.id, body), { status: 201, headers: { 'Cache-Control': 'no-store' } })
)
