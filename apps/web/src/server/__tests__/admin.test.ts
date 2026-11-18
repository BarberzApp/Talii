/**
 * @jest-environment node
 */
import type { FakeDb } from '@/server/testing/fake-supabase'
import { createFakeStripe, type FakeStripe } from '@/server/testing/fake-stripe'
import { IDS, TEST_ENV, TOKENS, bookingRow, request, routeParams, seedMarketplace } from '@/server/testing/fixtures'
import { addReview, installApiFunctions, storageUrl } from '@/server/testing/api-fakes'
import { GET as listUsers } from '@/app/api/admin/users/route'
import { PATCH as patchUser } from '@/app/api/admin/users/[id]/route'
import { GET as stats } from '@/app/api/admin/stats/route'
import { GET as listReports } from '@/app/api/admin/reports/route'
import { PATCH as patchReport } from '@/app/api/admin/reports/[id]/route'
import { GET as listReviews } from '@/app/api/admin/reviews/route'
import { PATCH as patchReview } from '@/app/api/admin/reviews/[id]/route'
import { DELETE as deleteMedia } from '@/app/api/admin/media/route'
import { GET as listServices } from '@/app/api/me/services/route'
import { GET as getMe, PATCH as patchMe } from '@/app/api/me/route'
import { POST as becomeBarber } from '@/app/api/me/barber/route'
import { GET as getBarber } from '@/app/api/barbers/[id]/route'

let mockDb: FakeDb
let mockStripe: FakeStripe
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => mockStripe }))
jest.mock('@/server/env', () => ({ getServerEnv: () => TEST_ENV }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

beforeEach(() => {
  mockDb = installApiFunctions(seedMarketplace())
  mockStripe = createFakeStripe()
})

type Handler = (req: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>

async function call(handler: Handler, method: string, url: string, token?: string, body?: unknown, params?: Record<string, string>) {
  const req = request(url, { method, token, body })
  const res = params ? await handler(req, routeParams(params)) : await handler(req)
  return { status: res.status, body: await res.json() }
}

describe('admin auth', () => {
  const cases: Array<[string, Handler, string, string, unknown, Record<string, string> | undefined]> = [
    ['GET users', listUsers as Handler, 'GET', '/api/admin/users', undefined, undefined],
    ['PATCH user', patchUser as Handler, 'PATCH', '/x', { isDisabled: true }, { id: IDS.strangerUser }],
    ['GET stats', stats as Handler, 'GET', '/api/admin/stats', undefined, undefined],
    ['GET reports', listReports as Handler, 'GET', '/api/admin/reports', undefined, undefined],
    ['PATCH report', patchReport as Handler, 'PATCH', '/x', { status: 'resolved' }, { id: IDS.strangerUser }],
    ['GET reviews', listReviews as Handler, 'GET', '/api/admin/reviews', undefined, undefined],
    ['PATCH review', patchReview as Handler, 'PATCH', '/x', { isHidden: true }, { id: IDS.strangerUser }],
    ['DELETE media', deleteMedia as Handler, 'DELETE', '/x', { url: storageUrl('media', `${IDS.clientUser}/a.jpg`) }, undefined],
  ]

  it.each(cases)('%s: 401 without a token, 403 for non-admins (even with role-like profile data)', async (_n, handler, method, url, body, params) => {
    expect((await call(handler, method, url, undefined, body, params)).status).toBe(401)
    mockDb.users.set(TOKENS.client, { id: IDS.clientUser, user_metadata: { role: 'admin' } })
    for (const token of [TOKENS.client, TOKENS.barber]) {
      const res = await call(handler, method, url, token, body, params)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    }
  })
})

describe('GET /api/admin/users', () => {
  it('lists users with role, disabled, listed, fee_exempt and charges_enabled', async () => {
    const res = await call(listUsers as Handler, 'GET', '/api/admin/users', TOKENS.admin)
    expect(res.status).toBe(200)
    expect(res.body.pagination).toEqual({ limit: 25, offset: 0, total: 4 })
    const barber = res.body.users.find((u: { id: string }) => u.id === IDS.barberUser)
    expect(barber).toMatchObject({
      role: 'barber',
      is_disabled: false,
      barber: { id: IDS.barber, listed: true, is_public: true },
      billing: { charges_enabled: true, fee_exempt: false },
    })
    expect(res.body.users.find((u: { id: string }) => u.id === IDS.clientUser)).toMatchObject({ barber: null, billing: null })
  })

  it('searches name/username/email and filters by role', async () => {
    const res = await call(listUsers as Handler, 'GET', '/api/admin/users?q=STRANGER', TOKENS.admin)
    expect(res.body.users.map((u: { id: string }) => u.id)).toEqual([IDS.strangerUser])
    const barbers = await call(listUsers as Handler, 'GET', '/api/admin/users?role=barber', TOKENS.admin)
    expect(barbers.body.users.map((u: { id: string }) => u.id)).toEqual([IDS.barberUser])
    // Filter syntax characters are stripped, not interpreted.
    const odd = await call(listUsers as Handler, 'GET', '/api/admin/users?q=' + encodeURIComponent('x),role.eq.barber'), TOKENS.admin)
    expect(odd.status).toBe(200)
    expect(odd.body.users).toEqual([])
  })
})

describe('PATCH /api/admin/users/:id', () => {
  it('disables a user: bans the auth user and releases their holds', async () => {
    mockDb.table('bookings').push(
      bookingRow({ id: '60000000-0000-4000-8000-000000000101', client_id: IDS.strangerUser, status: 'pending', payment_status: 'pending', payment_intent_id: 'pi_hold', hold_expires_at: '2099-01-01T00:00:00Z' }),
      bookingRow({ id: '60000000-0000-4000-8000-000000000102', client_id: IDS.strangerUser, status: 'confirmed', starts_at: '2099-01-02T15:00:00Z', ends_at: '2099-01-02T15:30:00Z', payment_intent_id: 'pi_paid' })
    )
    const res = await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { isDisabled: true }, { id: IDS.strangerUser })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ user: { id: IDS.strangerUser, is_disabled: true }, releasedHolds: 1, signInBlocked: true })
    expect(mockDb.adminUserUpdates).toEqual([{ id: IDS.strangerUser, attributes: { ban_duration: '876000h' } }])
    expect(mockDb.one('bookings', { id: '60000000-0000-4000-8000-000000000101' })).toMatchObject({ status: 'cancelled', cancellation_reason: 'account_disabled', hold_expires_at: null })
    expect(mockDb.one('bookings', { id: '60000000-0000-4000-8000-000000000102' })?.status).toBe('confirmed')
    expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_hold')

    const enable = await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { isDisabled: false }, { id: IDS.strangerUser })
    expect(enable.body.user.is_disabled).toBe(false)
    expect(mockDb.adminUserUpdates[1]).toEqual({ id: IDS.strangerUser, attributes: { ban_duration: 'none' } })
  })

  it('promotes a client, suspends a listing independently of is_public, and sets fee exemption', async () => {
    const toBarber = await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { role: 'barber' }, { id: IDS.clientUser })
    expect(toBarber.body.user).toMatchObject({ role: 'barber', barber: { id: expect.any(String), listing_suspended: false } })
    expect(mockDb.rows('barbers', { user_id: IDS.clientUser })).toHaveLength(1)

    const suspend = await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { listingSuspended: true, feeExempt: true }, { id: IDS.barberUser })
    expect(suspend.body.user).toMatchObject({
      barber: { is_public: true, listing_suspended: true, listed: false },
      billing: { fee_exempt: true },
    })
    expect((await call(getBarber as Handler, 'GET', '', undefined, undefined, { id: IDS.barber })).status).toBe(404)

    // The barber cannot undo the suspension: is_public is theirs, listing_suspended is not.
    expect((await call(patchMe as Handler, 'PATCH', '/api/me', TOKENS.barber, { isPublic: true })).status).toBe(200)
    expect((await call(patchMe as Handler, 'PATCH', '/api/me', TOKENS.barber, { listingSuspended: false })).status).toBe(400)
    expect(mockDb.one('barbers', { id: IDS.barber })?.listing_suspended).toBe(true)
    expect((await call(getBarber as Handler, 'GET', '', undefined, undefined, { id: IDS.barber })).status).toBe(404)

    await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { listingSuspended: false }, { id: IDS.barberUser })
    expect((await call(getBarber as Handler, 'GET', '', undefined, undefined, { id: IDS.barber })).status).toBe(200)
  })

  it('demotes a barber: barber routes, barber fields and self-restoring all refuse afterwards', async () => {
    expect((await call(listServices as Handler, 'GET', '/api/me/services', TOKENS.barber)).status).toBe(200)
    expect((await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { role: 'client', listingSuspended: false }, { id: IDS.barberUser })).status).toBe(400)

    const demote = await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { role: 'client' }, { id: IDS.barberUser })
    expect(demote.status).toBe(200)
    expect(demote.body.user).toMatchObject({ role: 'client', barber: { listing_suspended: true, listed: false } })
    expect(mockDb.one('barbers', { id: IDS.barber })).toBeDefined() // kept: bookings reference it

    const services = await call(listServices as Handler, 'GET', '/api/me/services', TOKENS.barber)
    expect(services.status).toBe(403)
    expect(services.body.error.code).toBe('NOT_A_BARBER')
    const relist = await call(patchMe as Handler, 'PATCH', '/api/me', TOKENS.barber, { isPublic: true })
    expect(relist.status).toBe(403)
    expect(relist.body.error.code).toBe('NOT_A_BARBER')
    const restore = await call(becomeBarber as Handler, 'POST', '/api/me/barber', TOKENS.barber, {})
    expect(restore.status).toBe(403)
    expect(restore.body.error.code).toBe('BARBER_ACCESS_REMOVED')
    expect(mockDb.one('profiles', { id: IDS.barberUser })?.role).toBe('client')
    // Plain profile edits still work.
    expect((await call(patchMe as Handler, 'PATCH', '/api/me', TOKENS.barber, { name: 'Still here' })).status).toBe(200)

    // Only an admin can restore barber access; the suspension lifts with it.
    const promote = await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { role: 'barber' }, { id: IDS.barberUser })
    expect(promote.body.user).toMatchObject({ role: 'barber', barber: { id: IDS.barber, listing_suspended: false } })
    expect((await call(listServices as Handler, 'GET', '/api/me/services', TOKENS.barber)).status).toBe(200)
  })

  it('refuses to re-enable or change the role of an account its owner deleted', async () => {
    Object.assign(mockDb.one('profiles', { id: IDS.strangerUser })!, { is_disabled: true, deleted_at: '2026-01-01T00:00:00Z' })
    for (const body of [{ isDisabled: false }, { role: 'barber' }]) {
      const res = await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, body, { id: IDS.strangerUser })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('ACCOUNT_DELETED')
    }
    expect(mockDb.one('profiles', { id: IDS.strangerUser })?.is_disabled).toBe(true)
    expect(mockDb.adminUserUpdates).toHaveLength(0)
  })

  it('still releases holds and reports signInBlocked false when the ban call fails', async () => {
    mockDb.table('bookings').push(
      bookingRow({ id: '60000000-0000-4000-8000-000000000201', client_id: IDS.strangerUser, status: 'pending', payment_status: 'pending', payment_intent_id: 'pi_h', hold_expires_at: '2099-01-01T00:00:00Z' })
    )
    mockDb.failNext('auth.users', 'update', { message: 'auth down' })
    const res = await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { isDisabled: true }, { id: IDS.strangerUser })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ user: { is_disabled: true }, releasedHolds: 1, signInBlocked: false })
    expect(mockDb.one('bookings', { id: '60000000-0000-4000-8000-000000000201' })?.status).toBe('cancelled')
    expect((await call(getMe as Handler, 'GET', '/api/me', TOKENS.stranger)).status).toBe(403)
  })

  it('validates and guards', async () => {
    expect((await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { isDisabled: true }, { id: IDS.adminUser })).body.error.code).toBe('CANNOT_DISABLE_SELF')
    expect((await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { feeExempt: true }, { id: IDS.clientUser })).body.error.code).toBe('NOT_A_BARBER')
    expect((await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { listingSuspended: true }, { id: IDS.clientUser })).body.error.code).toBe('NOT_A_BARBER')
    expect((await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { isPublic: true }, { id: IDS.barberUser })).status).toBe(400)
    expect((await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { role: 'admin' }, { id: IDS.clientUser })).status).toBe(400)
    expect((await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, {}, { id: IDS.clientUser })).status).toBe(400)
    expect((await call(patchUser as Handler, 'PATCH', '/x', TOKENS.admin, { isDisabled: true }, { id: '10000000-0000-4000-8000-0000000000ff' })).status).toBe(404)
  })
})

describe('GET /api/admin/stats', () => {
  it('returns the SQL stats row', async () => {
    mockDb.table('payments').push({ id: 'p1', type: 'charge', status: 'succeeded', amount_cents: 340, application_fee_cents: 220 })
    const res = await call(stats as Handler, 'GET', '/api/admin/stats?days=7', TOKENS.admin)
    expect(res.status).toBe(200)
    expect(res.body.stats).toMatchObject({ users_total: 4, barbers_total: 1, platform_fees_cents: 220 })
    expect(res.body.since).toEqual(expect.any(String))
    expect((await call(stats as Handler, 'GET', '/api/admin/stats?days=0', TOKENS.admin)).status).toBe(400)
  })
})

describe('reports and reviews moderation', () => {
  it('lists reports with usernames and updates status', async () => {
    mockDb.table('reports').push({
      id: '70000000-0000-4000-8000-000000000001',
      reporter_id: IDS.clientUser,
      reported_user_id: IDS.strangerUser,
      content_type: 'user',
      content_id: IDS.strangerUser,
      reason: 'spam',
      status: 'pending',
      created_at: '2026-01-01T00:00:00Z',
    })
    const list = await call(listReports as Handler, 'GET', '/api/admin/reports?status=pending', TOKENS.admin)
    expect(list.body.reports[0]).toMatchObject({ reporter_username: 'client_one', reported_username: 'stranger' })
    const res = await call(patchReport as Handler, 'PATCH', '/x', TOKENS.admin, { status: 'resolved' }, { id: '70000000-0000-4000-8000-000000000001' })
    expect(res.body.report.status).toBe('resolved')
    expect((await call(patchReport as Handler, 'PATCH', '/x', TOKENS.admin, { status: 'bogus' }, { id: '70000000-0000-4000-8000-000000000001' })).status).toBe(400)
    expect((await call(patchReport as Handler, 'PATCH', '/x', TOKENS.admin, { status: 'resolved' }, { id: '70000000-0000-4000-8000-0000000000ff' })).status).toBe(404)
  })

  it('lists reviews including hidden ones and hides/unhides', async () => {
    const review = addReview(mockDb, { comment: 'bad', booking_id: 'b1' })
    const list = await call(listReviews as Handler, 'GET', '/api/admin/reviews', TOKENS.admin)
    expect(list.body.reviews[0]).toMatchObject({ id: review.id, reviewer_username: 'client_one', barber_business_name: 'Fade Factory' })
    const res = await call(patchReview as Handler, 'PATCH', '/x', TOKENS.admin, { isHidden: true }, { id: String(review.id) })
    expect(res.body.review.is_hidden).toBe(true)
    expect((await call(listReviews as Handler, 'GET', '/api/admin/reviews?hidden=false', TOKENS.admin)).body.reviews).toEqual([])
  })
})

describe('DELETE /api/admin/media', () => {
  it('removes the object and clears avatar, cover and portfolio references', async () => {
    const url = storageUrl('media', `${IDS.barberUser}/p.jpg`)
    const keep = storageUrl('media', `${IDS.barberUser}/keep.jpg`)
    mockDb.putObject('media', `${IDS.barberUser}/p.jpg`) // older naming: admin removal still works
    Object.assign(mockDb.one('profiles', { id: IDS.barberUser })!, { avatar_url: url, cover_photo_url: keep })
    mockDb.one('barbers', { id: IDS.barber })!.portfolio = [url, keep]

    const res = await call(deleteMedia as Handler, 'DELETE', '/x', TOKENS.admin, { url })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ removed: true, cleared: ['avatar_url', 'portfolio'] })
    expect(mockDb.storedObjects()).toEqual([])
    expect(mockDb.one('profiles', { id: IDS.barberUser })).toMatchObject({ avatar_url: null, cover_photo_url: keep })
    expect(mockDb.one('barbers', { id: IDS.barber })?.portfolio).toEqual([keep])
  })

  it('rejects URLs outside this project\'s buckets', async () => {
    const res = await call(deleteMedia as Handler, 'DELETE', '/x', TOKENS.admin, { url: 'https://example.com/a.jpg' })
    expect(res.body.error.code).toBe('INVALID_IMAGE_URL')
  })
})
