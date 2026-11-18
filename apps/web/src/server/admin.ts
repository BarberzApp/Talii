import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { TablesUpdate } from '@barber-app/shared'
import { becomeBarber } from './account'
import { cancelPaymentIntentQuietly } from './bookings/holds'
import { getSupabaseAdmin, type Db } from './clients'
import { ApiError } from './errors'
import { REPORT_STATUSES } from './safety'
import { parseStorageUrl } from './storage'

/** Admin-only operations (auth: 'admin', i.e. app_metadata.role === 'admin'). */

const USER_COLUMNS = 'id, name, username, email, phone, role, is_disabled, deleted_at, avatar_url, created_at'

/** Keeps letters, digits and a few email/username characters; PostgREST filter syntax cannot be injected. */
function searchTerm(q: string | undefined): string | undefined {
  const cleaned = (q ?? '').replace(/[^A-Za-z0-9@._+\- ]/g, '').trim()
  return cleaned.length > 0 ? cleaned : undefined
}

async function summarise<P extends { id: string; is_disabled: boolean }>(db: Db, profiles: P[]) {
  const ids = profiles.map((p) => p.id)
  const barbersByUser = new Map<
    string,
    { id: string; business_name: string | null; is_public: boolean; listing_suspended: boolean; onboarding_complete: boolean }
  >()
  const billingByBarber = new Map<string, { charges_enabled: boolean; details_submitted: boolean; fee_exempt: boolean }>()

  if (ids.length > 0) {
    const { data: barbers, error } = await db
      .from('barbers')
      .select('id, user_id, business_name, is_public, listing_suspended, onboarding_complete')
      .in('user_id', ids)
    if (error) throw error
    for (const b of barbers ?? []) barbersByUser.set(b.user_id, b)

    const barberIds = (barbers ?? []).map((b) => b.id)
    if (barberIds.length > 0) {
      const { data: billing, error: billingError } = await db
        .from('barber_billing')
        .select('barber_id, charges_enabled, details_submitted, fee_exempt')
        .in('barber_id', barberIds)
      if (billingError) throw billingError
      for (const row of billing ?? []) billingByBarber.set(row.barber_id, row)
    }
  }

  return profiles.map((p) => {
    const barber = barbersByUser.get(p.id)
    const billing = barber ? billingByBarber.get(barber.id) : undefined
    return {
      ...p,
      barber: barber
        ? {
            id: barber.id,
            business_name: barber.business_name,
            is_public: barber.is_public,
            listing_suspended: barber.listing_suspended,
            listed: barber.is_public && !barber.listing_suspended && !p.is_disabled,
            onboarding_complete: barber.onboarding_complete,
          }
        : null,
      billing: billing
        ? {
            charges_enabled: billing.charges_enabled,
            details_submitted: billing.details_submitted,
            fee_exempt: billing.fee_exempt,
          }
        : null,
    }
  })
}

export async function listUsers(input: {
  q?: string
  role?: 'client' | 'barber'
  disabled?: boolean
  limit: number
  offset: number
}) {
  const db = getSupabaseAdmin()
  let query = db.from('profiles').select(USER_COLUMNS, { count: 'exact' })
  const term = searchTerm(input.q)
  if (term) {
    const pattern = `"%${term}%"`
    query = query.or(`name.ilike.${pattern},username.ilike.${pattern},email.ilike.${pattern}`)
  }
  if (input.role) query = query.eq('role', input.role)
  if (input.disabled !== undefined) query = query.eq('is_disabled', input.disabled)
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(input.offset, input.offset + input.limit - 1)
  if (error) throw error

  return {
    users: await summarise(db, data ?? []),
    pagination: { limit: input.limit, offset: input.offset, total: count ?? 0 },
  }
}

async function loadUser(db: Db, userId: string) {
  const { data, error } = await db.from('profiles').select(USER_COLUMNS).eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.')
  const [summary] = await summarise(db, [data])
  return summary
}

/**
 * Cancels the user's unpaid holds (as client, and on their barber listing)
 * and stops their PaymentIntents. If one was paid at the same moment, the
 * webhook finds the booking cancelled and refunds it.
 */
async function releaseHoldsFor(db: Db, userId: string, barberId: string | null): Promise<number> {
  const now = new Date().toISOString()
  let released = 0
  const scopes: Array<['client_id' | 'barber_id', string]> = [['client_id', userId]]
  if (barberId) scopes.push(['barber_id', barberId])
  for (const [column, value] of scopes) {
    const { data, error } = await db
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: now, cancellation_reason: 'account_disabled', hold_expires_at: null })
      .eq(column, value)
      .eq('status', 'pending')
      .select('id, payment_intent_id')
    if (error) throw error
    for (const row of data ?? []) {
      released += 1
      if (row.payment_intent_id) await cancelPaymentIntentQuietly(row.payment_intent_id)
    }
  }
  return released
}

export interface AdminUserUpdate {
  isDisabled?: boolean
  role?: 'client' | 'barber'
  listingSuspended?: boolean
  feeExempt?: boolean
}

/**
 * PATCH /api/admin/users/:id.
 *  isDisabled        true: disables the profile (the API then refuses it, and a
 *                    barber is unlisted), bans the auth user and releases unpaid
 *                    holds. Confirmed bookings are left for the admin to handle.
 *                    A failed ban is reported (signInBlocked false), not a 500.
 *                    false: re-enables and lifts the ban; refused (409
 *                    ACCOUNT_DELETED) for an account its owner deleted.
 *  role              barber: creates or restores the barbers row and lifts the
 *                    listing suspension (unless listingSuspended says otherwise).
 *                    client: the barber row is kept (bookings reference it),
 *                    its listing suspended, and barber routes refuse the user.
 *  listingSuspended  barbers.listing_suspended: admin-only; hides the listing
 *                    whatever the barber sets is_public to.
 *  feeExempt         barber_billing.fee_exempt.
 */
export async function updateUser(adminId: string, userId: string, input: AdminUserUpdate) {
  const db = getSupabaseAdmin()
  const user = await loadUser(db, userId)
  let releasedHolds = 0
  let signInBlocked: boolean | null = null

  if (input.isDisabled !== undefined && userId === adminId) {
    throw new ApiError(400, 'CANNOT_DISABLE_SELF', 'You cannot disable your own account.')
  }
  if (user.deleted_at && (input.isDisabled === false || input.role !== undefined)) {
    throw new ApiError(409, 'ACCOUNT_DELETED', 'This account was deleted by its owner and cannot be restored.')
  }
  if ((input.listingSuspended !== undefined || input.feeExempt !== undefined) && !user.barber && input.role !== 'barber') {
    throw new ApiError(409, 'NOT_A_BARBER', 'This user has no barber profile.')
  }

  let suspend = input.listingSuspended
  if (input.role === 'barber') {
    await becomeBarber(userId, {}, { byAdmin: true })
    if (suspend === undefined) suspend = false
  } else if (input.role === 'client') {
    const { error } = await db.from('profiles').update({ role: 'client' }).eq('id', userId)
    if (error) throw error
    if (user.barber && suspend === undefined) suspend = true
  }

  if (suspend !== undefined) {
    const { error } = await db.from('barbers').update({ listing_suspended: suspend }).eq('user_id', userId)
    if (error) throw error
  }

  if (input.feeExempt !== undefined) {
    const { data: barber, error } = await db.from('barbers').select('id').eq('user_id', userId).single()
    if (error) throw error
    const { error: billingError } = await db
      .from('barber_billing')
      .update({ fee_exempt: input.feeExempt })
      .eq('barber_id', barber.id)
    if (billingError) throw billingError
  }

  if (input.isDisabled !== undefined) {
    const { error } = await db.from('profiles').update({ is_disabled: input.isDisabled }).eq('id', userId)
    if (error) throw error
    const { error: banError } = await db.auth.admin.updateUserById(userId, {
      ban_duration: input.isDisabled ? '876000h' : 'none',
    })
    signInBlocked = input.isDisabled ? !banError : false
    if (banError) Sentry.captureException(banError, { tags: { step: 'admin_ban', user_id: userId } })
    if (input.isDisabled) releasedHolds = await releaseHoldsFor(db, userId, user.barber?.id ?? null)
    if (banError && !input.isDisabled) {
      throw new ApiError(502, 'AUTH_UPDATE_FAILED', 'The account was re-enabled but the sign-in ban could not be lifted. Try again.')
    }
  }

  return { user: await loadUser(db, userId), releasedHolds, signInBlocked }
}

export async function platformStats(days: number) {
  const db = getSupabaseAdmin()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await db.rpc('admin_platform_stats', { p_since: since })
  if (error) throw error
  const row = (data ?? [])[0]
  if (!row) throw new Error('admin_platform_stats returned no row')
  return { since, stats: row }
}

async function usernames(db: Db, ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map
  const { data, error } = await db.from('profiles').select('id, username').in('id', unique)
  if (error) throw error
  for (const p of data ?? []) map.set(p.id, p.username)
  return map
}

export async function listReports(input: {
  status?: (typeof REPORT_STATUSES)[number]
  limit: number
  offset: number
}) {
  const db = getSupabaseAdmin()
  let query = db.from('reports').select('*', { count: 'exact' })
  if (input.status) query = query.eq('status', input.status)
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(input.offset, input.offset + input.limit - 1)
  if (error) throw error

  const rows = data ?? []
  const names = await usernames(db, rows.flatMap((r) => [r.reporter_id, r.reported_user_id]))
  return {
    reports: rows.map((r) => ({
      ...r,
      reporter_username: names.get(r.reporter_id) ?? null,
      reported_username: r.reported_user_id ? names.get(r.reported_user_id) ?? null : null,
    })),
    pagination: { limit: input.limit, offset: input.offset, total: count ?? 0 },
  }
}

export async function updateReport(id: string, status: (typeof REPORT_STATUSES)[number]) {
  const db = getSupabaseAdmin()
  const { data, error } = await db.from('reports').update({ status }).eq('id', id).select('*').maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'REPORT_NOT_FOUND', 'Report not found.')
  return { report: data }
}

export async function listReviewsForModeration(input: {
  hidden?: boolean
  barberId?: string
  limit: number
  offset: number
}) {
  const db = getSupabaseAdmin()
  let query = db
    .from('reviews')
    .select('id, booking_id, barber_id, client_id, rating, comment, is_hidden, created_at, updated_at', { count: 'exact' })
  if (input.hidden !== undefined) query = query.eq('is_hidden', input.hidden)
  if (input.barberId) query = query.eq('barber_id', input.barberId)
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(input.offset, input.offset + input.limit - 1)
  if (error) throw error

  const rows = data ?? []
  const names = await usernames(
    db,
    rows.map((r) => r.client_id)
  )
  const barberIds = [...new Set(rows.map((r) => r.barber_id))]
  const businessNames = new Map<string, string | null>()
  if (barberIds.length > 0) {
    const { data: barbers, error: barberError } = await db
      .from('barbers')
      .select('id, business_name')
      .in('id', barberIds)
    if (barberError) throw barberError
    for (const b of barbers ?? []) businessNames.set(b.id, b.business_name)
  }

  return {
    reviews: rows.map((r) => ({
      ...r,
      reviewer_username: r.client_id ? names.get(r.client_id) ?? null : null,
      barber_business_name: businessNames.get(r.barber_id) ?? null,
    })),
    pagination: { limit: input.limit, offset: input.offset, total: count ?? 0 },
  }
}

export async function setReviewHidden(id: string, isHidden: boolean) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('reviews')
    .update({ is_hidden: isHidden })
    .eq('id', id)
    .select('id, booking_id, barber_id, rating, comment, is_hidden, created_at, updated_at')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError(404, 'REVIEW_NOT_FOUND', 'Review not found.')
  return { review: data }
}

/**
 * DELETE /api/admin/media: removes a storage object and every reference to it
 * on its owner's profile (avatar, cover photo) and barber portfolio.
 */
export async function deleteMedia(url: string) {
  const ref = parseStorageUrl(url)
  if (!ref) throw new ApiError(400, 'INVALID_IMAGE_URL', 'url must be an image in this app\'s storage.')
  const db = getSupabaseAdmin()

  const { data: removed, error } = await db.storage.from(ref.bucket).remove([ref.path])
  if (error) throw error

  const cleared: string[] = []
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, avatar_url, cover_photo_url')
    .eq('id', ref.ownerId)
    .maybeSingle()
  if (profileError) throw profileError
  if (profile) {
    const patch: TablesUpdate<'profiles'> = {}
    if (profile.avatar_url === url) {
      patch.avatar_url = null
      cleared.push('avatar_url')
    }
    if (profile.cover_photo_url === url) {
      patch.cover_photo_url = null
      cleared.push('cover_photo_url')
    }
    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await db.from('profiles').update(patch).eq('id', profile.id)
      if (updateError) throw updateError
    }
  }

  const { data: barber, error: barberError } = await db
    .from('barbers')
    .select('id, portfolio')
    .eq('user_id', ref.ownerId)
    .maybeSingle()
  if (barberError) throw barberError
  if (barber && barber.portfolio.includes(url)) {
    const { error: updateError } = await db
      .from('barbers')
      .update({ portfolio: barber.portfolio.filter((u) => u !== url) })
      .eq('id', barber.id)
    if (updateError) throw updateError
    cleared.push('portfolio')
  }

  return { removed: (removed ?? []).length > 0, cleared }
}
