/** @jest-environment node */
// @ts-nocheck
import { POST } from '../route'
import Stripe from 'stripe'

jest.mock('@/shared/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'existing-booking-123', price: 40 }, error: null }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: 'test-booking', status: 'confirmed' }, error: null })
      })
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: null, error: null })
    }),
  }
}))

jest.mock('@/shared/utils/sendSMS', () => ({
  sendBookingConfirmationSMS: jest.fn().mockResolvedValue(true)
}))

// Polyfill Response.json for Jest environment
if (!global.Response.json) {
  global.Response.json = (data: any, init?: any) => {
    return new global.Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    })
  }
}

// Ensure crypto provider is set for Node.js
const stripe = new Stripe('sk_test_123', { 
  apiVersion: '2024-06-20',
})
const cryptoProvider = Stripe.createNodeCryptoProvider()

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'

describe('Webhook Payment System Checks', () => {
  const createWebhookRequest = async (payload: any) => {
    const payloadString = JSON.stringify(payload)
    const signature = await stripe.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    })

    return new Request('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': signature,
        'content-type': 'application/json',
      },
      body: payloadString,
    })
  }

  // 1. Checks the status of it
  it('1. returns 400 when missing signature (status check)', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      body: 'invalid'
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('No signature found')
  })

  // 2. Checks if a payment can be received back to the system
  it('2. successfully receives and acknowledges a generic payment event', async () => {
    const req = await createWebhookRequest({
      id: 'evt_test',
      type: 'payment_intent.created',
      data: { object: { id: 'pi_test' } }
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })

  // 3. Checks if a payment can be received with any and all information needed to complete the booking
  it('3. processes full payment info and completes the booking', async () => {
    const req = await createWebhookRequest({
      id: 'evt_test3',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_mock_123',
          amount: 340,
          currency: 'usd',
          status: 'succeeded',
          application_fee_amount: 220,
          transfer_data: {
            destination: 'acct_mock'
          },
          metadata: {
            barberId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            serviceId: 'ssssssss-ssss-ssss-ssss-ssssssssssss',
            date: new Date(Date.now() + 86400000).toISOString(),
            clientId: 'guest',
            guestName: 'Test Guest',
            guestEmail: 'test@example.com',
            guestPhone: '555-555-5555',
            platformFeeCents: '340',
            bocmShareCents: '180',
            barberShareCents: '120',
            addonsPaidSeparately: 'false',
            isDeveloper: 'false',
            addonIdsCsv: ''
          }
        }
      }
    })
    
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })
})
