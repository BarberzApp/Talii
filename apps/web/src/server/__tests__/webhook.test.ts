/**
 * @jest-environment node
 */
import * as Sentry from '@sentry/nextjs'
import type { FakeDb } from '@/server/testing/fake-supabase'
import {
  apiError,
  createFakeStripe,
  signedWebhookRequest,
  stripeEvent,
  type FakeStripe,
} from '@/server/testing/fake-stripe'
import { IDS, TEST_ENV, bookingRow, seedMarketplace } from '@/server/testing/fixtures'
import { POST } from '@/app/api/webhooks/stripe/route'

let mockDb: FakeDb
let mockStripe: FakeStripe
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => mockStripe }))
jest.mock('@/server/env', () => ({ getServerEnv: () => TEST_ENV }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

const BOOKING_ID = '60000000-0000-4000-8000-000000000001'
// Sunday 07:00 in New York; bookingRow() starts Monday 10:00 EST (2026-03-02T15:00Z).
const NOW = new Date('2026-03-01T12:00:00Z')

function paymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi_test_1',
    object: 'payment_intent',
    amount: 340,
    amount_received: 340,
    application_fee_amount: 220,
    currency: 'usd',
    status: 'succeeded',
    metadata: { bookingId: BOOKING_ID },
    ...overrides,
  }
}

function pendingBooking(overrides: Record<string, unknown> = {}) {
  return bookingRow({
    status: 'pending',
    payment_status: 'pending',
    hold_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    ...overrides,
  })
}

async function deliver(event: object) {
  const res = await POST(signedWebhookRequest(event))
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
  mockDb = seedMarketplace()
  mockStripe = createFakeStripe()
  jest.clearAllMocks()
  mockStripe.accounts.retrieve.mockImplementation(async (id: string) => ({
    id,
    object: 'account',
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    metadata: { barber_id: IDS.barber },
  }))
})

afterEach(() => {
  jest.useRealTimers()
})

describe('signature and de-duplication', () => {
  it('rejects a bad signature without recording anything', async () => {
    const event = stripeEvent('payment_intent.succeeded', paymentIntent())
    const res = await POST(signedWebhookRequest(event, 'whsec_someone_else'))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_SIGNATURE')
    expect(mockDb.rows('stripe_events')).toHaveLength(0)
  })

  it('rejects a missing signature', async () => {
    const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('skips an event that was already processed', async () => {
    mockDb.table('bookings').push(pendingBooking())
    const event = stripeEvent('payment_intent.succeeded', paymentIntent())
    mockDb.table('stripe_events').push({ id: event.id, type: event.type, processed_at: '2026-03-01T00:00:00Z' })

    const res = await deliver(event)
    expect(res).toEqual({ status: 200, body: { received: true, duplicate: true } })
    expect(mockDb.one('bookings', { id: BOOKING_ID })!.status).toBe('pending')
    expect(mockDb.rows('payments')).toHaveLength(0)
  })

  it('retries an event whose earlier attempt did not finish', async () => {
    mockDb.table('bookings').push(pendingBooking())
    const event = stripeEvent('payment_intent.succeeded', paymentIntent())
    mockDb.table('stripe_events').push({ id: event.id, type: event.type, processed_at: null })

    expect((await deliver(event)).status).toBe(200)
    expect(mockDb.one('bookings', { id: BOOKING_ID })!.status).toBe('confirmed')
  })

  it('acknowledges event types it does not use', async () => {
    const event = stripeEvent('customer.created', { id: 'cus_1', object: 'customer' })
    const res = await deliver(event)
    expect(res).toEqual({ status: 200, body: { received: true, ignored: true } })
    expect(mockDb.one('stripe_events', { id: event.id })!.processed_at).toEqual(expect.any(String))
  })
})

describe('payment_intent.succeeded', () => {
  it('confirms a pending booking and records one charge', async () => {
    mockDb.table('bookings').push(pendingBooking())
    const event = stripeEvent('payment_intent.succeeded', paymentIntent())

    expect((await deliver(event)).status).toBe(200)
    expect(mockDb.one('bookings', { id: BOOKING_ID })).toMatchObject({
      status: 'confirmed',
      payment_status: 'succeeded',
      hold_expires_at: null,
    })
    expect(mockDb.rows('payments')).toEqual([
      expect.objectContaining({
        booking_id: BOOKING_ID,
        type: 'charge',
        stripe_object_id: 'pi_test_1',
        amount_cents: 340,
        application_fee_cents: 220,
        status: 'succeeded',
      }),
    ])
    expect(mockDb.one('stripe_events', { id: event.id })).toMatchObject({ error: null, processed_at: expect.any(String) })
    expect(mockStripe.refunds.create).not.toHaveBeenCalled()

    // The same payment delivered again under a new event id changes nothing.
    expect((await deliver(stripeEvent('payment_intent.succeeded', paymentIntent()))).status).toBe(200)
    expect(mockDb.rows('payments')).toHaveLength(1)
  })

  it('refunds automatically when the hold was released before payment', async () => {
    mockDb.table('bookings').push(
      bookingRow({
        status: 'cancelled',
        payment_status: 'pending',
        cancellation_reason: 'hold_expired',
        cancelled_at: '2026-03-01T12:20:00Z',
      })
    )
    mockStripe.refunds.create.mockResolvedValue({
      id: 're_auto',
      object: 'refund',
      amount: 340,
      currency: 'usd',
      status: 'succeeded',
      payment_intent: 'pi_test_1',
      charge: 'ch_1',
    })
    const event = stripeEvent('payment_intent.succeeded', paymentIntent())

    expect((await deliver(event)).status).toBe(200)
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_test_1', reverse_transfer: true, refund_application_fee: true }),
      { idempotencyKey: 'pi-pi_test_1-unapplied-refund' }
    )
    expect(mockDb.one('bookings', { id: BOOKING_ID })).toMatchObject({ status: 'cancelled', payment_status: 'refunded' })
    expect(mockDb.rows('payments').map((p) => [p.type, p.stripe_object_id, p.amount_cents])).toEqual([
      ['charge', 'pi_test_1', 340],
      ['refund', 're_auto', 340],
    ])
    const recorded = mockDb.one('stripe_events', { id: event.id })!
    expect(recorded.processed_at).toEqual(expect.any(String))
    expect(String(recorded.error)).toMatch(/hold_expired.*refunded re_auto/)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('records and alerts, without refunding, when the booking does not exist', async () => {
    const event = stripeEvent('payment_intent.succeeded', paymentIntent())
    expect((await deliver(event)).status).toBe(200)
    expect(mockStripe.refunds.create).not.toHaveBeenCalled()
    expect(String(mockDb.one('stripe_events', { id: event.id })!.error)).toContain('does not exist')
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('ignores payments that are not bookings', async () => {
    const event = stripeEvent('payment_intent.succeeded', paymentIntent({ id: 'pi_other', metadata: {} }))
    const res = await deliver(event)
    expect(res.body).toEqual({ received: true, ignored: true })
  })

  it('confirms a payment that arrives within the grace period after the hold expired', async () => {
    mockDb.table('bookings').push(pendingBooking({ hold_expires_at: new Date(NOW.getTime() - 60_000).toISOString() }))
    await deliver(stripeEvent('payment_intent.succeeded', paymentIntent()))
    expect(mockDb.one('bookings', { id: BOOKING_ID })!.status).toBe('confirmed')
  })

  it('re-validates a late payment and confirms it when the slot is still free', async () => {
    mockDb.table('bookings').push(pendingBooking({ hold_expires_at: new Date(NOW.getTime() - 30 * 60_000).toISOString() }))
    await deliver(stripeEvent('payment_intent.succeeded', paymentIntent()))
    expect(mockDb.one('bookings', { id: BOOKING_ID })!.status).toBe('confirmed')
    expect(mockStripe.refunds.create).not.toHaveBeenCalled()
  })

  it('refunds a late payment when the slot is no longer bookable', async () => {
    mockDb.table('bookings').push(pendingBooking({ hold_expires_at: new Date(NOW.getTime() - 30 * 60_000).toISOString() }))
    // The barber closed that day after the hold was placed.
    mockDb.table('special_hours').push({ barber_id: IDS.barber, date: '2026-03-02', is_closed: true, start_time: null, end_time: null })
    mockStripe.refunds.create.mockResolvedValue({
      id: 're_late', object: 'refund', amount: 340, currency: 'usd', status: 'succeeded', payment_intent: 'pi_test_1', charge: 'ch_1',
    })
    const event = stripeEvent('payment_intent.succeeded', paymentIntent())

    expect((await deliver(event)).status).toBe(200)
    expect(mockDb.one('bookings', { id: BOOKING_ID })).toMatchObject({
      status: 'cancelled',
      cancellation_reason: 'late_payment',
      payment_status: 'refunded',
    })
    expect(mockStripe.refunds.create).toHaveBeenCalledTimes(1)
    expect(String(mockDb.one('stripe_events', { id: event.id })!.error)).toContain('no longer available')
  })

  it('never confirms a booking whose start time has passed', async () => {
    mockDb.table('bookings').push(
      pendingBooking({ hold_expires_at: new Date(NOW.getTime() + 60_000).toISOString(), starts_at: '2026-03-01T11:45:00.000Z', ends_at: '2026-03-01T12:15:00.000Z' })
    )
    mockStripe.refunds.create.mockResolvedValue({
      id: 're_past', object: 'refund', amount: 340, currency: 'usd', status: 'succeeded', payment_intent: 'pi_test_1', charge: 'ch_1',
    })
    await deliver(stripeEvent('payment_intent.succeeded', paymentIntent()))
    expect(mockDb.one('bookings', { id: BOOKING_ID })).toMatchObject({ status: 'cancelled', payment_status: 'refunded' })
  })

  it('does not refund again when the payment is already fully refunded', async () => {
    mockDb.table('bookings').push(bookingRow({ status: 'cancelled', payment_status: 'pending', cancellation_reason: 'hold_expired' }))
    mockDb.table('payments').push({
      booking_id: BOOKING_ID, type: 'refund', stripe_object_id: 're_before', payment_intent_id: 'pi_test_1',
      amount_cents: 340, application_fee_cents: 0, status: 'succeeded',
    })
    const event = stripeEvent('payment_intent.succeeded', paymentIntent())
    expect((await deliver(event)).status).toBe(200)
    expect(mockStripe.refunds.create).not.toHaveBeenCalled()
    expect(String(mockDb.one('stripe_events', { id: event.id })!.error)).toContain('already refunded')
  })

  it('ignores payment events from connected accounts', async () => {
    mockDb.table('bookings').push(pendingBooking())
    const event = stripeEvent('payment_intent.succeeded', paymentIntent(), { account: 'acct_someone' })
    expect((await deliver(event)).body).toEqual({ received: true, ignored: true })
    expect(mockDb.one('bookings', { id: BOOKING_ID })!.status).toBe('pending')
  })

  it('returns 500 on a transient failure so Stripe retries', async () => {
    mockDb.table('bookings').push(pendingBooking())
    mockDb.failNext('bookings', 'select', { code: '08006', message: 'connection failure' })
    const event = stripeEvent('payment_intent.succeeded', paymentIntent())

    const res = await deliver(event)
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('connection failure')
    expect(mockDb.one('stripe_events', { id: event.id })!.processed_at).toBeUndefined()
    expect(Sentry.captureException).toHaveBeenCalled()

    // Stripe's retry succeeds.
    expect((await deliver(event)).status).toBe(200)
    expect(mockDb.one('bookings', { id: BOOKING_ID })!.status).toBe('confirmed')
  })
})

describe('payment failures', () => {
  it('payment_failed changes nothing: the intent stays payable and the hold stays', async () => {
    mockDb.table('bookings').push(pendingBooking())
    const event = stripeEvent('payment_intent.payment_failed', paymentIntent({ status: 'requires_payment_method' }))
    expect((await deliver(event)).status).toBe(200)
    expect(mockDb.one('bookings', { id: BOOKING_ID })).toMatchObject({ status: 'pending', payment_status: 'pending' })
    expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled()
    expect(mockDb.one('stripe_events', { id: event.id })!.processed_at).toEqual(expect.any(String))
  })

  it('a decline followed by a successful retry on the same intent confirms the booking', async () => {
    mockDb.table('bookings').push(pendingBooking())
    await deliver(stripeEvent('payment_intent.payment_failed', paymentIntent({ status: 'requires_payment_method' })))
    await deliver(stripeEvent('payment_intent.succeeded', paymentIntent()))
    expect(mockDb.one('bookings', { id: BOOKING_ID })).toMatchObject({ status: 'confirmed', payment_status: 'succeeded' })
    expect(mockStripe.refunds.create).not.toHaveBeenCalled()
  })

  it('payment_intent.canceled releases the hold', async () => {
    mockDb.table('bookings').push(pendingBooking())
    await deliver(stripeEvent('payment_intent.canceled', paymentIntent({ status: 'canceled' })))
    expect(mockDb.one('bookings', { id: BOOKING_ID })).toMatchObject({
      status: 'cancelled',
      cancellation_reason: 'payment_canceled',
    })
  })

  it('never cancels a confirmed booking', async () => {
    mockDb.table('bookings').push(bookingRow())
    await deliver(stripeEvent('payment_intent.canceled', paymentIntent({ status: 'canceled' })))
    expect(mockDb.one('bookings', { id: BOOKING_ID })!.status).toBe('confirmed')
  })
})

describe('refunds', () => {
  const refund = (id: string, amount: number, status = 'succeeded') => ({
    id,
    object: 'refund',
    amount,
    currency: 'usd',
    status,
    payment_intent: 'pi_test_1',
    charge: 'ch_1',
  })
  const charge = (amountRefunded: number) => ({
    id: 'ch_1',
    object: 'charge',
    amount: 340,
    amount_refunded: amountRefunded,
    refunded: amountRefunded >= 340,
    payment_intent: 'pi_test_1',
  })

  beforeEach(() => {
    mockDb.table('bookings').push(bookingRow())
  })

  it('records one row per refund across a partial and then a full refund', async () => {
    mockStripe.refunds.list.mockResolvedValueOnce({ object: 'list', data: [refund('re_1', 100)], has_more: false })
    await deliver(stripeEvent('charge.refunded', charge(100)))

    expect(mockDb.one('bookings', { id: BOOKING_ID })!.payment_status).toBe('partially_refunded')
    expect(mockDb.rows('payments', { type: 'refund' }).map((p) => [p.stripe_object_id, p.amount_cents])).toEqual([
      ['re_1', 100],
    ])

    mockStripe.refunds.list.mockResolvedValueOnce({
      object: 'list',
      data: [refund('re_2', 240), refund('re_1', 100)],
      has_more: false,
    })
    await deliver(stripeEvent('charge.refunded', charge(340)))

    expect(mockDb.one('bookings', { id: BOOKING_ID })!.payment_status).toBe('refunded')
    const rows = mockDb.rows('payments', { type: 'refund' })
    expect(rows.map((p) => [p.stripe_object_id, p.amount_cents])).toEqual([
      ['re_1', 100],
      ['re_2', 240],
    ])
    // Never the running total (340) as a single refund.
    expect(rows.reduce((sum, p) => sum + Number(p.amount_cents), 0)).toBe(340)
    expect(mockStripe.refunds.list).toHaveBeenCalledWith({ charge: 'ch_1', limit: 100 })
  })

  it('follows refund list pages', async () => {
    mockStripe.refunds.list
      .mockResolvedValueOnce({ object: 'list', data: [refund('re_1', 100)], has_more: true })
      .mockResolvedValueOnce({ object: 'list', data: [refund('re_2', 100)], has_more: false })
    await deliver(stripeEvent('charge.refunded', charge(200)))
    expect(mockStripe.refunds.list).toHaveBeenLastCalledWith({ charge: 'ch_1', limit: 100, starting_after: 're_1' })
    expect(mockDb.rows('payments', { type: 'refund' })).toHaveLength(2)
  })

  it('refund.updated updates the refund row status and derives the booking status from the charge', async () => {
    mockDb.table('payments').push({
      id: 'p1',
      booking_id: BOOKING_ID,
      type: 'refund',
      stripe_object_id: 're_1',
      payment_intent_id: 'pi_test_1',
      amount_cents: 340,
      status: 'pending',
    })
    mockDb.one('bookings', { id: BOOKING_ID })!.payment_status = 'refunded'
    mockStripe.charges.retrieve.mockResolvedValue(charge(0))

    await deliver(stripeEvent('refund.updated', refund('re_1', 340, 'failed')))

    expect(mockDb.rows('payments', { type: 'refund' })).toEqual([
      expect.objectContaining({ stripe_object_id: 're_1', status: 'failed' }),
    ])
    // The refund failed, so the charge shows nothing refunded: back to succeeded, loudly.
    expect(mockStripe.charges.retrieve).toHaveBeenCalledWith('ch_1')
    expect(mockDb.one('bookings', { id: BOOKING_ID })!.payment_status).toBe('succeeded')
    expect(Sentry.captureMessage).toHaveBeenCalled()
    const recorded = mockDb.rows('stripe_events').at(-1)!
    expect(String(recorded.error)).toMatch(/re_1 .*ended failed.*no longer refunded/)
  })
})

describe('Connect account events', () => {
  beforeEach(() => {
    Object.assign(mockDb.one('barber_billing', { barber_id: IDS.barber })!, {
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    })
  })

  it('account.updated stores what Stripe returns now, not the (possibly stale) payload', async () => {
    const event = stripeEvent(
      'account.updated',
      // An older snapshot delivered late.
      { id: IDS.stripeAccount, object: 'account', charges_enabled: false, payouts_enabled: false, details_submitted: false, metadata: { barber_id: IDS.barber } },
      { account: IDS.stripeAccount }
    )
    expect((await deliver(event)).status).toBe(200)
    expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith(IDS.stripeAccount)
    expect(mockDb.one('barber_billing', { barber_id: IDS.barber })).toMatchObject({
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    })
  })

  it('account.updated retries (500) when Stripe cannot be reached', async () => {
    mockStripe.accounts.retrieve.mockRejectedValueOnce(apiError())
    const event = stripeEvent('account.updated', { id: IDS.stripeAccount, object: 'account' }, { account: IDS.stripeAccount })
    expect((await deliver(event)).status).toBe(500)
    expect(mockDb.one('barber_billing', { barber_id: IDS.barber })!.charges_enabled).toBe(false)
  })

  it('account.updated for an unknown account is ignored', async () => {
    const event = stripeEvent('account.updated', { id: 'acct_unknown', object: 'account', charges_enabled: true })
    expect((await deliver(event)).body).toEqual({ received: true, ignored: true })
  })

  it('account.application.deauthorized uses event.account and clears charges_enabled', async () => {
    mockDb.one('barber_billing', { barber_id: IDS.barber })!.charges_enabled = true
    const event = stripeEvent(
      'account.application.deauthorized',
      { id: 'ca_platform', object: 'application' },
      { account: IDS.stripeAccount }
    )
    expect((await deliver(event)).status).toBe(200)
    expect(mockDb.one('barber_billing', { barber_id: IDS.barber })!.charges_enabled).toBe(false)
  })
})
