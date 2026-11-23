/**
 * @jest-environment node
 */
import type { FakeDb } from '@/server/testing/fake-supabase'
import { TEST_ENV, TOKENS, request, seedMarketplace } from '@/server/testing/fixtures'
import { limiters } from '@/server/rate-limit'
import { GET as geocode } from '@/app/api/geocode/route'
import { POST as support } from '@/app/api/support/route'
import { GET as health } from '@/app/api/health/route'

let mockDb: FakeDb
let mockEnv: Record<string, string | undefined>
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => ({}) }))
jest.mock('@/server/env', () => ({ getServerEnv: () => mockEnv }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

const fetchMock = jest.fn()

beforeEach(() => {
  mockDb = seedMarketplace()
  mockEnv = { ...TEST_ENV, GOOGLE_MAPS_API_KEY: 'test-maps-key', SLACK_WEBHOOK_URL: 'https://hooks.slack.test/abc' }
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
  limiters.geocode.reset()
  limiters.support.reset()
})

function withIp(req: Request, ip: string): Request {
  const headers = new Headers(req.headers)
  headers.set('x-forwarded-for', `${ip}, 10.0.0.1`)
  return new Request(req, { headers })
}

async function json(res: Response) {
  return { status: res.status, body: await res.json() }
}

const google = (body: object) => ({ ok: true, json: async () => body })

describe('GET /api/geocode', () => {
  const result = (id: string) => ({
    place_id: id,
    formatted_address: `${id} Main St, Brooklyn, NY`,
    geometry: { location: { lat: 40.6, lng: -73.9 } },
    address_components: [
      { long_name: 'Brooklyn', short_name: 'Brooklyn', types: ['locality'] },
      { long_name: 'New York', short_name: 'NY', types: ['administrative_area_level_1'] },
    ],
  })

  it('geocodes an address into the Nominatim-compatible shape', async () => {
    fetchMock.mockResolvedValueOnce(google({ status: 'OK', results: [result('a'), result('b')] }))
    const res = await json(await geocode(request('/api/geocode?type=geocode&q=1%20Main%20St', { token: TOKENS.client })))
    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { place_id: 'a', display_name: 'a Main St, Brooklyn, NY', lat: '40.6', lon: '-73.9', address: { city: 'Brooklyn', state: 'NY' } },
      expect.objectContaining({ place_id: 'b' }),
    ])
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('address')).toBe('1 Main St')
    expect(url.searchParams.get('key')).toBe('test-maps-key')
  })

  it('caps autocomplete fan-out at 3 detail lookups', async () => {
    fetchMock.mockResolvedValueOnce(google({ status: 'OK', predictions: ['1', '2', '3', '4', '5'].map((id) => ({ place_id: id })) }))
    fetchMock.mockImplementation(async () => google({ status: 'OK', results: [result('x')] }))
    const res = await json(await geocode(request('/api/geocode?q=main', { token: TOKENS.client })))
    expect(res.body).toHaveLength(3)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('builds the query from city and state, and reverse-geocodes', async () => {
    fetchMock.mockResolvedValueOnce(google({ status: 'ZERO_RESULTS', results: [] }))
    expect((await json(await geocode(request('/api/geocode?type=geocode&city=Austin&state=TX', { token: TOKENS.client })))).body).toEqual([])
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('address')).toBe('Austin, TX')

    fetchMock.mockResolvedValueOnce(google({ status: 'OK', results: [result('r')] }))
    const rev = await json(await geocode(request('/api/geocode?type=reverse&latlng=40.6,-73.9', { token: TOKENS.client })))
    expect(rev.body).toEqual({ name: 'r Main St, Brooklyn, NY', city: 'Brooklyn', state: 'NY' })

    fetchMock.mockResolvedValueOnce(google({ status: 'ZERO_RESULTS', results: [] }))
    expect((await json(await geocode(request('/api/geocode?type=reverse&latlng=0,0', { token: TOKENS.client })))).body).toBeNull()
  })

  it('validates input', async () => {
    expect((await geocode(request('/api/geocode', { token: TOKENS.client }))).status).toBe(400)
    expect((await geocode(request('/api/geocode?type=reverse', { token: TOKENS.client }))).status).toBe(400)
    expect((await geocode(request('/api/geocode?type=reverse&latlng=abc', { token: TOKENS.client }))).status).toBe(400)
    expect((await geocode(request('/api/geocode?type=reverse&latlng=95,0', { token: TOKENS.client }))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps Google failures and a missing key without leaking the key', async () => {
    fetchMock.mockResolvedValueOnce(google({ status: 'REQUEST_DENIED', error_message: 'bad key test-maps-key' }))
    const failed = await json(await geocode(request('/api/geocode?type=geocode&q=x', { token: TOKENS.client })))
    expect(failed.status).toBe(502)
    expect(JSON.stringify(failed.body)).not.toContain('test-maps-key')

    mockEnv.GOOGLE_MAPS_API_KEY = undefined
    const missing = await json(await geocode(request('/api/geocode?type=geocode&q=x', { token: TOKENS.client })))
    expect(missing.status).toBe(503)
    expect(missing.body.error.code).toBe('GEOCODING_UNAVAILABLE')
  })

  it('needs a signed-in user for every lookup type', async () => {
    for (const url of ['/api/geocode?q=main', '/api/geocode?type=geocode&city=Austin&state=TX', '/api/geocode?type=reverse&latlng=1,1']) {
      const res = await json(await geocode(request(url)))
      expect(res.status).toBe(401)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('limits each user to 30 requests a minute', async () => {
    fetchMock.mockImplementation(async () => google({ status: 'ZERO_RESULTS', results: [] }))
    for (let i = 0; i < 30; i++) {
      expect((await geocode(withIp(request('/api/geocode?type=geocode&q=x', { token: TOKENS.client }), `1.1.1.${i}`))).status).toBe(200)
    }
    const limited = await json(await geocode(request('/api/geocode?type=geocode&q=x', { token: TOKENS.client })))
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
    expect((await geocode(request('/api/geocode?type=geocode&q=x', { token: TOKENS.stranger }))).status).toBe(200)
  })
})

describe('POST /api/support', () => {
  const body = { name: 'Pat <@here>', email: 'pat@example.com', category: 'booking', subject: 'Help', message: 'My <https://evil|link> booking' }

  it('posts an escaped message to Slack', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    const res = await json(await support(request('/api/support', { method: 'POST', body })))
    expect(res).toEqual({ status: 200, body: { sent: true } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://hooks.slack.test/abc')
    const sent = String(init.body)
    expect(sent).toContain('Pat &lt;@here&gt;')
    expect(sent).toContain('&lt;https://evil|link&gt;')
    expect(sent).not.toContain('<@here>')
  })

  it('validates input and caps length', async () => {
    for (const bad of [
      { ...body, email: 'nope' },
      { ...body, category: 'other' },
      { ...body, message: 'x'.repeat(2001) },
      { ...body, name: '' },
      { ...body, extra: 1 },
    ]) {
      expect((await support(request('/api/support', { method: 'POST', body: bad }))).status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports Slack failures and missing configuration', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    expect((await json(await support(request('/api/support', { method: 'POST', body })))).body.error.code).toBe('SUPPORT_SEND_FAILED')
    mockEnv.SLACK_WEBHOOK_URL = undefined
    expect((await support(request('/api/support', { method: 'POST', body }))).status).toBe(503)
  })

  it('rate-limits per IP', async () => {
    fetchMock.mockResolvedValue({ ok: true })
    for (let i = 0; i < 5; i++) await support(withIp(request('/api/support', { method: 'POST', body }), '3.3.3.3'))
    expect((await support(withIp(request('/api/support', { method: 'POST', body }), '3.3.3.3'))).status).toBe(429)
  })
})

describe('GET /api/health', () => {
  it('answers healthy', async () => {
    const res = await json(await health(request('/api/health')))
    expect(res).toEqual({ status: 200, body: { status: 'healthy', timestamp: expect.any(String) } })
  })
})
