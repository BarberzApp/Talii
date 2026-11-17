/**
 * @jest-environment node
 */
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import type { FakeDb } from '@/server/testing/fake-supabase'
import { IDS, TOKENS, request, routeParams, seedMarketplace } from '@/server/testing/fixtures'
import { defineRoute } from '@/server/route'
import { ApiError } from '@/server/errors'

let mockDb: FakeDb
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => ({}) }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

beforeEach(() => {
  mockDb = seedMarketplace()
  jest.clearAllMocks()
})

async function json(res: Response) {
  return { status: res.status, body: await res.json() }
}

describe('defineRoute auth', () => {
  const echo = (auth: 'public' | 'user' | 'barber' | 'admin') =>
    defineRoute({ auth }, async (ctx) => ({ userId: ctx.user?.id ?? null, barberId: ctx.barber?.id ?? null }))

  it('public routes ignore tokens', async () => {
    const res = await json(await echo('public')(request('/x', { token: 'garbage' })))
    expect(res).toEqual({ status: 200, body: { userId: null, barberId: null } })
  })

  it('user routes need a Bearer token', async () => {
    const res = await json(await echo('user')(request('/x')))
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: expect.any(String) } })
  })

  it('rejects an invalid token', async () => {
    const res = await json(await echo('user')(request('/x', { token: 'not-a-real-token' })))
    expect(res.status).toBe(401)
  })

  it('rejects a malformed Authorization header', async () => {
    const req = new Request('http://localhost/x', { headers: { authorization: `Token ${TOKENS.client}` } })
    expect((await echo('user')(req)).status).toBe(401)
  })

  it('accepts a valid token', async () => {
    const res = await json(await echo('user')(request('/x', { token: TOKENS.client })))
    expect(res).toEqual({ status: 200, body: { userId: IDS.clientUser, barberId: null } })
  })

  it('blocks disabled accounts', async () => {
    mockDb.one('profiles', { id: IDS.clientUser })!.is_disabled = true
    const res = await json(await echo('user')(request('/x', { token: TOKENS.client })))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED')
  })

  it('barber routes load the caller barber row', async () => {
    const res = await json(await echo('barber')(request('/x', { token: TOKENS.barber })))
    expect(res).toEqual({ status: 200, body: { userId: IDS.barberUser, barberId: IDS.barber } })
  })

  it('barber routes reject callers without a barber row', async () => {
    const res = await json(await echo('barber')(request('/x', { token: TOKENS.client })))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NOT_A_BARBER')
  })

  it('admin routes require app_metadata.role admin', async () => {
    expect((await echo('admin')(request('/x', { token: TOKENS.admin }))).status).toBe(200)
    expect((await echo('admin')(request('/x', { token: TOKENS.client }))).status).toBe(403)
  })

  it('admin ignores user_metadata and SUPER_ADMIN_EMAIL', async () => {
    process.env.SUPER_ADMIN_EMAIL = 'client_one@example.test'
    mockDb.users.set(TOKENS.client, {
      id: IDS.clientUser,
      email: 'client_one@example.test',
      user_metadata: { role: 'admin' },
    })
    expect((await echo('admin')(request('/x', { token: TOKENS.client }))).status).toBe(403)
    delete process.env.SUPER_ADMIN_EMAIL
  })
})

describe('defineRoute inputs', () => {
  const route = defineRoute(
    {
      auth: 'public',
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ page: z.coerce.number().int().default(1) }),
      body: z.object({ name: z.string().min(2) }),
    },
    async ({ params, query, body }) => Response.json({ params, query, body }, { status: 201 })
  )

  it('parses params, query and body', async () => {
    const res = await route(
      request('/x?page=3', { method: 'POST', body: { name: 'Al' } }),
      routeParams({ id: IDS.barber })
    )
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ params: { id: IDS.barber }, query: { page: 3 }, body: { name: 'Al' } })
  })

  it('returns 400 VALIDATION_ERROR naming the field', async () => {
    const res = await json(
      await route(request('/x', { method: 'POST', body: { name: 'A' } }), routeParams({ id: IDS.barber }))
    )
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.message).toContain('body.name')
  })

  it('validates params', async () => {
    const res = await json(
      await route(request('/x', { method: 'POST', body: { name: 'Al' } }), routeParams({ id: 'nope' }))
    )
    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('params.id')
  })

  it('returns 400 INVALID_JSON for a malformed body', async () => {
    const res = await json(
      await route(request('/x', { method: 'POST', rawBody: '{oops' }), routeParams({ id: IDS.barber }))
    )
    expect(res).toEqual({ status: 400, body: { error: { code: 'INVALID_JSON', message: expect.any(String) } } })
  })
})

describe('defineRoute errors', () => {
  it('maps ApiError to its status and code', async () => {
    const route = defineRoute({ auth: 'public' }, async () => {
      throw new ApiError(409, 'SLOT_TAKEN', 'Taken.')
    })
    const res = await json(await route(request('/x')))
    expect(res).toEqual({ status: 409, body: { error: { code: 'SLOT_TAKEN', message: 'Taken.' } } })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('hides unexpected errors and reports them to Sentry', async () => {
    const route = defineRoute({ auth: 'public' }, async () => {
      throw new Error('relation "secret_table" does not exist')
    })
    const res = await json(await route(request('/x')))
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL')
    expect(JSON.stringify(res.body)).not.toContain('secret_table')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('treats database errors during auth as 500', async () => {
    mockDb.failNext('profiles', 'select', { code: 'XX000', message: 'db down' })
    const route = defineRoute({ auth: 'user' }, async () => ({}))
    const res = await json(await route(request('/x', { token: TOKENS.client })))
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('db down')
  })
})
