import type { UploadBucket } from '@barber-app/shared'
import { api } from './api'
import { supabase } from './supabase'

/**
 * Uploads one image into the caller's own folder and returns its public URL.
 * POST /api/uploads issues a signed upload URL (the server picks the path);
 * the file goes straight to Storage. Save the URL afterwards with PATCH /api/me
 * (avatarUrl, coverPhotoUrl or portfolio).
 */
export async function uploadImage(file: Blob, bucket: UploadBucket, fileName = 'image'): Promise<string> {
  const contentType = file.type || 'image/jpeg'
  const ticket = await api.uploads.create({
    bucket,
    contentType,
    fileName: (file as File).name || fileName,
    sizeBytes: file.size,
  })
  const { error } = await supabase.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: ticket.contentType })
  if (error) throw new Error(error.message || 'Upload failed. Please try again.')
  return ticket.publicUrl
}
