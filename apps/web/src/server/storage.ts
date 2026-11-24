import 'server-only'
import { randomUUID } from 'node:crypto'
import type { Db } from './clients'
import { getServerEnv } from './env'
import { ApiError } from './errors'

/**
 * Storage buckets, mirroring `storage.buckets` in the baseline migration.
 * Both are public-read; objects live under `<user_id>/...`.
 */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const

export const BUCKETS = {
  avatars: { maxBytes: 5 * 1024 * 1024, mimeTypes: [...IMAGE_TYPES] as string[] },
  media: { maxBytes: 10 * 1024 * 1024, mimeTypes: [...IMAGE_TYPES, 'image/gif'] as string[] },
} as const

export type BucketId = keyof typeof BUCKETS
export const BUCKET_IDS = Object.keys(BUCKETS) as BucketId[]

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
}

export interface StorageRef {
  bucket: BucketId
  /** Object path inside the bucket, e.g. "<user_id>/<uuid>.jpg". */
  path: string
  /** First path segment: the user who owns the folder. */
  ownerId: string
}

const PUBLIC_PREFIX = '/storage/v1/object/public/'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Parses a public object URL of this project's storage
 * (`<SUPABASE_URL>/storage/v1/object/public/<bucket>/<user_id>/<file>`).
 * Returns null for anything else: other hosts, other buckets, query strings,
 * fragments, `..` segments or a first segment that is not a user id.
 */
export function parseStorageUrl(url: string): StorageRef | null {
  let parsed: URL
  let base: URL
  try {
    parsed = new URL(url)
    base = new URL(getServerEnv().NEXT_PUBLIC_SUPABASE_URL)
  } catch {
    return null
  }
  if (parsed.origin !== base.origin || parsed.search || parsed.hash || parsed.username || parsed.password) return null
  if (!parsed.pathname.startsWith(PUBLIC_PREFIX)) return null

  let segments: string[]
  try {
    segments = parsed.pathname.slice(PUBLIC_PREFIX.length).split('/').map(decodeURIComponent)
  } catch {
    return null
  }
  const [bucket, ...rest] = segments
  if (!(BUCKET_IDS as string[]).includes(bucket)) return null
  // Checked after decoding, so "..%2F" or "a%2Fb" (a hidden separator) are rejected too.
  if (rest.length < 2 || rest.some((s) => s === '' || s === '.' || s === '..' || /[/\\]/.test(s))) return null
  if (!UUID_RE.test(rest[0])) return null
  return { bucket: bucket as BucketId, path: rest.join('/'), ownerId: rest[0].toLowerCase() }
}

/** Exactly what POST /api/uploads produces: "<user uuid>/<random uuid>.<ext>". */
const UPLOAD_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|heic|heif|gif)$/

/**
 * Throws 400 INVALID_IMAGE_URL unless `url` is a public URL of this project's
 * storage with exactly the shape /api/uploads produces, under `userId`'s folder
 * (no percent-encoding, no sub-folders).
 */
export function assertOwnImageUrl(url: string, userId: string, field: string): StorageRef {
  const ref = url.includes('%') ? null : parseStorageUrl(url)
  if (!ref || ref.ownerId !== userId.toLowerCase() || !UPLOAD_PATH_RE.test(ref.path)) {
    throw new ApiError(
      400,
      'INVALID_IMAGE_URL',
      `${field} must be an image you uploaded (POST /api/uploads), in your own folder.`
    )
  }
  return ref
}

export function publicUrl(db: Db, bucket: BucketId, path: string): string {
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export interface UploadTicket {
  bucket: BucketId
  path: string
  signedUrl: string
  token: string
  publicUrl: string
  maxBytes: number
  contentType: string
}

/**
 * A signed upload URL for a new object `<userId>/<uuid>.<ext>`. The extension
 * comes from the content type, never from the client's file name. Storage
 * itself enforces the bucket's size limit and MIME types on upload.
 */
export async function createUploadTicket(
  db: Db,
  userId: string,
  bucket: BucketId,
  contentType: string,
  sizeBytes?: number
): Promise<UploadTicket> {
  const config = BUCKETS[bucket]
  if (!config.mimeTypes.includes(contentType)) {
    throw new ApiError(
      400,
      'UNSUPPORTED_TYPE',
      `${bucket} accepts ${config.mimeTypes.join(', ')}; got ${contentType}.`
    )
  }
  if (sizeBytes !== undefined && sizeBytes > config.maxBytes) {
    throw new ApiError(413, 'FILE_TOO_LARGE', `${bucket} accepts files up to ${config.maxBytes / (1024 * 1024)} MB.`)
  }

  const path = `${userId}/${randomUUID()}.${EXTENSIONS[contentType]}`
  const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path)
  if (error) throw error
  if (!data) throw new Error('createSignedUploadUrl returned no data')

  return {
    bucket,
    path: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
    publicUrl: publicUrl(db, bucket, data.path),
    maxBytes: config.maxBytes,
    contentType,
  }
}

const LIST_PAGE = 1000

/** All object paths under `prefix`, recursing into every sub-folder. */
async function listObjects(db: Db, bucket: BucketId, prefix: string): Promise<string[]> {
  const paths: string[] = []
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: LIST_PAGE, offset })
    if (error) throw error
    const entries = data ?? []
    for (const entry of entries) {
      const full = `${prefix}/${entry.name}`
      if (entry.id === null) {
        paths.push(...(await listObjects(db, bucket, full)))
      } else {
        paths.push(full)
      }
    }
    if (entries.length < LIST_PAGE) break
  }
  return paths
}

/** Deletes every object in the user's folder in both buckets. Returns the number removed. */
export async function removeUserFolder(db: Db, userId: string): Promise<number> {
  let removed = 0
  for (const bucket of BUCKET_IDS) {
    const paths = await listObjects(db, bucket, userId)
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100)
      const { error } = await db.storage.from(bucket).remove(chunk)
      if (error) throw error
      removed += chunk.length
    }
  }
  return removed
}
