import 'server-only'
import { getSupabaseAdmin } from './clients'
import { ApiError } from './errors'

export const MAX_EARNINGS_RANGE_DAYS = 366

/**
 * A barber's earnings for appointments starting in [from, to). Integer cents.
 *
 * Totals come from the `barber_earnings_totals` database function, so they
 * cover every booking in the range regardless of the Data API's row limit.
 * The booking list is one page (`limit`/`offset`, from
 * `barber_earnings_bookings`); `truncated` is true when more bookings exist
 * after this page.
 *
 * - feeShareEarnedCents: the barber's share of booking fees charged (charge
 *   amount minus the platform's application fee, i.e. 120 per paid booking).
 * - feeShareReversedCents: the part of that share pulled back by refunds.
 * - refundedToClientsCents: total refunded to clients (fee refunds).
 * - serviceRevenueCents: service + add-on prices of completed bookings. Paid in
 *   person, so informational only; Talii never handles this money.
 */
export async function getEarnings(
  barberId: string,
  from: Date,
  to: Date,
  page: { limit: number; offset: number } = { limit: 100, offset: 0 }
) {
  if (to.getTime() <= from.getTime()) throw new ApiError(400, 'INVALID_RANGE', '`to` must be after `from`.')
  if (to.getTime() - from.getTime() > MAX_EARNINGS_RANGE_DAYS * 86_400_000) {
    throw new ApiError(400, 'RANGE_TOO_LARGE', `The range can be at most ${MAX_EARNINGS_RANGE_DAYS} days.`)
  }

  const db = getSupabaseAdmin()
  const range = { p_barber_id: barberId, p_from: from.toISOString(), p_to: to.toISOString() }

  const [totalsResult, listResult] = await Promise.all([
    db.rpc('barber_earnings_totals', range),
    db.rpc('barber_earnings_bookings', { ...range, p_limit: page.limit, p_offset: page.offset }),
  ])
  if (totalsResult.error) throw totalsResult.error
  if (listResult.error) throw listResult.error

  const t = totalsResult.data?.[0]
  if (!t) throw new Error('barber_earnings_totals returned no row')
  const bookings = listResult.data ?? []
  const n = (v: number | string | null | undefined) => Number(v ?? 0)

  return {
    from: range.p_from,
    to: range.p_to,
    currency: 'usd',
    totals: {
      feeShareEarnedCents: n(t.fee_share_earned_cents),
      feeShareReversedCents: n(t.fee_share_reversed_cents),
      netFeeShareCents: n(t.fee_share_earned_cents) - n(t.fee_share_reversed_cents),
      refundedToClientsCents: n(t.refunded_to_clients_cents),
      completedBookings: n(t.completed_bookings),
      noShowBookings: n(t.no_show_bookings),
      cancelledBookings: n(t.cancelled_bookings),
      upcomingBookings: n(t.upcoming_bookings),
      serviceRevenueCents: n(t.service_revenue_cents),
    },
    bookings: bookings.map((b) => ({
      id: b.id,
      startsAt: b.starts_at,
      status: b.status,
      source: b.source,
      paymentStatus: b.payment_status,
      customerName: b.customer_name ?? null,
      serviceName: b.service_name ?? null,
      servicePriceCents: b.service_price_cents,
      addonTotalCents: b.addon_total_cents,
      feeShareCents: n(b.fee_share_cents),
    })),
    pagination: { limit: page.limit, offset: page.offset, total: n(t.booking_count) },
    truncated: page.offset + bookings.length < n(t.booking_count),
  }
}
