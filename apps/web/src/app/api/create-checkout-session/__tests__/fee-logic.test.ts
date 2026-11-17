/**
 * @jest-environment node
 */
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'

const mockStripeCreate = jest.fn()
jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeCreate(...args),
      },
    },
  }))
)

const mockSupabaseFrom = jest.fn()
jest.mock('@/shared/lib/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}))

const mockValidateBearerToken = jest.fn()
jest.mock('@/shared/lib/api-auth', () => {
  class ApiAuthError extends Error {
    status: number
    constructor(message: string, status = 401) {
      super(message)
      this.status = status
    }
  }
  return {
    ApiAuthError,
    validateBearerToken: (...args: unknown[]) => mockValidateBearerToken(...args),
  }
})

jest.mock('@/shared/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}))

import { POST } from '../route'
import { calculateFeeBreakdown } from '@/shared/lib/fee-calculator'
import { ApiAuthError } from '@/shared/lib/api-auth'

// Chainable query mock: every filter returns itself, `.single()` resolves `result`,
// and awaiting the chain directly also resolves `result`.
function query(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function setTables(barber: unknown, service: unknown) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'barbers') return query({ data: barber, error: null })
    if (table === 'services') return query({ data: service, error: null })
    return query({ data: [], error: null })
  })
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/create-checkout-session', {
    method: 'POST',
    headers: { Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })
}

const service = { name: 'Test Service', price: 50, duration: 30 }

describe('Create Checkout Session - Fee Logic Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockValidateBearerToken.mockResolvedValue({ id: 'user-from-token' })
    mockStripeCreate.mockResolvedValue({ id: 'sess_123', url: 'https://stripe.com/pay' })
  })

  it('charges the $3.40 fee and withholds the platform application fee', async () => {
    const breakdown = calculateFeeBreakdown()
    setTables({ stripe_account_id: 'acct_123', stripe_account_status: 'active', is_developer: false }, service)

    const res = await POST(
      makeRequest({
        barberId: 'barber123',
        serviceId: 'service123',
        date: new Date().toISOString(),
      })
    )
    expect(res.status).toBe(200)

    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: breakdown.platformFee }),
          }),
        ]),
        payment_intent_data: expect.objectContaining({
          application_fee_amount: breakdown.applicationFeeAmount,
        }),
      })
    )

    expect(breakdown.platformFee).toBe(340)
    expect(breakdown.bocmGrossShare).toBe(180)
    expect(breakdown.barberShare).toBe(120)
  })

  it('uses the token user as the client and ignores clientId in the body', async () => {
    setTables({ stripe_account_id: 'acct_123', stripe_account_status: 'active', is_developer: false }, service)

    await POST(
      makeRequest({
        barberId: 'barber123',
        serviceId: 'service123',
        date: new Date().toISOString(),
        clientId: 'someone-else',
        guestEmail: 'guest@example.com',
      })
    )

    const params = mockStripeCreate.mock.calls[0][0]
    expect(params.metadata.clientId).toBe('user-from-token')
    expect(params.payment_intent_data.metadata.clientId).toBe('user-from-token')
  })

  it('bypasses fees for developer barbers', async () => {
    setTables({ stripe_account_id: 'acct_dev', stripe_account_status: 'active', is_developer: true }, service)

    await POST(
      makeRequest({
        barberId: 'dev123',
        serviceId: 'service123',
        date: new Date().toISOString(),
      })
    )

    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent_data: expect.objectContaining({ application_fee_amount: 0 }),
      })
    )
  })

  it('rejects unauthenticated callers (guest checkout is cut)', async () => {
    mockValidateBearerToken.mockRejectedValue(new ApiAuthError('Unauthorized', 401))

    const res = await POST(
      makeRequest({ barberId: 'barber123', serviceId: 'service123', date: new Date().toISOString() })
    )

    expect(res.status).toBe(401)
    expect(mockStripeCreate).not.toHaveBeenCalled()
  })
})
