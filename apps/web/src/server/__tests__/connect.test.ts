/**
 * @jest-environment node
 */
import type { FakeDb } from '@/server/testing/fake-supabase'
import {
  apiError,
  createFakeStripe,
  invalidRequestError,
  permissionError,
  type FakeStripe,
} from '@/server/testing/fake-stripe'
import { IDS, TEST_ENV, TOKENS, request, seedMarketplace } from '@/server/testing/fixtures'
import { POST as onboarding } from '@/app/api/stripe/connect/onboarding/route'
import { POST as dashboard } from '@/app/api/stripe/connect/dashboard/route'
import { GET as status } from '@/app/api/stripe/connect/status/route'

let mockDb: FakeDb
let mockStripe: FakeStripe
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => mockStripe }))
jest.mock('@/server/env', () => ({ getServerEnv: () => TEST_ENV }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

const ownAccount = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.stripeAccount,
  object: 'account',
  charges_enabled: true,
  payouts_enabled: false,
  details_submitted: true,
  metadata: { barber_id: IDS.barber, user_id: IDS.barberUser },
  ...overrides,
})

function billing() {
  return mockDb.one('barber_billing', { barber_id: IDS.barber })!
}

async function call(route: (req: Request) => Promise<Response>, method = 'POST', token: string = TOKENS.barber) {
  const res = await route(request('/api/stripe/connect/x', { method, token }))
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  mockDb = seedMarketplace()
  mockStripe = createFakeStripe()
  Object.assign(billing(), { charges_enabled: false, payouts_enabled: false, details_submitted: false })
  mockStripe.accountLinks.create.mockImplementation(async ({ account }: { account: string }) => ({
    url: `https://connect.stripe.test/setup/${account}`,
  }))
  mockStripe.accounts.createLoginLink.mockResolvedValue({ url: 'https://connect.stripe.test/express/login' })
})

describe('POST /api/stripe/connect/onboarding', () => {
  it('creates an Express account when the barber has none', async () => {
    billing().stripe_account_id = null
    mockStripe.accounts.create.mockResolvedValue({ ...ownAccount({ id: 'acct_new', details_submitted: false, charges_enabled: false }) })

    const res = await call(onboarding)

    expect(res).toEqual({
      status: 200,
      body: { url: 'https://connect.stripe.test/setup/acct_new', type: 'onboarding' },
    })
    expect(mockStripe.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'express',
        metadata: { barber_id: IDS.barber, user_id: IDS.barberUser },
      }),
      { idempotencyKey: `connect-account-${IDS.barber}` }
    )
    expect(billing().stripe_account_id).toBe('acct_new')
    expect(mockStripe.accountLinks.create).toHaveBeenCalledWith({
      account: 'acct_new',
      refresh_url: 'https://app.example.test/barber/connect/refresh?account_id=acct_new',
      return_url: 'https://app.example.test/barber/connect/return?account_id=acct_new',
      type: 'account_onboarding',
    })
  })

  it('reuses an existing account that belongs to the caller', async () => {
    mockStripe.accounts.retrieve.mockResolvedValue(ownAccount())
    const res = await call(onboarding)
    expect(res.status).toBe(200)
    expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith(IDS.stripeAccount)
    expect(mockStripe.accounts.create).not.toHaveBeenCalled()
    expect(billing()).toMatchObject({ charges_enabled: true, details_submitted: true })
  })

  it('refuses a link for an account whose metadata names another barber', async () => {
    mockStripe.accounts.retrieve.mockResolvedValue(ownAccount({ metadata: { barber_id: 'someone-else' } }))
    const res = await call(onboarding)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_MISMATCH')
    expect(mockStripe.accountLinks.create).not.toHaveBeenCalled()
    expect(mockStripe.accounts.create).not.toHaveBeenCalled()
    expect(billing().stripe_account_id).toBe(IDS.stripeAccount)
  })

  it('refuses an account with no metadata at all', async () => {
    mockStripe.accounts.retrieve.mockResolvedValue(ownAccount({ metadata: {} }))
    expect((await call(onboarding)).status).toBe(403)
  })

  it('replaces the account only when Stripe says it is missing', async () => {
    mockStripe.accounts.retrieve.mockRejectedValue(invalidRequestError('resource_missing', 'No such account'))
    mockStripe.accounts.create.mockResolvedValue(ownAccount({ id: 'acct_replacement' }))

    const res = await call(onboarding)
    expect(res.status).toBe(200)
    expect(mockStripe.accounts.create).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: `connect-account-${IDS.barber}-replaces-${IDS.stripeAccount}`,
    })
    expect(billing().stripe_account_id).toBe('acct_replacement')
  })

  it('replaces the account when the platform lost access to it', async () => {
    mockStripe.accounts.retrieve.mockRejectedValue(
      permissionError("The provided key does not have access to account 'acct_test_barber' (or that account does not exist).")
    )
    mockStripe.accounts.create.mockResolvedValue(ownAccount({ id: 'acct_replacement' }))
    expect((await call(onboarding)).status).toBe(200)
    expect(billing().stripe_account_id).toBe('acct_replacement')
  })

  it('changes nothing and returns 502 on any other Stripe error', async () => {
    mockStripe.accounts.retrieve.mockRejectedValue(apiError())
    const res = await call(onboarding)
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('STRIPE_ERROR')
    expect(mockStripe.accounts.create).not.toHaveBeenCalled()
    expect(mockStripe.accountLinks.create).not.toHaveBeenCalled()
    expect(billing().stripe_account_id).toBe(IDS.stripeAccount)
  })

  it('is for barbers only', async () => {
    expect((await call(onboarding, 'POST', TOKENS.client)).status).toBe(403)
  })
})

describe('POST /api/stripe/connect/dashboard', () => {
  it('returns a login link once details are submitted', async () => {
    mockStripe.accounts.retrieve.mockResolvedValue(ownAccount())
    const res = await call(dashboard)
    expect(res.body).toEqual({ url: 'https://connect.stripe.test/express/login', type: 'dashboard' })
    expect(mockStripe.accounts.createLoginLink).toHaveBeenCalledWith(IDS.stripeAccount)
  })

  it('returns an onboarding link until details are submitted', async () => {
    mockStripe.accounts.retrieve.mockResolvedValue(ownAccount({ details_submitted: false }))
    const res = await call(dashboard)
    expect(res.body.type).toBe('onboarding')
    expect(mockStripe.accounts.createLoginLink).not.toHaveBeenCalled()
  })

  it('applies the same metadata check', async () => {
    mockStripe.accounts.retrieve.mockResolvedValue(ownAccount({ metadata: { barber_id: 'someone-else' } }))
    const res = await call(dashboard)
    expect(res.status).toBe(403)
    expect(mockStripe.accounts.createLoginLink).not.toHaveBeenCalled()
  })
})

describe('GET /api/stripe/connect/status', () => {
  it('reads Stripe and stores the flags', async () => {
    mockStripe.accounts.retrieve.mockResolvedValue(ownAccount({ payouts_enabled: true }))
    const res = await call(status, 'GET')
    expect(res.body).toEqual({
      hasAccount: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      feeExempt: false,
    })
    expect(billing()).toMatchObject({ charges_enabled: true, payouts_enabled: true, details_submitted: true })
  })

  it('reports no account without calling Stripe', async () => {
    billing().stripe_account_id = null
    const res = await call(status, 'GET')
    expect(res.body.hasAccount).toBe(false)
    expect(mockStripe.accounts.retrieve).not.toHaveBeenCalled()
  })

  it('applies the same metadata check', async () => {
    mockStripe.accounts.retrieve.mockResolvedValue(ownAccount({ metadata: { barber_id: 'someone-else' } }))
    expect((await call(status, 'GET')).status).toBe(403)
    expect(billing().charges_enabled).toBe(false)
  })
})
