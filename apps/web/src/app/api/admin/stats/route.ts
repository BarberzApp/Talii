import { z } from 'zod'
import { defineRoute } from '@/server/route'
import { platformStats } from '@/server/admin'
import { queryInt } from '@/server/validation'

/**
 * GET /api/admin/stats?days=30   (admin)   Counts and fee totals, computed in SQL (admin_platform_stats).
 * 200 { since, stats: { users_total, clients_total, barbers_total, disabled_total, users_new_since,
 *       barbers_listed, barbers_charges_enabled, barbers_fee_exempt, bookings_total, bookings_pending,
 *       bookings_confirmed, bookings_upcoming, bookings_completed, bookings_cancelled, bookings_no_show,
 *       bookings_new_since, fees_charged_cents, platform_fees_cents, refunded_cents,
 *       platform_fees_refunded_cents, fees_charged_since_cents, platform_fees_since_cents,
 *       reviews_total, reviews_hidden, reports_pending, waitlist_total } }
 */
export const GET = defineRoute(
  { auth: 'admin', query: z.object({ days: queryInt(1, 3650, 30) }) },
  async ({ query }) => platformStats(query.days)
)
