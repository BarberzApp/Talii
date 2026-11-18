import { z } from 'zod'
import { isValidTimeZone } from '@barber-app/shared'
import { defineRoute } from '@/server/route'
import { deleteAccount, getMe, updateMe } from '@/server/account'
import { nullableText } from '@/server/validation'

/**
 * GET /api/me   (user)
 * 200 { user: { id, email }, isAdmin, profile (own row: id, role, name, username, email, phone,
 *       avatar_url, cover_photo_url, is_disabled, created_at, updated_at),
 *       barber: barbers row | null, billing: { charges_enabled, details_submitted, fee_exempt } | null }
 */
export const GET = defineRoute({ auth: 'user' }, async ({ user }) => getMe(user))

const imageUrl = z.string().url().max(500).nullable().optional()

const patchBody = z
  .object({
    name: nullableText(80),
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]{3,30}$/, 'must be 3-30 letters, digits or underscores')
      .optional(),
    phone: nullableText(30).refine((v) => v == null || /^\+?[0-9 ().-]{7,30}$/.test(v), 'must be a phone number'),
    avatarUrl: imageUrl,
    coverPhotoUrl: imageUrl,
    businessName: nullableText(80),
    bio: nullableText(1000),
    specialties: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    instagram: nullableText(60),
    tiktok: nullableText(60),
    city: nullableText(80),
    state: nullableText(40),
    timezone: z.string().refine(isValidTimeZone, 'must be an IANA time zone such as America/New_York').optional(),
    portfolio: z.array(z.string().url().max(500)).max(30).optional(),
    isPublic: z.boolean().optional(),
    onboardingComplete: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'send at least one field')

/**
 * PATCH /api/me   (user)
 * Body (all optional, unknown keys rejected; null or "" clears a text field):
 *   profile: name, username (3-30 of A-Za-z0-9_), phone, avatarUrl, coverPhotoUrl
 *   barber only (role 'barber' and a barbers row): businessName, bio, specialties[], instagram, tiktok, city, state,
 *                timezone (IANA), portfolio[] (image URLs), isPublic, onboardingComplete
 * Image URLs must be public URLs in this project's avatars/media buckets under the caller's folder.
 * Changing city/state geocodes the listing server-side.
 * 200 { ...GET /api/me, location: { geocoded } | null }
 * Errors: 400 VALIDATION_ERROR | INVALID_IMAGE_URL, 403 NOT_A_BARBER, 409 USERNAME_TAKEN
 */
export const PATCH = defineRoute({ auth: 'user', body: patchBody }, async ({ user, profile, body }) =>
  updateMe(user, profile.role, body)
)

/**
 * DELETE /api/me   (user)   Account deletion.
 * Body: { confirm: true }
 * Cancels future bookings (normal refund policy), unlists and scrubs a barber listing, deletes
 * schedule, blocks and uploaded files, disables and scrubs the profile (username kept, reserved),
 * soft-deletes the auth user. Booking/payment history is kept (see deleteAccount in server/account.ts).
 * 200 { deleted: true, cancelledBookings: [id], removedFiles, signInBlocked }
 * 409 { error: { code: "HAS_UPCOMING_BOOKINGS" }, bookings: [{ id, starts_at, status, as }],
 *       cancelledBookings: [id] } when some future bookings could not be cancelled: the account is
 *     not deleted, but the bookings listed in cancelledBookings were cancelled (and refunded per policy).
 */
export const DELETE = defineRoute(
  { auth: 'user', body: z.object({ confirm: z.literal(true) }) },
  async ({ user }) => {
    const result = await deleteAccount(user.id)
    if (!result.ok) {
      return Response.json(
        {
          error: {
            code: 'HAS_UPCOMING_BOOKINGS',
            message:
              'Your account was not deleted because some upcoming bookings could not be cancelled. ' +
              'Bookings listed under cancelledBookings were cancelled. Try again, or cancel the rest first.',
          },
          bookings: result.bookings,
          cancelledBookings: result.cancelledBookings,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const { ok: _ok, ...rest } = result
    return { deleted: true, ...rest }
  }
)
