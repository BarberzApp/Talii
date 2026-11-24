import { z } from 'zod'
import { getSupabaseAdmin } from '@/server/clients'
import { defineRoute } from '@/server/route'
import { createUploadTicket } from '@/server/storage'

/**
 * POST /api/uploads   (user)   A signed upload URL for one image.
 * Body: { bucket: "avatars" | "media", contentType, fileName, sizeBytes? }
 *   avatars: image/jpeg, png, webp, heic, heif, up to 5 MB; media: the same plus gif, up to 10 MB.
 *   The object path is "<user_id>/<random uuid>.<ext from contentType>"; fileName is not used in it.
 * 200 { bucket, path, signedUrl, token, publicUrl, maxBytes, contentType }
 *   Upload with supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, { contentType })
 *   (or PUT the file to signedUrl), then save publicUrl with PATCH /api/me.
 * Errors: 400 UNSUPPORTED_TYPE, 413 FILE_TOO_LARGE
 */
export const POST = defineRoute(
  {
    auth: 'user',
    body: z
      .object({
        bucket: z.enum(['avatars', 'media']),
        contentType: z.string().trim().toLowerCase().max(100),
        fileName: z.string().trim().min(1).max(255),
        sizeBytes: z.number().int().positive().optional(),
      })
      .strict(),
  },
  async ({ user, body }) =>
    createUploadTicket(getSupabaseAdmin(), user.id, body.bucket, body.contentType, body.sizeBytes)
)
