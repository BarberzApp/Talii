import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { deleteMedia } from '@/server/admin'

/**
 * DELETE /api/admin/media   (admin)   Removes an uploaded image and its references.
 * Body: { url }  (public URL in this project's avatars/media bucket)
 * Deletes the storage object and clears it from the owner's avatar_url / cover_photo_url and
 * barber portfolio.
 * 200 { removed: boolean (object existed), cleared: ["avatar_url" | "cover_photo_url" | "portfolio"] }
 * Errors: 400 INVALID_IMAGE_URL
 */
export const DELETE = defineRoute(
  { auth: 'admin', body: z.object({ url: z.string().url().max(1000) }).strict() },
  async ({ body }) => deleteMedia(body.url)
)
