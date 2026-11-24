/**
 * Stripe stand-in for unit tests: jest mocks for every API call the server
 * makes, and the real (offline) webhook signing helpers. Nothing here touches
 * the network. Not imported by production code.
 */
import Stripe from 'stripe'

export const TEST_WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests'

const offline = new Stripe('sk_test_offline_unit_tests', { apiVersion: '2025-08-27.basil' })

export function createFakeStripe() {
  return {
    paymentIntents: { create: jest.fn(), cancel: jest.fn(), retrieve: jest.fn() },
    refunds: { create: jest.fn(), list: jest.fn() },
    charges: { retrieve: jest.fn() },
    accounts: { create: jest.fn(), retrieve: jest.fn(), createLoginLink: jest.fn() },
    accountLinks: { create: jest.fn() },
    webhooks: offline.webhooks,
  }
}

export type FakeStripe = ReturnType<typeof createFakeStripe>

/** A webhook request signed like Stripe signs it. */
export function signedWebhookRequest(event: object, secret = TEST_WEBHOOK_SECRET): Request {
  const payload = JSON.stringify(event)
  const signature = offline.webhooks.generateTestHeaderString({ payload, secret })
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body: payload,
    headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
  })
}

export function invalidRequestError(code: string, message = 'error'): Error {
  return new Stripe.errors.StripeInvalidRequestError({ type: 'invalid_request_error', code, message })
}

export function permissionError(message: string): Error {
  return new Stripe.errors.StripePermissionError({ type: 'invalid_request_error', message })
}

export function apiError(message = 'Stripe is down'): Error {
  return new Stripe.errors.StripeAPIError({ type: 'api_error', message })
}

let eventCounter = 0
export function stripeEvent(type: string, object: object, extra: Record<string, unknown> = {}) {
  eventCounter += 1
  return {
    id: `evt_test_${eventCounter}`,
    object: 'event',
    api_version: '2025-08-27.basil',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object },
    ...extra,
  }
}
