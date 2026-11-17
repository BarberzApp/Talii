/**
 * @jest-environment node
 *
 * The SQL (sums, refund reversal, isolation between barbers) is tested against
 * Postgres in supabase/tests/06_earnings.test.sql. This file checks the route:
 * which barber and range it asks for, the response shape and paging.
 */
import type { FakeDb } from '@/server/testing/fake-supabase'
import { IDS, TOKENS, request, seedMarketplace } from '@/server/testing/fixtures'
import { GET } from '@/app/api/earnings/route'

let mockDb: FakeDb
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => ({}) }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

const OTHER_BARBER = '20000000-0000-4000-8000-0000000000ff'

const totalsByBarber: Record<string, Record<string, number>> = {
  [IDS.barber]: {
    fee_share_earned_cents: 240,
    fee_share_reversed_cents: 60,
    refunded_to_clients_cents: 170,
    completed_bookings: 1,
    no_show_bookings: 0,
    cancelled_bookings: 1,
    upcoming_bookings: 0,
    service_revenue_cents: 4500,
    booking_count: 3,
  },
  [OTHER_BARBER]: {
    fee_share_earned_cents: 99999,
    fee_share_reversed_cents: 0,
    refunded_to_clients_cents: 0,
    completed_bookings: 50,
    no_show_bookings: 0,
    cancelled_bookings: 0,
    upcoming_bookings: 0,
    service_revenue_cents: 99999,
    booking_count: 50,
  },
}

const calls: Array<Record<string, unknown>> = []

beforeEach(() => {
  mockDb = seedMarketplace()
  calls.length = 0
  mockDb.rpcHandlers.barber_earnings_totals = (args) => {
    calls.push({ fn: 'totals', ...args })
    return { data: [totalsByBarber[String(args.p_barber_id)]], error: null }
  }
  mockDb.rpcHandlers.barber_earnings_bookings = (args) => {
    calls.push({ fn: 'bookings', ...args })
    const rows =
      args.p_barber_id === IDS.barber
        ? [
            { id: 'b3', starts_at: '2026-03-04T15:00:00+00:00', status: 'completed', source: 'manual', payment_status: 'none', customer_name: 'Walk In', service_name: 'Fade', service_price_cents: 3500, addon_total_cents: 0, fee_share_cents: 0 },
            { id: 'b2', starts_at: '2026-03-03T15:00:00+00:00', status: 'cancelled', source: 'app', payment_status: 'partially_refunded', customer_name: 'Pat', service_name: 'Fade', service_price_cents: 3500, addon_total_cents: 0, fee_share_cents: 60 },
            { id: 'b1', starts_at: '2026-03-02T15:00:00+00:00', status: 'completed', source: 'app', payment_status: 'succeeded', customer_name: null, service_name: 'Fade', service_price_cents: 3500, addon_total_cents: 1000, fee_share_cents: 120 },
          ]
        : [{ id: 'other', fee_share_cents: 99999 }]
    const offset = Number(args.p_offset)
    return { data: rows.slice(offset, offset + Number(args.p_limit)), error: null }
  }
})

it("returns the caller's totals and one page of bookings", async () => {
  const res = await GET(request('/api/earnings?from=2026-03-01&to=2026-04-01', { token: TOKENS.barber }))
  expect(res.status).toBe(200)
  const body = await res.json()

  expect(calls.every((c) => c.p_barber_id === IDS.barber)).toBe(true)
  expect(calls[0]).toMatchObject({ p_from: '2026-03-01T00:00:00.000Z', p_to: '2026-04-01T00:00:00.000Z' })
  expect(body.totals).toEqual({
    feeShareEarnedCents: 240,
    feeShareReversedCents: 60,
    netFeeShareCents: 180,
    refundedToClientsCents: 170,
    completedBookings: 1,
    noShowBookings: 0,
    cancelledBookings: 1,
    upcomingBookings: 0,
    serviceRevenueCents: 4500,
  })
  expect(body.bookings.map((b: { id: string; feeShareCents: number }) => [b.id, b.feeShareCents])).toEqual([
    ['b3', 0],
    ['b2', 60],
    ['b1', 120],
  ])
  expect(body.pagination).toEqual({ limit: 100, offset: 0, total: 3 })
  expect(body.truncated).toBe(false)
})

it('reports truncated honestly when more bookings follow the page', async () => {
  const body = await (
    await GET(request('/api/earnings?from=2026-03-01&to=2026-04-01&limit=2', { token: TOKENS.barber }))
  ).json()
  expect(body.bookings).toHaveLength(2)
  expect(body.truncated).toBe(true)
  // Totals still cover the whole range, not just the page.
  expect(body.totals.feeShareEarnedCents).toBe(240)

  const last = await (
    await GET(request('/api/earnings?from=2026-03-01&to=2026-04-01&limit=2&offset=2', { token: TOKENS.barber }))
  ).json()
  expect(last.bookings).toHaveLength(1)
  expect(last.truncated).toBe(false)
})

it('rejects ranges over a year and non-barbers', async () => {
  const tooLong = await GET(request('/api/earnings?from=2025-01-01&to=2026-06-01', { token: TOKENS.barber }))
  expect(tooLong.status).toBe(400)
  expect((await GET(request('/api/earnings', { token: TOKENS.client }))).status).toBe(403)
  expect(calls).toHaveLength(0)
})
