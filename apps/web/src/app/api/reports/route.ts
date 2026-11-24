import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { createReport, REPORT_CONTENT_TYPES, REPORT_REASONS } from '@/server/safety'
import { optionalText } from '@/server/validation'

/**
 * POST /api/reports   (user)
 * Body: { contentType: user|profile|review|image, contentId (user id, review id or image URL),
 *         reason: spam|harassment|hate_speech|inappropriate_content|fraud|fake_profile|violence|
 *                 sexual_content|other, details? (max 1000) }
 * The reported user is derived on the server. A repeat of the caller's own pending report on the
 * same content returns it.
 * 201 { report } (new) | 200 { report } (already pending)
 *   report: { id, content_type, content_id, reason, details, status, created_at, updated_at }
 *   (never reported_user_id: it would reveal who wrote a reported review)
 * Errors: 404 CONTENT_NOT_FOUND, 400 CANNOT_REPORT_SELF | VALIDATION_ERROR
 */
export const POST = defineRoute(
  {
    auth: 'user',
    body: z
      .object({
        contentType: z.enum(REPORT_CONTENT_TYPES),
        contentId: z.string().trim().min(1).max(500),
        reason: z.enum(REPORT_REASONS),
        details: optionalText(1000),
      })
      .strict(),
  },
  async ({ user, body }) => {
    const { report, created } = await createReport(user.id, body)
    return Response.json({ report }, { status: created ? 201 : 200, headers: { 'Cache-Control': 'no-store' } })
  }
)
