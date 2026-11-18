/**
 * @jest-environment node
 */
import type { FakeDb } from '@/server/testing/fake-supabase'
import { createFakeStripe, type FakeStripe } from '@/server/testing/fake-stripe'
import { IDS, TOKENS, request, routeParams, seedMarketplace } from '@/server/testing/fixtures'
import { POST as createBooking } from '@/app/api/bookings/route'
import { GET as getAvailability } from '@/app/api/barbers/[id]/availability/route'

let mockDb: FakeDb
let mockStripe: FakeStripe
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => mockStripe }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

// Sunday 2026-03-01 07:00 New York; the barber works Mon-Fri 09:00-17:00.
const NOW = new Date('2026-03-01T12:00:00Z')
const MONDAY_10AM = '2026-03-02T15:00:00.000Z'

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
  mockDb = seedMarketplace()
  mockStripe = createFakeStripe()
  mockStripe.paymentIntents.create.mockImplementation(async (p: { metadata: { bookingId: string } }) => ({
    id: `pi_for_${p.metadata.bookingId}`,
    client_secret: 'secret',
  }))
})

afterEach(() => jest.useRealTimers())

async function book(token: string) {
  const res = await createBooking(
    request('/api/bookings', { method: 'POST', token, body: { barberId: IDS.barber, serviceId: IDS.service, startsAt: MONDAY_10AM } })
  )
  return { status: res.status, body: await res.json() }
}

async function slots(token?: string) {
  const res = await getAvailability(
    request(`/api/barbers/${IDS.barber}/availability?date=2026-03-02&serviceId=${IDS.service}`, { token }),
    routeParams({ id: IDS.barber })
  )
  return { status: res.status, body: await res.json() }
}

const block = (blocker: string, blocked: string) =>
  mockDb.table('blocked_users').push({ id: `${blocker}-${blocked}`, blocker_id: blocker, blocked_id: blocked })

describe('blocks and suspension in booking and slot lookups', () => {
  it('books and shows slots when nothing hides the barber', async () => {
    expect((await slots(TOKENS.client)).status).toBe(200)
    expect((await book(TOKENS.client)).status).toBe(201)
  })

  it('client blocked the barber: booking and slots 404 for that client', async () => {
    block(IDS.clientUser, IDS.barberUser)
    const res = await book(TOKENS.client)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('BARBER_NOT_FOUND')
    expect((await slots(TOKENS.client)).status).toBe(404)
    expect(mockDb.table('bookings')).toHaveLength(0)
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it('barber blocked the client: booking and slots 404 for that client only', async () => {
    block(IDS.barberUser, IDS.clientUser)
    expect((await book(TOKENS.client)).status).toBe(404)
    expect((await slots(TOKENS.client)).status).toBe(404)
    // Others, and anonymous slot lookups, are unaffected.
    expect((await slots()).status).toBe(200)
    expect((await slots(TOKENS.stranger)).status).toBe(200)
    expect((await book(TOKENS.stranger)).status).toBe(201)
  })

  it('a suspended listing cannot be booked or looked up by anyone', async () => {
    mockDb.one('barbers', { id: IDS.barber })!.listing_suspended = true
    expect((await book(TOKENS.client)).status).toBe(404)
    expect((await slots()).status).toBe(404)
    expect((await slots(TOKENS.client)).status).toBe(404)
  })

  it('an invalid token on the slot lookup is treated as anonymous', async () => {
    block(IDS.barberUser, IDS.clientUser)
    expect((await slots('not-a-token')).status).toBe(200)
  })
})
