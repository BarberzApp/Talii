process.env.STRIPE_SECRET_KEY = 'sk_test_mock'

const mockStripeCreate = jest.fn()
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockStripeCreate,
    },
  }))
})

const mockSupabaseFrom = jest.fn()
const supabaseAdmin = { from: mockSupabaseFrom }
jest.mock('@/shared/lib/supabase', () => ({
  supabaseAdmin,
}))

const mockValidateBearerToken = jest.fn()
class ApiAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.name = 'ApiAuthError'
    this.status = status
  }
}
jest.mock('@/shared/lib/api-auth', () => ({
  ApiAuthError,
  validateBearerToken: mockValidateBearerToken,
}))

jest.mock('@/shared/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

import { POST } from '../route'
import { calculateFeeBreakdown } from '../../../../../shared/lib/fee-calculator'

type SupabaseHandlerMap = Record<string, any>

const setSupabaseHandlers = (handlers: SupabaseHandlerMap) => {
  mockSupabaseFrom.mockImplementation((table: string) => {
    const handler = handlers[table]
    if (!handler) {
      throw new Error(`No mock handler registered for table: ${table}`)
    }
    return handler
  })
}

describe('Mobile bookings API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockValidateBearerToken.mockResolvedValue({ id: 'user-123' })
    mockStripeCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'secret_123',
      amount: 340,
    })
  })

  it('returns 400 when required fields are missing', async () => {
    const request = new Request('http://localhost/api/mobile/bookings', {
      method: 'POST',
      body: JSON.stringify({ barberId: 'barber-1' }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('barberId, serviceId, and date are required')
  })

  it('creates a developer booking without calling Stripe', async () => {
    const barber = {
      id: 'barber-1',
      stripe_account_id: 'acct_dev',
      stripe_account_status: 'active',
      is_developer: true,
    }
    const service = {
      id: 'service-1',
      name: 'Test Service',
      price: 25,
      duration: 30,
    }
    const booking = { id: 'booking-1' }
    const addons = [{ id: 'addon-1', price: 5 }]

    setSupabaseHandlers({
      barbers: {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: barber, error: null }),
          })),
        })),
      },
      services: {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: service, error: null }),
          })),
        })),
      },
      service_addons: {
        select: jest.fn(() => ({
          in: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ data: addons, error: null }),
          })),
        })),
      },
      bookings: {
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: booking, error: null }),
          })),
        })),
      },
      booking_addons: {
        insert: jest.fn().mockResolvedValue({ error: null }),
      },
    })

    const request = new Request('http://localhost/api/mobile/bookings', {
      method: 'POST',
      body: JSON.stringify({
        barberId: 'barber-1',
        serviceId: 'service-1',
        date: new Date().toISOString(),
        addonIds: ['addon-1'],
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.booking.id).toBe('booking-1')
    expect(mockStripeCreate).not.toHaveBeenCalled()
  })

  it('returns 400 when barber Stripe account is not active', async () => {
    const barber = {
      id: 'barber-1',
      stripe_account_id: 'acct_123',
      stripe_account_status: 'pending',
      is_developer: false,
    }
    const service = {
      id: 'service-1',
      name: 'Test Service',
      price: 25,
      duration: 30,
    }

    setSupabaseHandlers({
      barbers: {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: barber, error: null }),
          })),
        })),
      },
      services: {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: service, error: null }),
          })),
        })),
      },
    })

    const request = new Request('http://localhost/api/mobile/bookings', {
      method: 'POST',
      body: JSON.stringify({
        barberId: 'barber-1',
        serviceId: 'service-1',
        date: new Date().toISOString(),
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('Barber account is not ready to accept payments')
    expect(mockStripeCreate).not.toHaveBeenCalled()
  })

  it('creates a payment intent for regular barbers', async () => {
    const barber = {
      id: 'barber-1',
      stripe_account_id: 'acct_123',
      stripe_account_status: 'active',
      is_developer: false,
    }
    const service = {
      id: 'service-1',
      name: 'Test Service',
      price: 25,
      duration: 30,
    }

    setSupabaseHandlers({
      barbers: {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: barber, error: null }),
          })),
        })),
      },
      services: {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: service, error: null }),
          })),
        })),
      },
    })

    const request = new Request('http://localhost/api/mobile/bookings', {
      method: 'POST',
      body: JSON.stringify({
        barberId: 'barber-1',
        serviceId: 'service-1',
        date: new Date().toISOString(),
      }),
    })

    const response = await POST(request)
    const json = await response.json()

    const fee = calculateFeeBreakdown()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: fee.platformFee,
        application_fee_amount: fee.bocmGrossShare,
      })
    )
  })
})
