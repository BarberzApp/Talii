/**
 * @jest-environment node
 */
import type { FakeDb } from '@/server/testing/fake-supabase'
import { createFakeStripe, type FakeStripe } from '@/server/testing/fake-stripe'
import { IDS, TEST_ENV, TOKENS, bookingRow, request, seedMarketplace } from '@/server/testing/fixtures'
import { installApiFunctions, storageUrl } from '@/server/testing/api-fakes'
import { DELETE as deleteMe, GET as getMe, PATCH as patchMe } from '@/app/api/me/route'
import { POST as becomeBarber } from '@/app/api/me/barber/route'
import { POST as createUpload } from '@/app/api/uploads/route'

let mockDb: FakeDb
let mockStripe: FakeStripe
let mockEnv: Record<string, string | undefined>
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => mockStripe }))
jest.mock('@/server/env', () => ({ getServerEnv: () => mockEnv }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

const fetchMock = jest.fn()
const FILE = '11111111-1111-4111-8111-111111111111.jpg'
const NOW = new Date('2026-03-01T12:00:00Z')

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
  mockDb = installApiFunctions(seedMarketplace())
  mockDb.unique.profiles = ['username']
  mockDb.unique.barbers = ['user_id']
  mockStripe = createFakeStripe()
  mockEnv = { ...TEST_ENV, GOOGLE_MAPS_API_KEY: 'test-maps-key' }
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  jest.useRealTimers()
})

async function call(handler: (req: Request) => Promise<Response>, method: string, url: string, token?: string, body?: unknown) {
  const res = await handler(request(url, { method, token, body }))
  return { status: res.status, body: await res.json() }
}

function googleGeocode(lat: number, lng: number) {
  return {
    ok: true,
    json: async () => ({
      status: 'OK',
      results: [{ place_id: 'p1', formatted_address: 'Brooklyn, NY', geometry: { location: { lat, lng } }, address_components: [] }],
    }),
  }
}

describe('GET /api/me', () => {
  it('needs a token', async () => {
    expect((await call(getMe, 'GET', '/api/me')).status).toBe(401)
  })

  it('returns a client profile without barber data', async () => {
    const res = await call(getMe, 'GET', '/api/me', TOKENS.client)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      user: { id: IDS.clientUser },
      isAdmin: false,
      profile: { id: IDS.clientUser, username: 'client_one' },
      barber: null,
      billing: null,
    })
  })

  it('returns the barber row and billing flags for a barber', async () => {
    const res = await call(getMe, 'GET', '/api/me', TOKENS.barber)
    expect(res.body.barber).toMatchObject({ id: IDS.barber, business_name: 'Fade Factory' })
    expect(res.body.billing).toEqual({ charges_enabled: true, details_submitted: true, fee_exempt: false })
    expect(JSON.stringify(res.body)).not.toContain(IDS.stripeAccount)
  })

  it('reports admins', async () => {
    expect((await call(getMe, 'GET', '/api/me', TOKENS.admin)).body.isAdmin).toBe(true)
  })
})

describe('PATCH /api/me', () => {
  it('updates allow-listed profile fields', async () => {
    const res = await call(patchMe, 'PATCH', '/api/me', TOKENS.client, { name: '  Pat  ', phone: '+1 555 123 4567', username: 'pat_1' })
    expect(res.status).toBe(200)
    expect(mockDb.one('profiles', { id: IDS.clientUser })).toMatchObject({ name: 'Pat', phone: '+1 555 123 4567', username: 'pat_1' })
  })

  it('rejects fields outside the allow-list (role, is_disabled, ids)', async () => {
    for (const body of [{ role: 'barber' }, { is_disabled: false }, { id: IDS.strangerUser }, { latitude: 1 }]) {
      const res = await call(patchMe, 'PATCH', '/api/me', TOKENS.client, body)
      expect(res.status).toBe(400)
    }
    expect(mockDb.one('profiles', { id: IDS.clientUser })?.role).toBe('client')
  })

  it('rejects an empty body and a bad username format', async () => {
    expect((await call(patchMe, 'PATCH', '/api/me', TOKENS.client, {})).status).toBe(400)
    expect((await call(patchMe, 'PATCH', '/api/me', TOKENS.client, { username: 'no spaces' })).status).toBe(400)
  })

  it('returns 409 USERNAME_TAKEN for a taken username', async () => {
    const res = await call(patchMe, 'PATCH', '/api/me', TOKENS.client, { username: 'stranger' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('USERNAME_TAKEN')
  })

  it('only accepts image URLs of the exact /api/uploads shape in the caller\'s own folder', async () => {
    const own = storageUrl('avatars', `${IDS.clientUser}/${FILE}`)
    expect((await call(patchMe, 'PATCH', '/api/me', TOKENS.client, { avatarUrl: own })).status).toBe(200)
    expect(mockDb.one('profiles', { id: IDS.clientUser })?.avatar_url).toBe(own)

    for (const url of [
      storageUrl('avatars', `${IDS.strangerUser}/${FILE}`),
      'https://evil.example.com/storage/v1/object/public/avatars/' + IDS.clientUser + '/' + FILE,
      storageUrl('private', `${IDS.clientUser}/${FILE}`),
      storageUrl('avatars', `${IDS.clientUser}/../${FILE}`),
      // Encoded traversal into another user's folder, and an encoded separator.
      storageUrl('avatars', `${IDS.clientUser}/..%2F${IDS.strangerUser}%2F${FILE}`),
      storageUrl('avatars', `${IDS.clientUser}/x%2F${FILE}`),
      // Not the shape /api/uploads produces.
      storageUrl('avatars', `${IDS.clientUser}/a.jpg`),
      storageUrl('avatars', `${IDS.clientUser}/sub/${FILE}`),
      storageUrl('avatars', `${IDS.clientUser}/${FILE}.exe`),
      `${storageUrl('avatars', `${IDS.clientUser}/${FILE}`)}?x=1`,
    ]) {
      const res = await call(patchMe, 'PATCH', '/api/me', TOKENS.client, { coverPhotoUrl: url })
      expect(res.status).toBe(400)
    }
    expect((await call(patchMe, 'PATCH', '/api/me', TOKENS.client, { avatarUrl: null })).status).toBe(200)
  })

  it('refuses barber fields for a client', async () => {
    const res = await call(patchMe, 'PATCH', '/api/me', TOKENS.client, { bio: 'hi' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NOT_A_BARBER')
  })

  it('updates barber fields, validates the time zone and geocodes a new city', async () => {
    fetchMock.mockResolvedValueOnce(googleGeocode(40.65, -73.95))
    const res = await call(patchMe, 'PATCH', '/api/me', TOKENS.barber, {
      bio: 'Fades',
      city: 'Brooklyn',
      state: 'NY',
      timezone: 'America/Chicago',
      specialties: ['fade'],
      portfolio: [storageUrl('media', `${IDS.barberUser}/${FILE}`)],
    })
    expect(res.status).toBe(200)
    expect(res.body.location).toEqual({ geocoded: true })
    expect(mockDb.one('barbers', { id: IDS.barber })).toMatchObject({
      bio: 'Fades',
      city: 'Brooklyn',
      timezone: 'America/Chicago',
      latitude: 40.65,
      longitude: -73.95,
    })
    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain('address=Brooklyn%2C+NY')

    expect((await call(patchMe, 'PATCH', '/api/me', TOKENS.barber, { timezone: 'Mars/Olympus' })).status).toBe(400)
  })

  it('tolerates geocoding failure and clears stale coordinates', async () => {
    Object.assign(mockDb.one('barbers', { id: IDS.barber })!, { city: 'Old', latitude: 1, longitude: 2 })
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const res = await call(patchMe, 'PATCH', '/api/me', TOKENS.barber, { city: 'Queens' })
    expect(res.status).toBe(200)
    expect(res.body.location).toEqual({ geocoded: false })
    expect(mockDb.one('barbers', { id: IDS.barber })).toMatchObject({ city: 'Queens', latitude: null, longitude: null })
  })

  it('does not geocode when the city is unchanged', async () => {
    await call(patchMe, 'PATCH', '/api/me', TOKENS.barber, { isPublic: false })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockDb.one('barbers', { id: IDS.barber })?.is_public).toBe(false)
  })
})

describe('POST /api/me/barber', () => {
  it('turns a client into a barber once', async () => {
    const first = await call(becomeBarber, 'POST', '/api/me/barber', TOKENS.client, { businessName: 'New Shop', timezone: 'America/Denver' })
    expect(first.status).toBe(201)
    expect(first.body.barber).toMatchObject({ user_id: IDS.clientUser, business_name: 'New Shop', timezone: 'America/Denver' })
    expect(mockDb.one('profiles', { id: IDS.clientUser })?.role).toBe('barber')

    const again = await call(becomeBarber, 'POST', '/api/me/barber', TOKENS.client)
    expect(again.status).toBe(200)
    expect(again.body.created).toBe(false)
    expect(mockDb.rows('barbers', { user_id: IDS.clientUser })).toHaveLength(1)
  })

  it('needs a token and validates input', async () => {
    expect((await call(becomeBarber, 'POST', '/api/me/barber')).status).toBe(401)
    expect((await call(becomeBarber, 'POST', '/api/me/barber', TOKENS.client, { timezone: 'nope' })).status).toBe(400)
    expect((await call(becomeBarber, 'POST', '/api/me/barber', TOKENS.client, { userId: IDS.strangerUser })).status).toBe(400)
  })
})

describe('POST /api/uploads', () => {
  it('returns a signed upload URL under the caller\'s folder', async () => {
    const res = await call(createUpload, 'POST', '/api/uploads', TOKENS.client, {
      bucket: 'avatars',
      contentType: 'image/png',
      fileName: '../../evil.exe',
    })
    expect(res.status).toBe(200)
    expect(res.body.path).toMatch(new RegExp(`^${IDS.clientUser}/[0-9a-f-]{36}\\.png$`))
    expect(res.body.publicUrl).toBe(storageUrl('avatars', res.body.path))
    expect(res.body.token).toEqual(expect.any(String))
    expect(res.body.signedUrl).toContain('/upload/sign/avatars/')
    expect(res.body.maxBytes).toBe(5 * 1024 * 1024)
  })

  it('enforces bucket MIME types and size limits', async () => {
    const gifAvatar = await call(createUpload, 'POST', '/api/uploads', TOKENS.client, { bucket: 'avatars', contentType: 'image/gif', fileName: 'a.gif' })
    expect(gifAvatar.body.error.code).toBe('UNSUPPORTED_TYPE')
    const gifMedia = await call(createUpload, 'POST', '/api/uploads', TOKENS.client, { bucket: 'media', contentType: 'image/gif', fileName: 'a.gif' })
    expect(gifMedia.status).toBe(200)
    const big = await call(createUpload, 'POST', '/api/uploads', TOKENS.client, {
      bucket: 'avatars',
      contentType: 'image/jpeg',
      fileName: 'a.jpg',
      sizeBytes: 6 * 1024 * 1024,
    })
    expect(big.status).toBe(413)
    const svg = await call(createUpload, 'POST', '/api/uploads', TOKENS.client, { bucket: 'media', contentType: 'image/svg+xml', fileName: 'a.svg' })
    expect(svg.status).toBe(400)
    expect((await call(createUpload, 'POST', '/api/uploads', TOKENS.client, { bucket: 'other', contentType: 'image/png', fileName: 'a' })).status).toBe(400)
  })

  it('needs a token', async () => {
    expect((await call(createUpload, 'POST', '/api/uploads', undefined, { bucket: 'media', contentType: 'image/png', fileName: 'a' })).status).toBe(401)
  })
})

describe('DELETE /api/me', () => {
  const FUTURE = '2026-03-05T15:00:00.000Z'

  it('needs a token and explicit confirmation', async () => {
    expect((await call(deleteMe, 'DELETE', '/api/me')).status).toBe(401)
    expect((await call(deleteMe, 'DELETE', '/api/me', TOKENS.client)).status).toBe(400)
    expect((await call(deleteMe, 'DELETE', '/api/me', TOKENS.client, { confirm: false })).status).toBe(400)
    expect(mockDb.one('profiles', { id: IDS.clientUser })?.is_disabled).toBe(false)
  })

  it('cancels future bookings, scrubs the profile, removes files and bans the user', async () => {
    mockDb.table('bookings').push(
      bookingRow({ id: '60000000-0000-4000-8000-0000000000a1', starts_at: FUTURE, ends_at: '2026-03-05T15:30:00.000Z', payment_status: 'none', payment_intent_id: null, booking_fee_cents: 0 }),
      bookingRow({ id: '60000000-0000-4000-8000-0000000000a2', starts_at: '2026-02-01T15:00:00.000Z', ends_at: '2026-02-01T15:30:00.000Z', status: 'completed', payment_intent_id: 'pi_old' })
    )
    mockDb.putObject('avatars', `${IDS.clientUser}/a.jpg`)
    mockDb.putObject('media', `${IDS.clientUser}/nested/b.jpg`)
    mockDb.putObject('media', `${IDS.clientUser}/a/b/c/d/e/f/deep.jpg`) // removed at any depth
    mockDb.putObject('media', `${IDS.strangerUser}/c.jpg`)
    mockDb.table('blocked_users').push({ id: 'b1', blocker_id: IDS.clientUser, blocked_id: IDS.strangerUser })

    const res = await call(deleteMe, 'DELETE', '/api/me', TOKENS.client, { confirm: true })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ deleted: true, cancelledBookings: ['60000000-0000-4000-8000-0000000000a1'], removedFiles: 3, signInBlocked: true })

    expect(mockDb.one('bookings', { id: '60000000-0000-4000-8000-0000000000a1' })?.status).toBe('cancelled')
    expect(mockDb.one('bookings', { id: '60000000-0000-4000-8000-0000000000a2' })?.status).toBe('completed')
    const profile = mockDb.one('profiles', { id: IDS.clientUser })!
    expect(profile).toMatchObject({
      is_disabled: true,
      deleted_at: NOW.toISOString(),
      name: 'Deleted user',
      phone: null,
      email: null,
      avatar_url: null,
      username: 'client_one', // kept so it stays reserved
    })
    expect(mockDb.storedObjects()).toEqual([{ bucket: 'media', path: `${IDS.strangerUser}/c.jpg` }])
    expect(mockDb.table('blocked_users')).toHaveLength(0)
    expect(mockDb.adminUserDeletes).toEqual([{ id: IDS.clientUser, soft: true }])

    // The deleted account can no longer use the API.
    expect((await call(getMe, 'GET', '/api/me', TOKENS.client)).status).toBe(401)
  })

  it('unlists and scrubs a barber, deactivating services and deleting hours', async () => {
    mockDb.table('bookings').push(bookingRow({ id: '60000000-0000-4000-8000-0000000000b1', starts_at: FUTURE, ends_at: '2026-03-05T15:30:00.000Z' }))
    mockStripe.refunds.create.mockResolvedValue({ id: 're_1', amount: 340, status: 'succeeded', charge: 'ch_1', payment_intent: 'pi_test_1' })
    Object.assign(mockDb.one('barbers', { id: IDS.barber })!, { bio: 'x', portfolio: ['u'], city: 'NYC' })

    const res = await call(deleteMe, 'DELETE', '/api/me', TOKENS.barber, { confirm: true })
    expect(res.status).toBe(200)
    expect(mockDb.one('bookings', { id: '60000000-0000-4000-8000-0000000000b1' })).toMatchObject({ status: 'cancelled' })
    expect(mockStripe.refunds.create).toHaveBeenCalled() // barber cancels → client refunded in full
    expect(mockDb.one('barbers', { id: IDS.barber })).toMatchObject({ is_public: false, bio: null, portfolio: [], city: null, business_name: 'Fade Factory' })
    expect(mockDb.rows('services', { barber_id: IDS.barber }).every((s) => s.is_active === false)).toBe(true)
    expect(mockDb.rows('availability', { barber_id: IDS.barber })).toHaveLength(0)
    expect(mockDb.one('barber_billing', { barber_id: IDS.barber })).toBeDefined()
  })

  it('refuses with 409 HAS_UPCOMING_BOOKINGS, listing what was and was not cancelled', async () => {
    const OK = '60000000-0000-4000-8000-0000000000c1'
    const STUCK = '60000000-0000-4000-8000-0000000000c2'
    mockDb.table('bookings').push(
      bookingRow({ id: OK, starts_at: FUTURE, ends_at: '2026-03-05T15:30:00.000Z', payment_intent_id: 'pi_ok' }),
      bookingRow({ id: STUCK, starts_at: '2026-03-06T15:00:00.000Z', ends_at: '2026-03-06T15:30:00.000Z', payment_intent_id: 'pi_stuck' })
    )
    mockStripe.refunds.create.mockImplementation(async (params: { payment_intent: string }) => ({
      id: `re_${params.payment_intent}`,
      amount: 340,
      status: 'succeeded',
      charge: 'ch_1',
      payment_intent: params.payment_intent,
    }))
    // The first booking cancels; the second booking's write fails after its refund was issued.
    const original = mockDb.from.bind(mockDb)
    let bookingUpdates = 0
    mockDb.from = (table: string) => {
      const q = original(table)
      if (table === 'bookings') {
        const update = q.update.bind(q)
        q.update = (payload) => {
          bookingUpdates += 1
          if (bookingUpdates === 2) mockDb.failNext('bookings', 'update', { message: 'db down' })
          return update(payload)
        }
      }
      return q
    }

    const res = await call(deleteMe, 'DELETE', '/api/me', TOKENS.client, { confirm: true })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('HAS_UPCOMING_BOOKINGS')
    expect(res.body.error.message).toMatch(/not deleted/)
    expect(res.body.cancelledBookings).toEqual([OK])
    expect(res.body.bookings).toEqual([expect.objectContaining({ id: STUCK, as: 'client' })])
    expect(mockDb.one('bookings', { id: OK })?.status).toBe('cancelled')
    expect(mockDb.one('bookings', { id: STUCK })?.status).toBe('confirmed')
    // The stuck booking's refund used a fixed idempotency key, so a retry cannot refund twice.
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_stuck' }),
      expect.objectContaining({ idempotencyKey: `booking-${STUCK}-cancel-refund` })
    )
    expect(mockDb.one('profiles', { id: IDS.clientUser })?.is_disabled).toBe(false)
    expect(mockDb.one('profiles', { id: IDS.clientUser })?.deleted_at).toBeUndefined()
    expect(mockDb.adminUserDeletes).toHaveLength(0)
  })

  it('still disables the account when the auth delete fails', async () => {
    mockDb.failNext('auth.users', 'delete', { message: 'auth down' })
    const res = await call(deleteMe, 'DELETE', '/api/me', TOKENS.client, { confirm: true })
    expect(res.status).toBe(200)
    expect(res.body.signInBlocked).toBe(false)
    expect(mockDb.one('profiles', { id: IDS.clientUser })?.is_disabled).toBe(true)
  })
})
