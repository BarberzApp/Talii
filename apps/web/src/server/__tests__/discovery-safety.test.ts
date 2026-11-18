/**
 * @jest-environment node
 */
import type { FakeDb } from '@/server/testing/fake-supabase'
import { IDS, TEST_ENV, TOKENS, bookingRow, request, routeParams, seedMarketplace } from '@/server/testing/fixtures'
import { addReview, installApiFunctions, refreshReviewViews, storageUrl } from '@/server/testing/api-fakes'
import { GET as listBarbers } from '@/app/api/barbers/route'
import { GET as getBarber } from '@/app/api/barbers/[id]/route'
import { GET as getByUsername } from '@/app/api/barbers/by-username/[username]/route'
import { GET as getReviews } from '@/app/api/barbers/[id]/reviews/route'
import { GET as ownReviews, POST as createReview } from '@/app/api/reviews/route'
import { DELETE as deleteReview, PATCH as patchReview } from '@/app/api/reviews/[id]/route'
import { POST as createReport } from '@/app/api/reports/route'
import { GET as listBlocks, POST as block } from '@/app/api/blocks/route'
import { DELETE as unblock } from '@/app/api/blocks/[userId]/route'

let mockDb: FakeDb
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => ({}) }))
jest.mock('@/server/env', () => ({ getServerEnv: () => TEST_ENV }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

const BARBER_TWO = '20000000-0000-4000-8000-000000000002'
const BARBER_TWO_USER = '10000000-0000-4000-8000-000000000005'
const HIDDEN_BARBER = '20000000-0000-4000-8000-000000000003'
const HIDDEN_USER = '10000000-0000-4000-8000-000000000006'

beforeEach(() => {
  mockDb = installApiFunctions(seedMarketplace())
  mockDb.unique.blocked_users = []
  mockDb.constraints.blocked_users = (c, others) =>
    others.some((o) => o.blocker_id === c.blocker_id && o.blocked_id === c.blocked_id)
      ? { code: '23505', message: 'duplicate' }
      : null
  mockDb.constraints.reviews = (c, others) =>
    others.some((o) => o.booking_id === c.booking_id) ? { code: '23505', message: 'duplicate booking_id' } : null

  Object.assign(mockDb.one('barbers', { id: IDS.barber })!, {
    city: 'Brooklyn',
    state: 'NY',
    latitude: 40.68,
    longitude: -73.94,
    bio: 'Fades',
    specialties: ['fade'],
    portfolio: [],
  })
  mockDb.table('profiles').push(
    { id: BARBER_TWO_USER, role: 'barber', name: 'Sam Sharp', username: 'sharp_lines', is_disabled: false },
    { id: HIDDEN_USER, role: 'barber', name: 'Hidden', username: 'hidden_one', is_disabled: false }
  )
  mockDb.table('barbers').push(
    { id: BARBER_TWO, user_id: BARBER_TWO_USER, business_name: 'Sharp Lines', city: 'Queens', state: 'NY', latitude: 40.72, longitude: -73.79, is_public: true, timezone: 'America/New_York', specialties: [], portfolio: [] },
    { id: HIDDEN_BARBER, user_id: HIDDEN_USER, business_name: 'Sharp Hidden', city: 'Queens', latitude: 40.72, longitude: -73.79, is_public: false, timezone: 'America/New_York', specialties: [], portfolio: [] }
  )
  refreshReviewViews(mockDb)
})

type Handler = (req: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>

async function call(handler: Handler, method: string, url: string, token?: string, body?: unknown, params?: Record<string, string>) {
  const req = request(url, { method, token, body })
  const res = params ? await handler(req, routeParams(params)) : await handler(req)
  return { status: res.status, body: await res.json() }
}

const ids = (list: Array<{ id: string }>) => list.map((x) => x.id)

describe('GET /api/barbers', () => {
  it('searches listed barbers by name/business/city with rating stats', async () => {
    addReview(mockDb, { barber_id: BARBER_TWO, rating: 4 })
    const res = await call(listBarbers as Handler, 'GET', '/api/barbers?q=sharp')
    expect(res.status).toBe(200)
    expect(ids(res.body.barbers)).toEqual([BARBER_TWO])
    expect(res.body.barbers[0]).toMatchObject({ username: 'sharp_lines', distance_miles: null, rating: { review_count: 1, average_rating: 4 } })
    expect(res.body.pagination).toEqual({ limit: 20, offset: 0, hasMore: false })

    const all = await call(listBarbers as Handler, 'GET', '/api/barbers')
    expect(ids(all.body.barbers).sort()).toEqual([IDS.barber, BARBER_TWO].sort())
    expect(all.body.barbers.find((b: { id: string }) => b.id === IDS.barber).rating).toEqual({ review_count: 0, average_rating: null })
  })

  it('pages with hasMore', async () => {
    const res = await call(listBarbers as Handler, 'GET', '/api/barbers?limit=1')
    expect(res.body.barbers).toHaveLength(1)
    expect(res.body.pagination.hasMore).toBe(true)
  })

  it('finds nearby barbers nearest first, narrowed by q', async () => {
    const res = await call(listBarbers as Handler, 'GET', '/api/barbers?lat=40.68&lng=-73.94&radiusMiles=20')
    expect(ids(res.body.barbers)).toEqual([IDS.barber, BARBER_TWO])
    expect(res.body.barbers[0].distance_miles).toBe(0)
    const narrowed = await call(listBarbers as Handler, 'GET', '/api/barbers?lat=40.68&lng=-73.94&q=queens')
    expect(ids(narrowed.body.barbers)).toEqual([BARBER_TWO])
  })

  it('validates the query', async () => {
    expect((await call(listBarbers as Handler, 'GET', '/api/barbers?lat=40')).status).toBe(400)
    expect((await call(listBarbers as Handler, 'GET', '/api/barbers?lat=91&lng=0')).status).toBe(400)
    expect((await call(listBarbers as Handler, 'GET', '/api/barbers?limit=500')).status).toBe(400)
  })

  it('leaves out barbers blocked either way for a signed-in caller', async () => {
    mockDb.table('blocked_users').push({ id: 'bl1', blocker_id: IDS.clientUser, blocked_id: BARBER_TWO_USER })
    const search = await call(listBarbers as Handler, 'GET', '/api/barbers', TOKENS.client)
    expect(ids(search.body.barbers)).toEqual([IDS.barber])
    const nearby = await call(listBarbers as Handler, 'GET', '/api/barbers?lat=40.68&lng=-73.94', TOKENS.client)
    expect(ids(nearby.body.barbers)).toEqual([IDS.barber])

    // The barber blocked the stranger: hidden for the stranger too.
    mockDb.table('blocked_users').push({ id: 'bl2', blocker_id: IDS.barberUser, blocked_id: IDS.strangerUser })
    expect(ids((await call(listBarbers as Handler, 'GET', '/api/barbers', TOKENS.stranger)).body.barbers)).toEqual([BARBER_TWO])

    // Anonymous and invalid tokens see everyone.
    expect((await call(listBarbers as Handler, 'GET', '/api/barbers', 'bad-token')).body.barbers).toHaveLength(2)
  })
})

describe('GET /api/barbers/:id and by-username', () => {
  it('returns the public profile with active services, add-ons and rating', async () => {
    const res = await call(getBarber as Handler, 'GET', '', undefined, undefined, { id: IDS.barber })
    expect(res.status).toBe(200)
    expect(res.body.barber).toMatchObject({ id: IDS.barber, business_name: 'Fade Factory', timezone: 'America/New_York' })
    expect(res.body.profile).toEqual({ id: IDS.barberUser, name: 'barber_one', username: 'barber_one', avatar_url: null, cover_photo_url: null })
    expect(ids(res.body.services)).toEqual([IDS.service])
    expect(ids(res.body.addons)).toEqual([IDS.addon])
    expect(res.body.rating).toEqual({ review_count: 0, average_rating: null })
    const text = JSON.stringify(res.body)
    expect(text).not.toContain('@example.test')
    expect(text).not.toContain(IDS.stripeAccount)
  })

  it('hides a barber an admin suspended, even with is_public true', async () => {
    mockDb.one('barbers', { id: BARBER_TWO })!.listing_suspended = true
    expect((await call(getBarber as Handler, 'GET', '', undefined, undefined, { id: BARBER_TWO })).status).toBe(404)
    expect((await call(getByUsername as Handler, 'GET', '', undefined, undefined, { username: 'sharp_lines' })).status).toBe(404)
    expect((await call(getReviews as Handler, 'GET', '/x', undefined, undefined, { id: BARBER_TWO })).status).toBe(404)
    expect(ids((await call(listBarbers as Handler, 'GET', '/api/barbers')).body.barbers)).toEqual([IDS.barber])
    expect(ids((await call(listBarbers as Handler, 'GET', '/api/barbers?lat=40.68&lng=-73.94')).body.barbers)).toEqual([IDS.barber])
  })

  it('404s for unlisted, disabled, unknown and blocked barbers', async () => {
    expect((await call(getBarber as Handler, 'GET', '', undefined, undefined, { id: HIDDEN_BARBER })).status).toBe(404)
    mockDb.one('profiles', { id: BARBER_TWO_USER })!.is_disabled = true
    expect((await call(getBarber as Handler, 'GET', '', undefined, undefined, { id: BARBER_TWO })).status).toBe(404)
    expect((await call(getBarber as Handler, 'GET', '', undefined, undefined, { id: '20000000-0000-4000-8000-0000000000ff' })).status).toBe(404)
    expect((await call(getBarber as Handler, 'GET', '', undefined, undefined, { id: 'not-a-uuid' })).status).toBe(400)

    mockDb.table('blocked_users').push({ id: 'bl1', blocker_id: IDS.barberUser, blocked_id: IDS.clientUser })
    expect((await call(getBarber as Handler, 'GET', '', TOKENS.client, undefined, { id: IDS.barber })).status).toBe(404)
    expect((await call(getBarber as Handler, 'GET', '', undefined, undefined, { id: IDS.barber })).status).toBe(200)
  })

  it('finds a barber by username ignoring case', async () => {
    const res = await call(getByUsername as Handler, 'GET', '', undefined, undefined, { username: 'SHARP_LINES' })
    expect(res.status).toBe(200)
    expect(res.body.barber.id).toBe(BARBER_TWO)
    expect((await call(getByUsername as Handler, 'GET', '', undefined, undefined, { username: 'sharpxlines' })).status).toBe(404)
    // "_" is escaped for ilike: a look-alike username cannot push out the exact match.
    mockDb.table('profiles').push({ id: '10000000-0000-4000-8000-000000000077', role: 'client', username: 'sharpXlines', is_disabled: false })
    expect((await call(getByUsername as Handler, 'GET', '', undefined, undefined, { username: 'sharp_lines' })).body.barber.id).toBe(BARBER_TWO)
    expect((await call(getByUsername as Handler, 'GET', '', undefined, undefined, { username: 'client_one' })).status).toBe(404)
    expect((await call(getByUsername as Handler, 'GET', '', undefined, undefined, { username: 'a b' })).status).toBe(400)
  })
})

describe('GET /api/barbers/:id/reviews', () => {
  it('pages visible reviews newest first and hides blocked reviewers for the caller', async () => {
    addReview(mockDb, { client_id: IDS.clientUser, rating: 5, comment: 'Great', created_at: '2026-01-02T00:00:00Z' })
    addReview(mockDb, { client_id: IDS.strangerUser, rating: 3, comment: 'Ok', created_at: '2026-01-03T00:00:00Z' })
    addReview(mockDb, { client_id: IDS.adminUser, rating: 1, comment: 'hidden', is_hidden: true })

    const res = await call(getReviews as Handler, 'GET', '/api/barbers/x/reviews?limit=1', undefined, undefined, { id: IDS.barber })
    expect(res.status).toBe(200)
    expect(res.body.reviews).toHaveLength(1)
    expect(res.body.reviews[0]).toMatchObject({ comment: 'Ok', reviewer_name: 'stranger' })
    expect(res.body.reviews[0].client_id).toBeUndefined()
    expect(res.body.pagination).toEqual({ limit: 1, offset: 0, total: 2 })
    expect(res.body.rating).toEqual({ review_count: 2, average_rating: 4 })

    mockDb.table('blocked_users').push({ id: 'bl1', blocker_id: IDS.clientUser, blocked_id: IDS.strangerUser })
    const filtered = await call(getReviews as Handler, 'GET', '/api/barbers/x/reviews', TOKENS.client, undefined, { id: IDS.barber })
    expect(filtered.body.reviews.map((r: { comment: string }) => r.comment)).toEqual(['Great'])
  })

  it('404s for an unlisted barber', async () => {
    expect((await call(getReviews as Handler, 'GET', '/x', undefined, undefined, { id: HIDDEN_BARBER })).status).toBe(404)
  })
})

describe('/api/reviews', () => {
  const COMPLETED = '60000000-0000-4000-8000-000000000011'
  const CONFIRMED = '60000000-0000-4000-8000-000000000012'

  beforeEach(() => {
    mockDb.table('bookings').push(
      bookingRow({ id: COMPLETED, status: 'completed' }),
      bookingRow({ id: CONFIRMED, status: 'confirmed', starts_at: '2026-04-01T15:00:00.000Z', ends_at: '2026-04-01T15:30:00.000Z' })
    )
  })

  it('lets the client review a completed booking once', async () => {
    const res = await call(createReview as Handler, 'POST', '/api/reviews', TOKENS.client, { bookingId: COMPLETED, rating: 5, comment: ' Great cut ' })
    expect(res.status).toBe(201)
    expect(res.body.review).toMatchObject({ booking_id: COMPLETED, barber_id: IDS.barber, rating: 5, comment: 'Great cut' })
    expect(mockDb.one('reviews', { booking_id: COMPLETED })?.client_id).toBe(IDS.clientUser)

    const again = await call(createReview as Handler, 'POST', '/api/reviews', TOKENS.client, { bookingId: COMPLETED, rating: 4 })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('ALREADY_REVIEWED')

    const mine = await call(ownReviews as Handler, 'GET', `/api/reviews?bookingId=${COMPLETED}`, TOKENS.client)
    expect(mine.body.reviews).toHaveLength(1)
  })

  it('refuses other users, unfinished bookings, bad ratings and offensive comments', async () => {
    expect((await call(createReview as Handler, 'POST', '/api/reviews', undefined, { bookingId: COMPLETED, rating: 5 })).status).toBe(401)
    expect((await call(createReview as Handler, 'POST', '/api/reviews', TOKENS.stranger, { bookingId: COMPLETED, rating: 5 })).status).toBe(404)
    expect((await call(createReview as Handler, 'POST', '/api/reviews', TOKENS.barber, { bookingId: COMPLETED, rating: 5 })).status).toBe(404)
    const early = await call(createReview as Handler, 'POST', '/api/reviews', TOKENS.client, { bookingId: CONFIRMED, rating: 5 })
    expect(early.body.error.code).toBe('BOOKING_NOT_COMPLETED')
    for (const rating of [0, 6, 4.5]) {
      expect((await call(createReview as Handler, 'POST', '/api/reviews', TOKENS.client, { bookingId: COMPLETED, rating })).status).toBe(400)
    }
    const rude = await call(createReview as Handler, 'POST', '/api/reviews', TOKENS.client, { bookingId: COMPLETED, rating: 1, comment: 'what the hell' })
    expect(rude.body.error.code).toBe('INAPPROPRIATE_CONTENT')
    expect(
      (await call(createReview as Handler, 'POST', '/api/reviews', TOKENS.client, { bookingId: COMPLETED, rating: 5, comment: 'Hello, first class cut' })).status
    ).toBe(201)
    expect(mockDb.table('reviews')).toHaveLength(1)
  })

  it('lets only the author edit or delete a review', async () => {
    const review = addReview(mockDb, { booking_id: COMPLETED, client_id: IDS.clientUser })
    expect((await call(patchReview as Handler, 'PATCH', '', TOKENS.stranger, { rating: 1 }, { id: String(review.id) })).status).toBe(404)
    expect((await call(patchReview as Handler, 'PATCH', '', TOKENS.client, { comment: 'damn' }, { id: String(review.id) })).status).toBe(400)
    const ok = await call(patchReview as Handler, 'PATCH', '', TOKENS.client, { rating: 4, comment: null }, { id: String(review.id) })
    expect(ok.body.review).toMatchObject({ rating: 4, comment: null })
    expect((await call(patchReview as Handler, 'PATCH', '', TOKENS.client, {}, { id: String(review.id) })).status).toBe(400)

    expect((await call(deleteReview as Handler, 'DELETE', '', TOKENS.barber, undefined, { id: String(review.id) })).status).toBe(404)
    expect((await call(deleteReview as Handler, 'DELETE', '', TOKENS.client, undefined, { id: String(review.id) })).body).toEqual({ deleted: true })
    expect(mockDb.table('reviews')).toHaveLength(0)
  })

  it('refuses edits and deletes of a hidden review, so it cannot be removed and reposted', async () => {
    const review = addReview(mockDb, { booking_id: COMPLETED, client_id: IDS.clientUser, comment: 'spam', is_hidden: true })
    const edit = await call(patchReview as Handler, 'PATCH', '', TOKENS.client, { comment: 'nice' }, { id: String(review.id) })
    expect(edit.status).toBe(409)
    expect(edit.body.error.code).toBe('REVIEW_HIDDEN')
    const del = await call(deleteReview as Handler, 'DELETE', '', TOKENS.client, undefined, { id: String(review.id) })
    expect(del.status).toBe(409)
    expect(del.body.error.code).toBe('REVIEW_HIDDEN')
    expect(mockDb.one('reviews', { id: review.id })).toMatchObject({ comment: 'spam', is_hidden: true })

    const repost = await call(createReview as Handler, 'POST', '/api/reviews', TOKENS.client, { bookingId: COMPLETED, rating: 5, comment: 'new' })
    expect(repost.status).toBe(409)
    expect(repost.body.error.code).toBe('ALREADY_REVIEWED')

    // Someone else gets 404, not a hint that the review exists.
    expect((await call(deleteReview as Handler, 'DELETE', '', TOKENS.stranger, undefined, { id: String(review.id) })).status).toBe(404)
  })
})

describe('POST /api/reports', () => {
  it('reports a user, deriving the reported user on the server', async () => {
    const res = await call(createReport as Handler, 'POST', '/api/reports', TOKENS.client, {
      contentType: 'user',
      contentId: IDS.strangerUser,
      reason: 'harassment',
      details: 'rude messages',
    })
    expect(res.status).toBe(201)
    expect(res.body.report).toMatchObject({ content_type: 'user', content_id: IDS.strangerUser, reason: 'harassment', status: 'pending' })
    expect(res.body.report).not.toHaveProperty('reported_user_id')
    expect(res.body.report).not.toHaveProperty('reporter_id')
    expect(mockDb.table('reports')[0]).toMatchObject({ reporter_id: IDS.clientUser, reported_user_id: IDS.strangerUser })

    const again = await call(createReport as Handler, 'POST', '/api/reports', TOKENS.client, { contentType: 'user', contentId: IDS.strangerUser, reason: 'spam' })
    expect(again.status).toBe(200)
    expect(again.body.report).not.toHaveProperty('reported_user_id')
    expect(mockDb.table('reports')).toHaveLength(1)
  })

  it('reports a review (author from the review) and an image (owner from the URL)', async () => {
    const review = addReview(mockDb, { client_id: IDS.strangerUser })
    const r1 = await call(createReport as Handler, 'POST', '/api/reports', TOKENS.client, { contentType: 'review', contentId: review.id, reason: 'spam' })
    // The reviewer stays anonymous to the reporter; only the stored row (admin view) knows them.
    expect(r1.body.report).not.toHaveProperty('reported_user_id')
    expect(JSON.stringify(r1.body)).not.toContain(IDS.strangerUser)
    expect(mockDb.one('reports', { content_id: review.id })?.reported_user_id).toBe(IDS.strangerUser)

    const url = storageUrl('media', `${IDS.barberUser}/x.jpg`)
    const r2 = await call(createReport as Handler, 'POST', '/api/reports', TOKENS.client, { contentType: 'image', contentId: url, reason: 'sexual_content' })
    expect(r2.status).toBe(201)
    expect(r2.body.report).not.toHaveProperty('reported_user_id')
    expect(mockDb.one('reports', { content_type: 'image' })?.reported_user_id).toBe(IDS.barberUser)
  })

  it('validates and refuses self-reports', async () => {
    expect((await call(createReport as Handler, 'POST', '/api/reports', undefined, { contentType: 'user', contentId: IDS.strangerUser, reason: 'spam' })).status).toBe(401)
    expect((await call(createReport as Handler, 'POST', '/api/reports', TOKENS.client, { contentType: 'user', contentId: IDS.clientUser, reason: 'spam' })).body.error.code).toBe('CANNOT_REPORT_SELF')
    expect((await call(createReport as Handler, 'POST', '/api/reports', TOKENS.client, { contentType: 'user', contentId: IDS.strangerUser, reason: 'meh' })).status).toBe(400)
    expect((await call(createReport as Handler, 'POST', '/api/reports', TOKENS.client, { contentType: 'review', contentId: 'nope', reason: 'spam' })).status).toBe(400)
    expect((await call(createReport as Handler, 'POST', '/api/reports', TOKENS.client, { contentType: 'user', contentId: '10000000-0000-4000-8000-0000000000ff', reason: 'spam' })).status).toBe(404)
    expect((await call(createReport as Handler, 'POST', '/api/reports', TOKENS.client, { contentType: 'image', contentId: 'https://evil.test/x.jpg', reason: 'spam' })).status).toBe(400)
    expect(
      (await call(createReport as Handler, 'POST', '/api/reports', TOKENS.client, { contentType: 'user', contentId: IDS.strangerUser, reason: 'spam', reporterId: IDS.adminUser })).status
    ).toBe(400)
  })
})

describe('/api/blocks', () => {
  it('blocks, lists and unblocks', async () => {
    const res = await call(block as Handler, 'POST', '/api/blocks', TOKENS.client, { userId: IDS.strangerUser })
    expect(res.status).toBe(201)
    expect(mockDb.table('blocked_users')).toEqual([expect.objectContaining({ blocker_id: IDS.clientUser, blocked_id: IDS.strangerUser })])
    expect((await call(block as Handler, 'POST', '/api/blocks', TOKENS.client, { userId: IDS.strangerUser })).status).toBe(200)

    const list = await call(listBlocks as Handler, 'GET', '/api/blocks', TOKENS.client)
    expect(list.body.blocks).toEqual([expect.objectContaining({ userId: IDS.strangerUser, username: 'stranger' })])
    expect((await call(listBlocks as Handler, 'GET', '/api/blocks', TOKENS.stranger)).body.blocks).toEqual([])

    expect((await call(unblock as Handler, 'DELETE', '', TOKENS.client, undefined, { userId: IDS.strangerUser })).body).toEqual({ removed: true })
    expect((await call(unblock as Handler, 'DELETE', '', TOKENS.client, undefined, { userId: IDS.strangerUser })).body).toEqual({ removed: false })
  })

  it('refuses self-blocks, unknown users and missing tokens; unblock only removes own blocks', async () => {
    expect((await call(block as Handler, 'POST', '/api/blocks', TOKENS.client, { userId: IDS.clientUser })).body.error.code).toBe('CANNOT_BLOCK_SELF')
    expect((await call(block as Handler, 'POST', '/api/blocks', TOKENS.client, { userId: '10000000-0000-4000-8000-0000000000ff' })).status).toBe(404)
    expect((await call(block as Handler, 'POST', '/api/blocks', undefined, { userId: IDS.strangerUser })).status).toBe(401)
    expect((await call(listBlocks as Handler, 'GET', '/api/blocks')).status).toBe(401)

    mockDb.table('blocked_users').push({ id: 'bl9', blocker_id: IDS.strangerUser, blocked_id: IDS.clientUser })
    expect((await call(unblock as Handler, 'DELETE', '', TOKENS.client, undefined, { userId: IDS.strangerUser })).body).toEqual({ removed: false })
    expect(mockDb.table('blocked_users')).toHaveLength(1)
  })
})
