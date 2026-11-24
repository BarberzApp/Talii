import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { User } from '@supabase/supabase-js'
import type { TablesUpdate } from '@barber-app/shared'
import { applyBookingAction } from './bookings/update'
import { ACTIVE_STATUSES } from './bookings/policy'
import { getSupabaseAdmin, type Db } from './clients'
import { ApiError, pgCode, PG } from './errors'
import { geocodeCityState } from './geocode'
import { isAdmin } from './route'
import { assertOwnImageUrl, removeUserFolder } from './storage'

/** Profile columns the owner may read (never other users'). */
const OWN_PROFILE_COLUMNS =
  'id, role, name, username, email, phone, avatar_url, cover_photo_url, is_disabled, created_at, updated_at'

export interface BillingSummary {
  charges_enabled: boolean
  details_submitted: boolean
  fee_exempt: boolean
}

async function loadBarber(db: Db, userId: string) {
  const { data, error } = await db.from('barbers').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

async function loadBilling(db: Db, barberId: string): Promise<BillingSummary | null> {
  const { data, error } = await db
    .from('barber_billing')
    .select('charges_enabled, details_submitted, fee_exempt')
    .eq('barber_id', barberId)
    .maybeSingle()
  if (error) throw error
  return data
    ? { charges_enabled: data.charges_enabled, details_submitted: data.details_submitted, fee_exempt: data.fee_exempt }
    : null
}

/** GET /api/me payload. */
export async function getMe(user: User) {
  const db = getSupabaseAdmin()
  const { data: profile, error } = await db.from('profiles').select(OWN_PROFILE_COLUMNS).eq('id', user.id).single()
  if (error) throw error
  const barber = await loadBarber(db, user.id)
  const billing = barber ? await loadBilling(db, barber.id) : null
  return {
    user: { id: user.id, email: user.email ?? null },
    isAdmin: isAdmin(user),
    profile,
    barber,
    billing,
  }
}

export interface UpdateMeInput {
  name?: string | null
  username?: string
  phone?: string | null
  avatarUrl?: string | null
  coverPhotoUrl?: string | null
  businessName?: string | null
  bio?: string | null
  specialties?: string[]
  instagram?: string | null
  tiktok?: string | null
  city?: string | null
  state?: string | null
  timezone?: string
  portfolio?: string[]
  isPublic?: boolean
  onboardingComplete?: boolean
}

const BARBER_FIELDS = [
  'businessName',
  'bio',
  'specialties',
  'instagram',
  'tiktok',
  'city',
  'state',
  'timezone',
  'portfolio',
  'isPublic',
  'onboardingComplete',
] as const

/**
 * PATCH /api/me. Only allow-listed fields; barber fields need a barber row.
 * When city or state changes the listing is geocoded server-side; if that
 * fails the coordinates are cleared (the barber drops out of nearby search
 * until the next successful geocode) and `location.geocoded` is false.
 */
export async function updateMe(user: User, role: string, input: UpdateMeInput) {
  const db = getSupabaseAdmin()

  const touchesBarber = BARBER_FIELDS.some((k) => input[k] !== undefined)
  // Role and row both: a barber demoted by an admin keeps the row but loses these fields.
  const barber = touchesBarber && role === 'barber' ? await loadBarber(db, user.id) : null
  if (touchesBarber && !barber) throw new ApiError(403, 'NOT_A_BARBER', 'Barber fields need a barber account.')

  if (input.avatarUrl) assertOwnImageUrl(input.avatarUrl, user.id, 'avatarUrl')
  if (input.coverPhotoUrl) assertOwnImageUrl(input.coverPhotoUrl, user.id, 'coverPhotoUrl')
  for (const url of input.portfolio ?? []) assertOwnImageUrl(url, user.id, 'portfolio')

  const profilePatch: TablesUpdate<'profiles'> = {}
  if (input.name !== undefined) profilePatch.name = input.name
  if (input.username !== undefined) profilePatch.username = input.username
  if (input.phone !== undefined) profilePatch.phone = input.phone
  if (input.avatarUrl !== undefined) profilePatch.avatar_url = input.avatarUrl
  if (input.coverPhotoUrl !== undefined) profilePatch.cover_photo_url = input.coverPhotoUrl

  if (Object.keys(profilePatch).length > 0) {
    const { error } = await db.from('profiles').update(profilePatch).eq('id', user.id)
    if (error) {
      if (pgCode(error) === PG.uniqueViolation) {
        throw new ApiError(409, 'USERNAME_TAKEN', 'That username is taken.')
      }
      throw error
    }
  }

  let location: { geocoded: boolean } | null = null
  if (barber) {
    const patch: TablesUpdate<'barbers'> = {}
    if (input.businessName !== undefined) patch.business_name = input.businessName
    if (input.bio !== undefined) patch.bio = input.bio
    if (input.specialties !== undefined) patch.specialties = input.specialties
    if (input.instagram !== undefined) patch.instagram = input.instagram
    if (input.tiktok !== undefined) patch.tiktok = input.tiktok
    if (input.city !== undefined) patch.city = input.city
    if (input.state !== undefined) patch.state = input.state
    if (input.timezone !== undefined) patch.timezone = input.timezone
    if (input.portfolio !== undefined) patch.portfolio = input.portfolio
    if (input.isPublic !== undefined) patch.is_public = input.isPublic
    if (input.onboardingComplete !== undefined) patch.onboarding_complete = input.onboardingComplete

    const city = input.city !== undefined ? input.city : barber.city
    const state = input.state !== undefined ? input.state : barber.state
    if (city !== barber.city || state !== barber.state) {
      const coords = await geocodeCityState(city, state)
      patch.latitude = coords?.latitude ?? null
      patch.longitude = coords?.longitude ?? null
      location = { geocoded: !!coords }
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await db.from('barbers').update(patch).eq('id', barber.id)
      if (error) throw error
    }
  }

  return { ...(await getMe(user)), location }
}

/**
 * POST /api/me/barber: turns the caller into a barber (unlisted details are
 * filled in during onboarding). Idempotent: an existing barber row is returned.
 * The barber_billing row is created by the create_barber_billing trigger.
 *
 * A barbers row whose owner has role 'client' means an admin demoted them:
 * only an admin (`byAdmin`) can restore it (403 BARBER_ACCESS_REMOVED).
 */
export async function becomeBarber(
  userId: string,
  input: { businessName?: string; timezone?: string },
  options: { byAdmin?: boolean } = {}
) {
  const db = getSupabaseAdmin()
  const existing = await loadBarber(db, userId)
  if (existing) {
    if (!options.byAdmin) {
      const { data: profile, error } = await db.from('profiles').select('role').eq('id', userId).single()
      if (error) throw error
      if (profile.role !== 'barber') {
        throw new ApiError(403, 'BARBER_ACCESS_REMOVED', 'Barber access was removed from this account. Contact support.')
      }
    }
    await ensureBarberRole(db, userId)
    return { barber: existing, created: false }
  }

  const { data: barber, error } = await db
    .from('barbers')
    .insert({
      user_id: userId,
      business_name: input.businessName ?? null,
      ...(input.timezone ? { timezone: input.timezone } : {}),
    })
    .select('*')
    .single()
  if (error) {
    if (pgCode(error) === PG.uniqueViolation) {
      const raced = await loadBarber(db, userId)
      if (raced) return becomeBarber(userId, input, options)
    }
    throw error
  }
  await ensureBarberRole(db, userId)
  return { barber, created: true }
}

async function ensureBarberRole(db: Db, userId: string): Promise<void> {
  const { error } = await db.from('profiles').update({ role: 'barber' }).eq('id', userId).neq('role', 'barber')
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

export interface UpcomingBookingRef {
  id: string
  starts_at: string
  status: string
  as: 'client' | 'barber'
}

export type DeleteAccountResult =
  | { ok: true; cancelledBookings: string[]; removedFiles: number; signInBlocked: boolean }
  | { ok: false; bookings: UpcomingBookingRef[]; cancelledBookings: string[] }

async function upcomingBookings(db: Db, userId: string, barberId: string | null, now: Date) {
  const refs: UpcomingBookingRef[] = []
  const { data: asClient, error } = await db
    .from('bookings')
    .select('id, starts_at, status')
    .eq('client_id', userId)
    .in('status', [...ACTIVE_STATUSES])
    .gt('starts_at', now.toISOString())
  if (error) throw error
  refs.push(...(asClient ?? []).map((b) => ({ ...b, as: 'client' as const })))

  if (barberId) {
    const { data: asBarber, error: barberError } = await db
      .from('bookings')
      .select('id, starts_at, status')
      .eq('barber_id', barberId)
      .in('status', [...ACTIVE_STATUSES])
      .gt('starts_at', now.toISOString())
    if (barberError) throw barberError
    refs.push(...(asBarber ?? []).map((b) => ({ ...b, as: 'barber' as const })))
  }
  return refs
}

/** Cancels each booking with the normal cancel path; returns the ones that could not be cancelled. */
async function cancelAll(userId: string, refs: UpcomingBookingRef[], now: Date) {
  const cancelled: string[] = []
  const failed: UpcomingBookingRef[] = []
  for (const ref of refs) {
    try {
      await applyBookingAction(userId, ref.id, { action: 'cancel', reason: 'account deleted' }, now)
      cancelled.push(ref.id)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'BOOKING_NOT_CANCELLABLE') continue // already ended
      Sentry.captureException(error, { tags: { step: 'account_delete_cancel', booking_id: ref.id } })
      failed.push(ref)
    }
  }
  return { cancelled, failed }
}

/**
 * DELETE /api/me: account deletion (App Store guideline 5.1.1(v)).
 *
 * Bookings reference profiles and barbers with ON DELETE RESTRICT, and booking
 * and payment rows must be kept for the other party and for accounting, so
 * the profile row is kept (scrubbed) and the auth user is soft-deleted:
 *
 * 1. Every future pending/confirmed booking (as client and as barber) is
 *    cancelled through the normal cancel path, which applies the refund
 *    policy (a barber's cancellation refunds the client's fee in full). If any
 *    cannot be cancelled the account is not deleted: the response lists them
 *    and the ones that were cancelled (those stay cancelled, refunds included).
 * 2. A barber's listing is unpublished and scrubbed (bio, specialties, social
 *    handles, portfolio, city/state/coordinates), services and add-ons are
 *    deactivated, and the weekly schedule and special hours are deleted.
 * 3. Blocks to and from the user are deleted.
 * 4. Every object in the user's storage folders is deleted (all depths).
 * 5. The profile is disabled, marked deleted (deleted_at) and scrubbed: name
 *    "Deleted user", phone, email, avatar and cover photo cleared. The username
 *    is kept so it stays reserved: /book/<username> 404s and nobody can claim it.
 * 6. The auth user is soft-deleted (auth.admin.deleteUser(id, true)). Verified
 *    on the local stack (GoTrue): the auth.users row stays (so foreign keys hold),
 *    its email and phone are replaced by hashes, user and app metadata are
 *    emptied, every auth.identities row has identity_data emptied and
 *    provider_id hashed (this removes Google name/picture/sub), sessions end,
 *    sign-in fails, and the same email can sign up again as a new user. A
 *    failure here is reported to Sentry, not to the caller: the API already
 *    refuses a disabled profile.
 *
 * Kept: bookings, booking add-ons and payments (the other party's history,
 * refunds, tax and accounting), the barber row's id and business name (shown
 * on clients' past bookings) and barber_billing (Stripe Connect account id for
 * refunds and reconciliation), reviews the user wrote (shown without name or
 * avatar by public_reviews), and reports the user filed or that concern them
 * (moderation record).
 */
export async function deleteAccount(userId: string, now: Date = new Date()): Promise<DeleteAccountResult> {
  const db = getSupabaseAdmin()
  const barber = await loadBarber(db, userId)

  const first = await cancelAll(userId, await upcomingBookings(db, userId, barber?.id ?? null, now), now)
  if (first.failed.length > 0) return { ok: false, bookings: first.failed, cancelledBookings: first.cancelled }

  if (barber) {
    const { error } = await db
      .from('barbers')
      .update({
        is_public: false,
        bio: null,
        specialties: [],
        instagram: null,
        tiktok: null,
        portfolio: [],
        city: null,
        state: null,
        latitude: null,
        longitude: null,
      })
      .eq('id', barber.id)
    if (error) throw error
    for (const table of ['services', 'service_addons'] as const) {
      const { error: deactivateError } = await db.from(table).update({ is_active: false }).eq('barber_id', barber.id)
      if (deactivateError) throw deactivateError
    }
    for (const table of ['availability', 'special_hours'] as const) {
      const { error: deleteError } = await db.from(table).delete().eq('barber_id', barber.id)
      if (deleteError) throw deleteError
    }
  }

  const { error: blocksError } = await db.from('blocked_users').delete().eq('blocker_id', userId)
  if (blocksError) throw blocksError
  const { error: blockedByError } = await db.from('blocked_users').delete().eq('blocked_id', userId)
  if (blockedByError) throw blockedByError

  const removedFiles = await removeUserFolder(db, userId)

  const scrub = {
    is_disabled: true,
    deleted_at: now.toISOString(),
    name: 'Deleted user',
    phone: null,
    email: null,
    avatar_url: null,
    cover_photo_url: null,
  }
  const { error: profileError } = await db.from('profiles').update(scrub).eq('id', userId)
  if (profileError) throw profileError

  let signInBlocked = true
  const { error: authError } = await db.auth.admin.deleteUser(userId, true)
  if (authError) {
    signInBlocked = false
    Sentry.captureException(authError, { tags: { step: 'account_delete_auth' } })
  } else {
    // The email-sync trigger copied GoTrue's hashed email onto the profile; clear it.
    const { error: emailError } = await db.from('profiles').update({ email: null }).eq('id', userId)
    if (emailError) throw emailError
  }

  // Anything booked while this ran (the listing was still visible until step 2).
  const second = await cancelAll(userId, await upcomingBookings(db, userId, barber?.id ?? null, now), now)
  if (second.failed.length > 0) {
    Sentry.captureMessage('Bookings left active after account deletion', {
      level: 'error',
      tags: { user_id: userId },
    })
  }

  return { ok: true, cancelledBookings: [...first.cancelled, ...second.cancelled], removedFiles, signInBlocked }
}
