import 'server-only'
import { getSupabaseAdmin, type Db } from './clients'
import { ApiError, pgCode, PG } from './errors'
import { parseStorageUrl } from './storage'

/**
 * Blocks and reports (App Store rules for user-generated content).
 *
 * A block hides both users from each other in discovery and reviews: the
 * caller never sees barbers or reviews of users they blocked, nor of users who
 * blocked them.
 */

/** Users hidden from `userId`: those they blocked and those who blocked them. */
export async function hiddenUserIds(db: Db, userId: string): Promise<string[]> {
  const [{ data: blocked, error: e1 }, { data: blockers, error: e2 }] = await Promise.all([
    db.from('blocked_users').select('blocked_id').eq('blocker_id', userId),
    db.from('blocked_users').select('blocker_id').eq('blocked_id', userId),
  ])
  if (e1) throw e1
  if (e2) throw e2
  return [...new Set([...(blocked ?? []).map((r) => r.blocked_id), ...(blockers ?? []).map((r) => r.blocker_id)])]
}

/**
 * Throws 404 BARBER_NOT_FOUND when an admin suspended the barber's listing, or
 * when the caller and the barber's owner have blocked each other (either way).
 * Used where a barber is reached by id: booking and slot lookups.
 */
export async function assertBarberVisibleTo(
  db: Db,
  barber: { id: string; user_id: string },
  callerId: string | null
): Promise<void> {
  const { data, error } = await db.from('barbers').select('listing_suspended').eq('id', barber.id).maybeSingle()
  if (error) throw error
  const hidden = callerId && callerId !== barber.user_id ? await hiddenUserIds(db, callerId) : []
  if (!data || data.listing_suspended || hidden.includes(barber.user_id)) {
    throw new ApiError(404, 'BARBER_NOT_FOUND', 'Barber not found.')
  }
}

export async function listBlocks(userId: string) {
  const db = getSupabaseAdmin()
  const { data: rows, error } = await db
    .from('blocked_users')
    .select('blocked_id, created_at')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const ids = (rows ?? []).map((r) => r.blocked_id)
  const profiles = new Map<string, { name: string | null; username: string; avatar_url: string | null; is_disabled: boolean }>()
  if (ids.length > 0) {
    const { data, error: profileError } = await db
      .from('profiles')
      .select('id, name, username, avatar_url, is_disabled')
      .in('id', ids)
    if (profileError) throw profileError
    for (const p of data ?? []) profiles.set(p.id, p)
  }

  return {
    blocks: (rows ?? []).map((r) => {
      const p = profiles.get(r.blocked_id)
      const visible = p && !p.is_disabled
      return {
        userId: r.blocked_id,
        createdAt: r.created_at,
        name: visible ? p.name : null,
        username: visible ? p.username : null,
        avatarUrl: visible ? p.avatar_url : null,
      }
    }),
  }
}

export async function blockUser(blockerId: string, blockedId: string): Promise<{ created: boolean }> {
  if (blockerId === blockedId) throw new ApiError(400, 'CANNOT_BLOCK_SELF', 'You cannot block yourself.')
  const db = getSupabaseAdmin()

  const { data: target, error } = await db.from('profiles').select('id').eq('id', blockedId).maybeSingle()
  if (error) throw error
  if (!target) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.')

  const { error: insertError } = await db.from('blocked_users').insert({ blocker_id: blockerId, blocked_id: blockedId })
  if (insertError) {
    if (pgCode(insertError) === PG.uniqueViolation) return { created: false }
    throw insertError
  }
  return { created: true }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<{ removed: boolean }> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .select('id')
  if (error) throw error
  return { removed: (data ?? []).length > 0 }
}

export const REPORT_CONTENT_TYPES = ['user', 'profile', 'review', 'image'] as const
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'inappropriate_content',
  'fraud',
  'fake_profile',
  'violence',
  'sexual_content',
  'other',
] as const
export const REPORT_STATUSES = ['pending', 'reviewed', 'resolved', 'dismissed'] as const

export interface CreateReportInput {
  contentType: (typeof REPORT_CONTENT_TYPES)[number]
  contentId: string
  reason: (typeof REPORT_REASONS)[number]
  details?: string
}

/**
 * What the reporter gets back: never reported_user_id (for a review report
 * that would reveal the reviewer, whom public_reviews keeps anonymous).
 */
const REPORTER_COLUMNS = 'id, content_type, content_id, reason, details, status, created_at, updated_at'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Files a report. The reported user is worked out on the server from the
 * content: a user/profile id, the author of a review, or the owner folder of
 * an image URL in this project's storage. A repeat of the caller's own
 * pending report on the same content returns that report instead.
 */
export async function createReport(reporterId: string, input: CreateReportInput) {
  const db = getSupabaseAdmin()
  let reportedUserId: string | null = null
  let contentId = input.contentId.trim()

  if (input.contentType === 'user' || input.contentType === 'profile') {
    if (!UUID_RE.test(contentId)) throw new ApiError(400, 'VALIDATION_ERROR', 'body.contentId: must be a user id')
    contentId = contentId.toLowerCase()
    const { data, error } = await db.from('profiles').select('id').eq('id', contentId).maybeSingle()
    if (error) throw error
    if (!data) throw new ApiError(404, 'CONTENT_NOT_FOUND', 'That user was not found.')
    reportedUserId = data.id
  } else if (input.contentType === 'review') {
    if (!UUID_RE.test(contentId)) throw new ApiError(400, 'VALIDATION_ERROR', 'body.contentId: must be a review id')
    contentId = contentId.toLowerCase()
    const { data, error } = await db.from('reviews').select('id, client_id').eq('id', contentId).maybeSingle()
    if (error) throw error
    if (!data) throw new ApiError(404, 'CONTENT_NOT_FOUND', 'That review was not found.')
    reportedUserId = data.client_id
  } else {
    const ref = parseStorageUrl(contentId)
    if (!ref) throw new ApiError(400, 'VALIDATION_ERROR', 'body.contentId: must be an image URL from this app')
    const { data, error } = await db.from('profiles').select('id').eq('id', ref.ownerId).maybeSingle()
    if (error) throw error
    reportedUserId = data?.id ?? null
  }

  if (reportedUserId === reporterId) throw new ApiError(400, 'CANNOT_REPORT_SELF', 'You cannot report your own content.')

  const { data: existing, error: existingError } = await db
    .from('reports')
    .select(REPORTER_COLUMNS)
    .eq('reporter_id', reporterId)
    .eq('content_type', input.contentType)
    .eq('content_id', contentId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return { report: pickReporterView(existing), created: false }

  const { data: report, error } = await db
    .from('reports')
    .insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      content_type: input.contentType,
      content_id: contentId,
      reason: input.reason,
      details: input.details ?? null,
      status: 'pending',
    })
    .select(REPORTER_COLUMNS)
    .single()
  if (error) throw error
  return { report: pickReporterView(report), created: true }
}

function pickReporterView(r: {
  id: string
  content_type: string
  content_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  updated_at: string
}) {
  return {
    id: r.id,
    content_type: r.content_type,
    content_id: r.content_id,
    reason: r.reason,
    details: r.details ?? null,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}
