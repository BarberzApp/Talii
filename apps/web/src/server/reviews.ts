import 'server-only'
import { containsExplicitLanguage } from '@barber-app/shared'
import type { TablesUpdate } from '@barber-app/shared'
import { getSupabaseAdmin } from './clients'
import { ApiError, pgCode, PG } from './errors'

/**
 * Reviews: only the client of a completed booking may review it, once.
 * Comments pass the shared word filter (packages/shared content-moderation).
 * A review an admin hid cannot be edited or deleted by its author, so the
 * booking's one review slot stays used (POST then answers 409 ALREADY_REVIEWED).
 */

const OWN_REVIEW_COLUMNS = 'id, booking_id, barber_id, rating, comment, is_hidden, created_at, updated_at'

function assertCleanComment(comment: string | null | undefined): void {
  if (comment && containsExplicitLanguage(comment)) {
    throw new ApiError(400, 'INAPPROPRIATE_CONTENT', 'Please keep your review respectful and remove offensive words.')
  }
}

export async function listOwnReviews(clientId: string, bookingId?: string) {
  const db = getSupabaseAdmin()
  let query = db.from('reviews').select(OWN_REVIEW_COLUMNS).eq('client_id', clientId)
  if (bookingId) query = query.eq('booking_id', bookingId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return { reviews: data ?? [] }
}

export async function createReview(
  clientId: string,
  input: { bookingId: string; rating: number; comment?: string | null }
) {
  assertCleanComment(input.comment)
  const db = getSupabaseAdmin()

  const { data: booking, error } = await db
    .from('bookings')
    .select('id, barber_id, client_id, status')
    .eq('id', input.bookingId)
    .maybeSingle()
  if (error) throw error
  if (!booking || booking.client_id !== clientId) throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.')
  if (booking.status !== 'completed') {
    throw new ApiError(409, 'BOOKING_NOT_COMPLETED', 'You can review an appointment once it is completed.')
  }

  const { data: review, error: insertError } = await db
    .from('reviews')
    .insert({
      booking_id: booking.id,
      barber_id: booking.barber_id,
      client_id: clientId,
      rating: input.rating,
      comment: input.comment ?? null,
    })
    .select(OWN_REVIEW_COLUMNS)
    .single()
  if (insertError) {
    if (pgCode(insertError) === PG.uniqueViolation) {
      throw new ApiError(409, 'ALREADY_REVIEWED', 'You have already reviewed this appointment.')
    }
    throw insertError
  }
  return { review }
}

/**
 * When a conditional write on the author's own visible review matched nothing:
 * 409 REVIEW_HIDDEN if an admin hid it (the author can no longer edit or
 * delete it, so it cannot be removed and posted again), otherwise 404.
 */
async function missingOrHidden(clientId: string, reviewId: string): Promise<never> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('reviews')
    .select('id, is_hidden')
    .eq('id', reviewId)
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw error
  if (data?.is_hidden) {
    throw new ApiError(409, 'REVIEW_HIDDEN', 'This review was hidden by a moderator and can no longer be changed.')
  }
  throw new ApiError(404, 'REVIEW_NOT_FOUND', 'Review not found.')
}

export async function updateReview(
  clientId: string,
  reviewId: string,
  input: { rating?: number; comment?: string | null }
) {
  assertCleanComment(input.comment)
  const patch: TablesUpdate<'reviews'> = {}
  if (input.rating !== undefined) patch.rating = input.rating
  if (input.comment !== undefined) patch.comment = input.comment

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('reviews')
    .update(patch)
    .eq('id', reviewId)
    .eq('client_id', clientId)
    .eq('is_hidden', false)
    .select(OWN_REVIEW_COLUMNS)
    .maybeSingle()
  if (error) throw error
  if (!data) return missingOrHidden(clientId, reviewId)
  return { review: data }
}

export async function deleteReview(clientId: string, reviewId: string) {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('reviews')
    .delete()
    .eq('id', reviewId)
    .eq('client_id', clientId)
    .eq('is_hidden', false)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) return missingOrHidden(clientId, reviewId)
  return { deleted: true }
}
