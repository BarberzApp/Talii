import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApiClient } from './client'
import { ApiError, hasErrorCode, isApiError } from './errors'
import { bookingErrorMessage } from './messages'

type Call = { url: string; init: RequestInit }

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fn = (async (url: string, init: RequestInit) => {
    const call = { url: String(url), init }
    calls.push(call)
    return respond(call)
  }) as unknown as typeof fetch
  return { fn, calls }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function headersOf(call: Call): Record<string, string> {
  return (call.init.headers ?? {}) as Record<string, string>
}

test('attaches the Bearer token, JSON body and method', async () => {
  const { fn, calls } = fakeFetch(() => json(201, { booking: { id: 'b1' }, clientSecret: null }))
  const api = createApiClient({ baseUrl: 'https://api.example.com/', getAccessToken: async () => 'tok-123', fetch: fn })

  const result = await api.bookings.create({ barberId: 'x', serviceId: 'y', startsAt: '2026-01-01T10:00:00.000Z' })

  assert.deepEqual(result, { booking: { id: 'b1' }, clientSecret: null })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.example.com/api/bookings')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(headersOf(calls[0]).Authorization, 'Bearer tok-123')
  assert.equal(headersOf(calls[0])['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    barberId: 'x',
    serviceId: 'y',
    startsAt: '2026-01-01T10:00:00.000Z',
  })
})

test('builds query strings: skips empty values, joins arrays with commas, encodes', async () => {
  const { fn, calls } = fakeFetch(() => json(200, { bookings: [], pagination: { limit: 20, offset: 0, total: 0 } }))
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 't', fetch: fn })

  await api.bookings.list({ as: 'barber', status: ['pending', 'confirmed'], from: undefined, limit: 5 })
  assert.equal(calls[0].url, '/api/bookings?as=barber&status=pending%2Cconfirmed&limit=5')

  await api.barbers.getByUsername('a b/c')
  assert.equal(calls[1].url, '/api/barbers/by-username/a%20b%2Fc')
})

test('required auth without a session fails with 401 before any request', async () => {
  const { fn, calls } = fakeFetch(() => json(200, {}))
  const api = createApiClient({ baseUrl: '', getAccessToken: async () => null, fetch: fn })

  await assert.rejects(api.me.get(), (e: unknown) => isApiError(e) && e.status === 401 && e.code === 'UNAUTHORIZED')
  assert.equal(calls.length, 0)
})

test('optional auth sends the token when present and nothing when signed out', async () => {
  const { fn, calls } = fakeFetch(() => json(200, { barbers: [], pagination: { limit: 20, offset: 0, hasMore: false } }))
  let token: string | null = 'tok'
  const api = createApiClient({ baseUrl: '', getAccessToken: () => token, fetch: fn })

  await api.barbers.list({ q: 'fade' })
  assert.equal(headersOf(calls[0]).Authorization, 'Bearer tok')

  token = null
  await api.barbers.list()
  assert.equal(headersOf(calls[1]).Authorization, undefined)
  assert.equal(calls[1].url, '/api/barbers')
})

test('public routes never send the token', async () => {
  const { fn, calls } = fakeFetch(() => json(200, { success: true }))
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 'secret-token', fetch: fn })

  await api.waitlist.join('a@b.co')
  assert.equal(headersOf(calls[0]).Authorization, undefined)
})

test('a token getter that throws is treated as signed out', async () => {
  const { fn, calls } = fakeFetch(() => json(200, { barbers: [], pagination: { limit: 20, offset: 0, hasMore: false } }))
  const api = createApiClient({
    baseUrl: '',
    getAccessToken: () => {
      throw new Error('storage unavailable')
    },
    fetch: fn,
  })

  await api.barbers.list()
  assert.equal(headersOf(calls[0]).Authorization, undefined)
  await assert.rejects(api.me.get(), (e: unknown) => isApiError(e) && e.code === 'UNAUTHORIZED')
})

test('parses { error: { code, message } } into ApiError with status, code and extra details', async () => {
  const { fn } = fakeFetch(() => json(409, { error: { code: 'SLOT_TAKEN', message: 'That time was just booked.' } }))
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 't', fetch: fn })

  const error = await api.bookings.create({ barberId: 'a', serviceId: 'b', startsAt: 'c' }).catch((e) => e)
  assert.ok(error instanceof ApiError)
  assert.equal(error.status, 409)
  assert.equal(error.code, 'SLOT_TAKEN')
  assert.equal(error.message, 'That time was just booked.')
  assert.equal(error.details, undefined)
  assert.ok(hasErrorCode(error, 'SLOT_TAKEN', 'BARBER_NOT_READY'))
  assert.match(bookingErrorMessage(error), /pick another slot/)

  const { fn: fn2 } = fakeFetch(() =>
    json(409, { error: { code: 'HAS_UPCOMING_BOOKINGS', message: 'Not deleted.' }, bookings: [{ id: 'b1' }], cancelledBookings: [] })
  )
  const api2 = createApiClient({ baseUrl: '', getAccessToken: () => 't', fetch: fn2 })
  const error2 = await api2.me.delete().catch((e) => e)
  assert.equal(error2.code, 'HAS_UPCOMING_BOOKINGS')
  assert.deepEqual(error2.details, { bookings: [{ id: 'b1' }], cancelledBookings: [] })
})

test('non-JSON and unexpected error bodies still become ApiError', async () => {
  const { fn } = fakeFetch(() => new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }))
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 't', fetch: fn })
  const error = await api.me.get().catch((e) => e)
  assert.ok(error instanceof ApiError)
  assert.equal(error.status, 502)
  assert.equal(error.code, 'HTTP_502')
  assert.equal(error.message, 'Bad Gateway')
})

test('204 resolves to undefined', async () => {
  const { fn } = fakeFetch(() => new Response(null, { status: 204 }))
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 't', fetch: fn })
  assert.equal(await api.request('DELETE', '/api/anything'), undefined)
})

test('network failures become ApiError(0, NETWORK_ERROR) without leaking the token', async () => {
  const fn = (async () => {
    throw new TypeError('fetch failed')
  }) as unknown as typeof fetch
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 'very-secret-token', fetch: fn })
  const error = await api.me.get().catch((e) => e)
  assert.ok(error instanceof ApiError)
  assert.equal(error.status, 0)
  assert.equal(error.code, 'NETWORK_ERROR')
  assert.ok(!JSON.stringify({ m: error.message, d: error.details }).includes('very-secret-token'))
})

test('times out slow requests', async () => {
  const fn = ((_url: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    })) as unknown as typeof fetch
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 't', fetch: fn, timeoutMs: 20 })
  const error = await api.me.get().catch((e) => e)
  assert.equal(error.code, 'TIMEOUT')
})

test('typed helpers hit the documented routes', async () => {
  const { fn, calls } = fakeFetch(() => json(200, {}))
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 't', fetch: fn })

  await api.bookings.cancel('b 1', 'sick')
  await api.schedule.deleteSpecialHours('2026-12-24')
  await api.barbers.availability('bar', { date: '2026-12-01', serviceId: 'svc' })
  await api.geocode.reverse(40.7, -74)
  await api.connect.onboarding()
  await api.uploads.create({ bucket: 'avatars', contentType: 'image/png', fileName: 'a.png' })

  assert.deepEqual(
    calls.map((c) => `${c.init.method} ${c.url}`),
    [
      'PATCH /api/bookings/b%201',
      'DELETE /api/me/special-hours?date=2026-12-24',
      'GET /api/barbers/bar/availability?date=2026-12-01&serviceId=svc',
      'GET /api/geocode?latlng=40.7%2C-74&type=reverse',
      'POST /api/stripe/connect/onboarding',
      'POST /api/uploads',
    ]
  )
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { action: 'cancel', reason: 'sick' })
  assert.equal(calls[4].init.body, undefined)
})

test('a 2xx body that is not JSON becomes ApiError INVALID_RESPONSE', async () => {
  const { fn } = fakeFetch(() => new Response('<html>proxy page</html>', { status: 200 }))
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 't', fetch: fn })
  const error = await api.me.get().catch((e) => e)
  assert.ok(error instanceof ApiError)
  assert.equal(error.status, 200)
  assert.equal(error.code, 'INVALID_RESPONSE')
})

test('an empty 2xx body still resolves to undefined', async () => {
  const { fn } = fakeFetch(() => new Response('', { status: 200 }))
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 't', fetch: fn })
  assert.equal(await api.request('GET', '/api/anything'), undefined)
})

test('the timeout also covers reading the body', async () => {
  const fn = ((_url: string, init: RequestInit) => {
    // Headers arrive at once; the body never finishes until the request is aborted.
    const body = new ReadableStream({
      start(controller) {
        init.signal?.addEventListener('abort', () => controller.error(new Error('aborted')))
      },
    })
    return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }) as unknown as typeof fetch
  const api = createApiClient({ baseUrl: '', getAccessToken: () => 't', fetch: fn, timeoutMs: 20 })
  const error = await api.me.get().catch((e) => e)
  assert.ok(error instanceof ApiError)
  assert.equal(error.code, 'TIMEOUT')
})
