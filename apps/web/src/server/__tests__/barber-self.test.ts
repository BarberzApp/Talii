/**
 * @jest-environment node
 */
import type { FakeDb } from '@/server/testing/fake-supabase'
import { IDS, TEST_ENV, TOKENS, bookingRow, request, routeParams, seedMarketplace } from '@/server/testing/fixtures'
import { installApiFunctions } from '@/server/testing/api-fakes'
import { GET as listServices, POST as createService } from '@/app/api/me/services/route'
import { DELETE as deleteService, PATCH as patchService } from '@/app/api/me/services/[id]/route'
import { GET as listAddons, POST as createAddon } from '@/app/api/me/addons/route'
import { DELETE as deleteAddon, PATCH as patchAddon } from '@/app/api/me/addons/[id]/route'
import { GET as getAvailability, PUT as putAvailability } from '@/app/api/me/availability/route'
import { DELETE as deleteSpecial, GET as getSpecial, PUT as putSpecial } from '@/app/api/me/special-hours/route'

let mockDb: FakeDb
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => ({}) }))
jest.mock('@/server/env', () => ({ getServerEnv: () => TEST_ENV }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

const OTHER_BARBER = '20000000-0000-4000-8000-000000000099'
const OTHER_SERVICE = '30000000-0000-4000-8000-000000000099'
const OTHER_ADDON = '40000000-0000-4000-8000-000000000099'

beforeEach(() => {
  mockDb = installApiFunctions(seedMarketplace())
  mockDb.unique.special_hours = []
  mockDb.table('barbers').push({ id: OTHER_BARBER, user_id: IDS.strangerUser, timezone: 'America/New_York', is_public: true })
  mockDb.table('services').push({ id: OTHER_SERVICE, barber_id: OTHER_BARBER, name: 'X', duration_minutes: 30, price_cents: 100, is_active: true })
  mockDb.table('service_addons').push({ id: OTHER_ADDON, barber_id: OTHER_BARBER, name: 'Y', price_cents: 100, is_active: true })
})

type Handler = (req: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>

async function call(handler: Handler, method: string, url: string, token?: string, body?: unknown, params?: Record<string, string>) {
  const req = request(url, { method, token, body })
  const res = params ? await handler(req, routeParams(params)) : await handler(req)
  return { status: res.status, body: await res.json() }
}

describe('auth rules for barber self-management', () => {
  const cases: Array<[string, Handler, string, string, unknown, Record<string, string> | undefined]> = [
    ['GET services', listServices as Handler, 'GET', '/api/me/services', undefined, undefined],
    ['POST services', createService as Handler, 'POST', '/api/me/services', { name: 'A', durationMinutes: 30, priceCents: 1 }, undefined],
    ['PATCH service', patchService as Handler, 'PATCH', `/api/me/services/${IDS.service}`, { name: 'B' }, { id: IDS.service }],
    ['DELETE service', deleteService as Handler, 'DELETE', `/api/me/services/${IDS.service}`, undefined, { id: IDS.service }],
    ['GET addons', listAddons as Handler, 'GET', '/api/me/addons', undefined, undefined],
    ['GET availability', getAvailability as Handler, 'GET', '/api/me/availability', undefined, undefined],
    ['PUT availability', putAvailability as Handler, 'PUT', '/api/me/availability', { windows: [] }, undefined],
    ['GET special-hours', getSpecial as Handler, 'GET', '/api/me/special-hours', undefined, undefined],
  ]

  it.each(cases)('%s: 401 without a token, 403 NOT_A_BARBER for a client', async (_name, handler, method, url, body, params) => {
    expect((await call(handler, method, url, undefined, body, params)).status).toBe(401)
    const res = await call(handler, method, url, TOKENS.client, body, params)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NOT_A_BARBER')
  })
})

describe('/api/me/services', () => {
  it('lists only the caller\'s services, including inactive ones', async () => {
    const res = await call(listServices as Handler, 'GET', '/api/me/services', TOKENS.barber)
    expect(res.body.services.map((s: { id: string }) => s.id).sort()).toEqual([IDS.service, IDS.inactiveService].sort())
  })

  it('creates a service for the caller\'s barber (never one from the body)', async () => {
    const res = await call(createService as Handler, 'POST', '/api/me/services', TOKENS.barber, {
      name: ' Lineup ',
      durationMinutes: 15,
      priceCents: 1500,
    })
    expect(res.status).toBe(201)
    expect(res.body.service).toMatchObject({ barber_id: IDS.barber, name: 'Lineup', duration_minutes: 15, price_cents: 1500, is_active: true })

    const smuggled = await call(createService as Handler, 'POST', '/api/me/services', TOKENS.barber, {
      name: 'X', durationMinutes: 15, priceCents: 1, barberId: OTHER_BARBER,
    })
    expect(smuggled.status).toBe(400)
  })

  it('validates duration and price', async () => {
    for (const body of [
      { name: 'A', durationMinutes: 4, priceCents: 1 },
      { name: 'A', durationMinutes: 481, priceCents: 1 },
      { name: 'A', durationMinutes: 30, priceCents: -1 },
      { name: 'A', durationMinutes: 30, priceCents: 1.5 },
      { name: '', durationMinutes: 30, priceCents: 1 },
    ]) {
      expect((await call(createService as Handler, 'POST', '/api/me/services', TOKENS.barber, body)).status).toBe(400)
    }
  })

  it('updates own services and 404s on another barber\'s', async () => {
    const res = await call(patchService as Handler, 'PATCH', '', TOKENS.barber, { priceCents: 4000, isActive: false }, { id: IDS.service })
    expect(res.status).toBe(200)
    expect(res.body.service).toMatchObject({ price_cents: 4000, is_active: false })

    const other = await call(patchService as Handler, 'PATCH', '', TOKENS.barber, { priceCents: 1 }, { id: OTHER_SERVICE })
    expect(other.status).toBe(404)
    expect(mockDb.one('services', { id: OTHER_SERVICE })?.price_cents).toBe(100)
  })

  it('deletes an unused service', async () => {
    const res = await call(deleteService as Handler, 'DELETE', '', TOKENS.barber, undefined, { id: IDS.service })
    expect(res.body).toEqual({ deleted: true, deactivated: false })
    expect(mockDb.one('services', { id: IDS.service })).toBeUndefined()
  })

  it('deactivates a service that bookings reference', async () => {
    mockDb.table('bookings').push(bookingRow())
    const res = await call(deleteService as Handler, 'DELETE', '', TOKENS.barber, undefined, { id: IDS.service })
    expect(res.body).toEqual({ deleted: false, deactivated: true })
    expect(mockDb.one('services', { id: IDS.service })?.is_active).toBe(false)
  })

  it('falls back to deactivating on a foreign-key violation', async () => {
    mockDb.failNext('services', 'delete', { code: '23503', message: 'still referenced' })
    const res = await call(deleteService as Handler, 'DELETE', '', TOKENS.barber, undefined, { id: IDS.service })
    expect(res.body).toEqual({ deleted: false, deactivated: true })
  })

  it('404s deleting another barber\'s service', async () => {
    const res = await call(deleteService as Handler, 'DELETE', '', TOKENS.barber, undefined, { id: OTHER_SERVICE })
    expect(res.status).toBe(404)
    expect(mockDb.one('services', { id: OTHER_SERVICE })).toBeDefined()
  })
})

describe('/api/me/addons', () => {
  it('creates, lists, updates and deletes own add-ons', async () => {
    const created = await call(createAddon as Handler, 'POST', '/api/me/addons', TOKENS.barber, { name: 'Towel', priceCents: 500 })
    expect(created.status).toBe(201)
    const id = created.body.addon.id
    expect(created.body.addon.barber_id).toBe(IDS.barber)

    const list = await call(listAddons as Handler, 'GET', '/api/me/addons', TOKENS.barber)
    expect(list.body.addons.map((a: { id: string }) => a.id)).toEqual(expect.arrayContaining([IDS.addon, id]))
    expect(list.body.addons.some((a: { id: string }) => a.id === OTHER_ADDON)).toBe(false)

    const patched = await call(patchAddon as Handler, 'PATCH', '', TOKENS.barber, { priceCents: 700 }, { id })
    expect(patched.body.addon.price_cents).toBe(700)

    expect((await call(deleteAddon as Handler, 'DELETE', '', TOKENS.barber, undefined, { id })).body).toEqual({ deleted: true, deactivated: false })
  })

  it('deactivates an add-on used by a booking and 404s on another barber\'s', async () => {
    mockDb.table('booking_addons').push({ id: 'ba1', booking_id: 'b1', addon_id: IDS.addon, name: 'Beard', price_cents: 1000 })
    expect((await call(deleteAddon as Handler, 'DELETE', '', TOKENS.barber, undefined, { id: IDS.addon })).body).toEqual({
      deleted: false,
      deactivated: true,
    })
    expect((await call(patchAddon as Handler, 'PATCH', '', TOKENS.barber, { name: 'x' }, { id: OTHER_ADDON })).status).toBe(404)
    expect((await call(deleteAddon as Handler, 'DELETE', '', TOKENS.barber, undefined, { id: OTHER_ADDON })).status).toBe(404)
  })
})

describe('/api/me/availability', () => {
  it('returns the weekly schedule', async () => {
    const res = await call(getAvailability as Handler, 'GET', '/api/me/availability', TOKENS.barber)
    expect(res.body.availability).toHaveLength(5)
  })

  it('replaces the schedule through replace_availability', async () => {
    const res = await call(putAvailability as Handler, 'PUT', '/api/me/availability', TOKENS.barber, {
      windows: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 1, startTime: '12:00', endTime: '17:00' },
        { dayOfWeek: 6, startTime: '10:00', endTime: '24:00' },
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body.availability).toHaveLength(3)
    expect(mockDb.rows('availability', { barber_id: IDS.barber })).toHaveLength(3)
  })

  it('rejects overlapping windows, start >= end and bad times without writing', async () => {
    for (const windows of [
      [
        { dayOfWeek: 2, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 2, startTime: '11:00', endTime: '13:00' },
      ],
      [{ dayOfWeek: 2, startTime: '12:00', endTime: '12:00' }],
      [{ dayOfWeek: 2, startTime: '24:00', endTime: '24:00' }],
      [{ dayOfWeek: 7, startTime: '09:00', endTime: '10:00' }],
      [{ dayOfWeek: 1, startTime: '9:00', endTime: '10:00' }],
    ]) {
      const res = await call(putAvailability as Handler, 'PUT', '/api/me/availability', TOKENS.barber, { windows })
      expect(res.status).toBe(400)
    }
    expect(mockDb.rows('availability', { barber_id: IDS.barber })).toHaveLength(5)
  })

  it('maps a database rejection to 400 INVALID_SCHEDULE', async () => {
    mockDb.rpcHandlers.replace_availability = () => ({ data: null, error: { code: '22023', message: 'availability windows overlap' } })
    const res = await call(putAvailability as Handler, 'PUT', '/api/me/availability', TOKENS.barber, {
      windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }],
    })
    expect(res.body.error.code).toBe('INVALID_SCHEDULE')
  })
})

describe('/api/me/special-hours', () => {
  it('creates, replaces, lists (with reason) and deletes by date', async () => {
    const closed = await call(putSpecial as Handler, 'PUT', '/api/me/special-hours', TOKENS.barber, {
      date: '2026-03-04',
      isClosed: true,
      reason: 'Dentist',
    })
    expect(closed.status).toBe(200)
    expect(closed.body.specialHours).toMatchObject({ date: '2026-03-04', is_closed: true, reason: 'Dentist', start_time: null })

    const open = await call(putSpecial as Handler, 'PUT', '/api/me/special-hours', TOKENS.barber, {
      date: '2026-03-04',
      isClosed: false,
      startTime: '12:00',
      endTime: '15:00',
    })
    expect(open.body.specialHours).toMatchObject({ is_closed: false, start_time: '12:00', end_time: '15:00', reason: null })
    expect(mockDb.rows('special_hours', { barber_id: IDS.barber })).toHaveLength(1)

    const list = await call(getSpecial as Handler, 'GET', '/api/me/special-hours?from=2026-03-01&to=2026-03-31', TOKENS.barber)
    expect(list.body.specialHours).toHaveLength(1)

    expect((await call(deleteSpecial as Handler, 'DELETE', '/api/me/special-hours?date=2026-03-04', TOKENS.barber)).body).toEqual({ deleted: true })
    expect((await call(deleteSpecial as Handler, 'DELETE', '/api/me/special-hours?date=2026-03-04', TOKENS.barber)).status).toBe(404)
  })

  it('lists active bookings the new hours no longer cover', async () => {
    // 10:00-10:30 New York on Monday 2026-03-02.
    mockDb.table('bookings').push(bookingRow())
    const res = await call(putSpecial as Handler, 'PUT', '/api/me/special-hours', TOKENS.barber, {
      date: '2026-03-02',
      isClosed: false,
      startTime: '12:00',
      endTime: '17:00',
    })
    expect(res.body.bookingsOutsideHours).toEqual([expect.objectContaining({ id: bookingRow().id })])

    const covered = await call(putSpecial as Handler, 'PUT', '/api/me/special-hours', TOKENS.barber, {
      date: '2026-03-02',
      isClosed: false,
      startTime: '09:00',
      endTime: '17:00',
    })
    expect(covered.body.bookingsOutsideHours).toEqual([])
  })

  it('compares in wall-clock time on a DST day', async () => {
    // 2026-03-08: New York springs forward at 02:00, so the local day is 23 hours long.
    // 10:00-10:30 EDT is 14:00-14:30 UTC; elapsed time since midnight would wrongly say 09:00.
    mockDb.table('bookings').push(
      bookingRow({ id: '60000000-0000-4000-8000-0000000000d1', starts_at: '2026-03-08T14:00:00.000Z', ends_at: '2026-03-08T14:30:00.000Z' }),
      // 23:30-00:30 local: ends after 24:00, so it is outside the new hours.
      bookingRow({ id: '60000000-0000-4000-8000-0000000000d2', starts_at: '2026-03-09T03:30:00.000Z', ends_at: '2026-03-09T04:30:00.000Z' })
    )
    const res = await call(putSpecial as Handler, 'PUT', '/api/me/special-hours', TOKENS.barber, {
      date: '2026-03-08',
      isClosed: false,
      startTime: '10:00',
      endTime: '24:00',
    })
    expect(res.body.bookingsOutsideHours.map((b: { id: string }) => b.id)).toEqual(['60000000-0000-4000-8000-0000000000d2'])
  })

  it('validates the body', async () => {
    for (const body of [
      { date: '2026-02-30', isClosed: true },
      { date: '2026-03-04', isClosed: false },
      { date: '2026-03-04', isClosed: false, startTime: '15:00', endTime: '12:00' },
      { date: '2026-03-04', isClosed: true, startTime: '09:00' },
    ]) {
      expect((await call(putSpecial as Handler, 'PUT', '/api/me/special-hours', TOKENS.barber, body)).status).toBe(400)
    }
  })

  it('never touches another barber\'s special hours', async () => {
    mockDb.table('special_hours').push({ id: 'sh1', barber_id: OTHER_BARBER, date: '2026-03-04', is_closed: true, reason: 'secret' })
    const list = await call(getSpecial as Handler, 'GET', '/api/me/special-hours', TOKENS.barber)
    expect(list.body.specialHours).toEqual([])
    expect((await call(deleteSpecial as Handler, 'DELETE', '/api/me/special-hours?date=2026-03-04', TOKENS.barber)).status).toBe(404)
    expect(mockDb.one('special_hours', { id: 'sh1' })).toBeDefined()
  })
})
