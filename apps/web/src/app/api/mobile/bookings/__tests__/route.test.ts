/** @jest-environment node */
// @ts-nocheck

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

// Define mock functions at the top scope
const mockStripeCreate = jest.fn();
const mockSupabaseFrom = jest.fn();
const mockValidateBearerToken = jest.fn();

// Share them via global to bypass hoisting issues in factory functions
(global as any)._mockStripeCreate = mockStripeCreate;
(global as any)._mockSupabaseFrom = mockSupabaseFrom;
(global as any)._mockValidateBearerToken = mockValidateBearerToken;

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: (args: any) => (global as any)._mockStripeCreate(args),
    },
    checkout: {
      sessions: {
        create: (args: any) => (global as any)._mockStripeCreate(args),
      }
    }
  }))
})

jest.mock('@/shared/lib/supabase', () => {
  return {
    supabaseAdmin: { from: (table: string) => (global as any)._mockSupabaseFrom(table) },
    supabase: { from: (table: string) => (global as any)._mockSupabaseFrom(table) }
  }
})

jest.mock('@/shared/lib/api-auth', () => {
  class ApiAuthError extends Error {
    status: number
    constructor(message: string, status = 401) {
      super(message)
      this.name = 'ApiAuthError'
      this.status = status
    }
  }
  return {
    ApiAuthError,
    validateBearerToken: (req: any) => (global as any)._mockValidateBearerToken(req),
  }
})

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
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: barber, error: null }),
          }),
        }),
      },
      services: {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: service, error: null }),
          }),
        }),
      },
      service_addons: {
        select: () => ({
          in: () => ({
            eq: () => Promise.resolve({ data: addons, error: null }),
          }),
        }),
      },
      bookings: {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: booking, error: null }),
          }),
        }),
      },
      booking_addons: {
        insert: () => Promise.resolve({ error: null }),
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
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: barber, error: null }),
          }),
        }),
      },
      services: {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: service, error: null }),
          }),
        }),
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
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: barber, error: null }),
          }),
        }),
      },
      services: {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: service, error: null }),
          }),
        }),
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
        application_fee_amount: fee.applicationFeeAmount,
      })
    )
  })
})
