/**
 * @jest-environment node
 */
import type { FakeDb } from '@/server/testing/fake-supabase'
import { apiError, createFakeStripe, invalidRequestError, type FakeStripe } from '@/server/testing/fake-stripe'
import { IDS, TOKENS, bookingRow, request, routeParams, seedMarketplace } from '@/server/testing/fixtures'
import { GET as listBookings, POST as createBooking } from '@/app/api/bookings/route'
import { PATCH as updateBooking } from '@/app/api/bookings/[id]/route'
import { POST as createManual } from '@/app/api/bookings/manual/route'
import { GET as getAvailability } from '@/app/api/barbers/[id]/availability/route'

let mockDb: FakeDb
let mockStripe: FakeStripe
jest.mock('@/server/clients', () => ({ getSupabaseAdmin: () => mockDb, getStripe: () => mockStripe }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

// Sunday 2026-03-01 07:00 in New York. The barber works Mon-Fri 09:00-17:00 New York time.
const NOW = new Date('2026-03-01T12:00:00Z')
const MONDAY_10AM = '2026-03-02T15:00:00.000Z' // 10:00 EST

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
  mockDb = seedMarketplace()
  mockStripe = createFakeStripe()
  mockStripe.paymentIntents.create.mockImplementation(async (params: { metadata: { bookingId: string } }) => ({
    id: `pi_for_${params.metadata.bookingId}`,
    client_secret: 'pi_secret_123',
  }))
})

afterEach(() => {
  jest.useRealTimers()
})

async function post(body: unknown, token: string = TOKENS.client) {
  const res = await createBooking(request('/api/bookings', { method: 'POST', token, body }))
  return { status: res.status, body: await res.json() }
}

async function patch(id: string, body: unknown, token: string) {
  const res = await updateBooking(request(`/api/bookings/${id}`, { method: 'PATCH', token, body }), routeParams({ id }))
  return { status: res.status, body: await res.json() }
}

const validBody = { barberId: IDS.barber, serviceId: IDS.service, startsAt: MONDAY_10AM, addonIds: [IDS.addon] }

describe('POST /api/bookings', () => {
  it('holds the slot and creates a destination-charge PaymentIntent', async () => {
    const res = await post({ ...validBody, notes: '  skin fade  ' })

    expect(res.status).toBe(201)
    expect(res.body.clientSecret).toBe('pi_secret_123')
    const booking = res.body.booking
    expect(booking).toMatchObject({
      status: 'pending',
      payment_status: 'pending',
      client_id: IDS.clientUser,
      starts_at: MONDAY_10AM,
      ends_at: '2026-03-02T15:30:00.000Z',
      booking_fee_cents: 340,
      application_fee_cents: 220,
      barber_fee_share_cents: 120,
      service_price_cents: 3500,
      addon_total_cents: 1000,
      notes: 'skin fade',
      hold_expires_at: new Date(NOW.getTime() + 10 * 60_000).toISOString(),
      payment_intent_id: `pi_for_${booking.id}`,
    })

    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      {
        amount: 340,
        currency: 'usd',
        application_fee_amount: 220,
        transfer_data: { destination: IDS.stripeAccount },
        metadata: { bookingId: booking.id },
        automatic_payment_methods: { enabled: true },
        description: 'Talii booking fee',
      },
      { idempotencyKey: `booking-${booking.id}-payment-intent` }
    )
    expect(mockDb.rows('booking_addons', { booking_id: booking.id })).toHaveLength(1)
  })

  it('confirms immediately without Stripe for a fee-exempt barber', async () => {
    Object.assign(mockDb.one('barber_billing', { barber_id: IDS.barber })!, {
      fee_exempt: true,
      charges_enabled: false,
      stripe_account_id: null,
    })
    const res = await post(validBody)

    expect(res.status).toBe(201)
    expect(res.body.clientSecret).toBeNull()
    expect(res.body.booking).toMatchObject({
      status: 'confirmed',
      payment_status: 'none',
      booking_fee_cents: 0,
      application_fee_cents: 0,
      hold_expires_at: null,
    })
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it('rejects a barber booking themself', async () => {
    const res = await post(validBody, TOKENS.barber)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('CANNOT_BOOK_SELF')
  })

  it('rejects non-public and disabled barbers', async () => {
    mockDb.one('barbers', { id: IDS.barber })!.is_public = false
    expect((await post(validBody)).status).toBe(404)

    mockDb.one('barbers', { id: IDS.barber })!.is_public = true
    mockDb.one('profiles', { id: IDS.barberUser })!.is_disabled = true
    const res = await post(validBody)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('BARBER_NOT_FOUND')
  })

  it('refuses with 409 BARBER_NOT_READY when the barber cannot take charges', async () => {
    mockDb.one('barber_billing', { barber_id: IDS.barber })!.charges_enabled = false
    const res = await post(validBody)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('BARBER_NOT_READY')
    expect(mockDb.rows('bookings')).toHaveLength(0)
  })

  it("rejects a time outside the barber's hours", async () => {
    const evening = await post({ ...validBody, startsAt: '2026-03-02T23:00:00Z' }) // 18:00 EST
    expect(evening.status).toBe(400)
    expect(evening.body.error.code).toBe('OUTSIDE_HOURS')

    const offGrid = await post({ ...validBody, startsAt: '2026-03-02T15:05:00Z' })
    expect(offGrid.body.error.code).toBe('OUTSIDE_HOURS')

    const sunday = await post({ ...validBody, startsAt: '2026-03-01T15:00:00Z' })
    expect(sunday.body.error.code).toBe('OUTSIDE_HOURS')

    // The same instant written with an offset is the same slot.
    const offset = await post({ ...validBody, addonIds: [], startsAt: '2026-03-02T10:00:00-05:00' })
    expect(offset.status).toBe(201)
  })

  it('rejects a slot that is already booked', async () => {
    mockDb.table('bookings').push(bookingRow({ client_id: IDS.strangerUser }))
    const res = await post(validBody)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SLOT_TAKEN')
  })

  it('treats an expired hold as free', async () => {
    mockDb.table('bookings').push(
      bookingRow({
        client_id: IDS.strangerUser,
        status: 'pending',
        payment_status: 'pending',
        hold_expires_at: '2026-03-01T11:59:00.000Z',
        payment_intent_id: 'pi_old',
      })
    )
    const res = await post(validBody)
    expect(res.status).toBe(201)
    expect(mockDb.one('bookings', { payment_intent_id: 'pi_old' })).toMatchObject({
      status: 'cancelled',
      cancellation_reason: 'hold_expired',
    })
    // The released hold's PaymentIntent is cancelled so it cannot be paid late.
    expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_old')
  })

  it('maps the overlap constraint (23P01) to 409 SLOT_TAKEN', async () => {
    mockDb.rpcHandlers.create_booking_hold = () => ({
      data: null,
      error: { code: '23P01', message: 'conflicting key value violates exclusion constraint' },
    })
    const res = await post(validBody)
    expect(res).toEqual({ status: 409, body: { error: { code: 'SLOT_TAKEN', message: expect.any(String) } } })
  })

  it('maps invalid parameter (22023) to 400', async () => {
    mockDb.one('service_addons', { id: IDS.addon })!.is_active = false
    const res = await post(validBody)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_SELECTION')
    expect(res.body.error.message).not.toContain('add-on is not active') // no database text
  })

  it('rejects an inactive service', async () => {
    const res = await post({ ...validBody, serviceId: IDS.inactiveService })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_SERVICE')
  })

  it('releases the hold and returns 502 when Stripe fails', async () => {
    mockStripe.paymentIntents.create.mockRejectedValueOnce(apiError())
    const res = await post(validBody)
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('STRIPE_ERROR')
    expect(mockDb.rows('bookings')[0]).toMatchObject({
      status: 'cancelled',
      cancellation_reason: 'payment_setup_failed',
      hold_expires_at: null,
    })
  })

  it('limits the number of open holds per client', async () => {
    for (const hour of [14, 16, 17]) {
      const res = await post({ ...validBody, addonIds: [], startsAt: `2026-03-02T${hour}:00:00.000Z` })
      expect(res.status).toBe(201)
    }
    const res = await post({ ...validBody, startsAt: '2026-03-02T18:00:00.000Z' })
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('TOO_MANY_HOLDS')
  })

  it('caps upcoming bookings per barber, also for fee-exempt barbers', async () => {
    mockDb.one('barber_billing', { barber_id: IDS.barber })!.fee_exempt = true
    for (const hour of [14, 15, 16, 17, 18]) {
      const res = await post({ ...validBody, addonIds: [], startsAt: `2026-03-03T${hour}:00:00.000Z` })
      expect(res.status).toBe(201)
      expect(res.body.booking.status).toBe('confirmed')
    }
    const res = await post(validBody)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('BOOKING_LIMIT_REACHED')
  })

  it('caps upcoming bookings overall', async () => {
    const otherBarber = '20000000-0000-4000-8000-0000000000ff'
    for (let i = 0; i < 10; i++) {
      mockDb.table('bookings').push(
        bookingRow({
          id: `60000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
          barber_id: otherBarber,
          starts_at: `2026-04-${String(i + 1).padStart(2, '0')}T15:00:00.000Z`,
          ends_at: `2026-04-${String(i + 1).padStart(2, '0')}T15:30:00.000Z`,
          payment_intent_id: null,
        })
      )
    }
    const res = await post(validBody)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('BOOKING_LIMIT_REACHED')
  })

  it('requires sign-in and validates the body', async () => {
    expect((await createBooking(request('/api/bookings', { method: 'POST', body: validBody }))).status).toBe(401)
    const res = await post({ ...validBody, startsAt: 'tomorrow' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('GET /api/barbers/:id/availability', () => {
  it("returns slots in the barber's time zone", async () => {
    mockDb.table('bookings').push(bookingRow({ client_id: IDS.strangerUser }))
    const res = await getAvailability(
      request(`/api/barbers/${IDS.barber}/availability?date=2026-03-02&serviceId=${IDS.service}`),
      routeParams({ id: IDS.barber })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.timezone).toBe('America/New_York')
    expect(body.slots[0]).toEqual({
      startsAt: '2026-03-02T14:00:00.000Z',
      endsAt: '2026-03-02T14:30:00.000Z',
      time: '09:00',
      available: true,
    })
    const ten = body.slots.find((s: { time: string }) => s.time === '10:00')
    expect(ten).toMatchObject({ available: false, reason: 'booked' })
    expect(body.slots.at(-1).time).toBe('16:30')
  })

  it('404s for unlisted barbers', async () => {
    mockDb.one('barbers', { id: IDS.barber })!.is_public = false
    const res = await getAvailability(
      request(`/api/barbers/${IDS.barber}/availability?date=2026-03-02&serviceId=${IDS.service}`),
      routeParams({ id: IDS.barber })
    )
    expect(res.status).toBe(404)
  })
})

describe('GET /api/bookings', () => {
  it("lists the caller's bookings as client or as barber", async () => {
    mockDb.table('bookings').push(bookingRow())
    mockDb.table('bookings').push(
      bookingRow({ id: '60000000-0000-4000-8000-000000000002', client_id: IDS.strangerUser, payment_intent_id: null })
    )

    const mine = await (await listBookings(request('/api/bookings', { token: TOKENS.client }))).json()
    expect(mine.bookings).toHaveLength(1)
    expect(mine.pagination).toEqual({ limit: 20, offset: 0, total: 1 })

    const asBarber = await (
      await listBookings(request('/api/bookings?as=barber&status=confirmed,pending', { token: TOKENS.barber }))
    ).json()
    expect(asBarber.bookings).toHaveLength(2)

    const notBarber = await listBookings(request('/api/bookings?as=barber', { token: TOKENS.client }))
    expect(notBarber.status).toBe(403)
  })
})

describe('PATCH /api/bookings/:id', () => {
  const id = '60000000-0000-4000-8000-000000000001'
  const refund = {
    id: 're_1',
    object: 'refund',
    amount: 340,
    currency: 'usd',
    status: 'succeeded',
    payment_intent: 'pi_test_1',
    charge: 'ch_1',
  }

  beforeEach(() => {
    mockDb.table('bookings').push(bookingRow())
    mockStripe.refunds.create.mockResolvedValue(refund)
  })

  it('client cancelling more than 24h ahead gets the fee refunded', async () => {
    const res = await patch(id, { action: 'cancel', reason: 'sick' }, TOKENS.client)

    expect(res.status).toBe(200)
    expect(mockStripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_test_1', reverse_transfer: true, refund_application_fee: true }),
      { idempotencyKey: `booking-${id}-cancel-refund` }
    )
    expect(res.body.refund).toEqual({ id: 're_1', amountCents: 340, status: 'succeeded' })
    expect(res.body.booking).toMatchObject({
      status: 'cancelled',
      payment_status: 'refunded',
      cancellation_reason: 'cancelled_by_client: sick',
      cancelled_at: NOW.toISOString(),
    })
    expect(mockDb.rows('payments', { type: 'refund' })).toEqual([
      expect.objectContaining({ booking_id: id, stripe_object_id: 're_1', amount_cents: 340, status: 'succeeded' }),
    ])
  })

  it('client cancelling within 24h gets no refund', async () => {
    jest.setSystemTime(new Date('2026-03-02T00:00:00Z')) // 15h before
    const res = await patch(id, { action: 'cancel' }, TOKENS.client)
    expect(res.status).toBe(200)
    expect(res.body.refund).toBeNull()
    expect(res.body.booking).toMatchObject({ status: 'cancelled', payment_status: 'succeeded' })
    expect(mockStripe.refunds.create).not.toHaveBeenCalled()
  })

  it('barber cancelling always refunds the fee', async () => {
    jest.setSystemTime(new Date('2026-03-02T14:00:00Z')) // 1h before
    const res = await patch(id, { action: 'cancel' }, TOKENS.barber)
    expect(res.status).toBe(200)
    expect(res.body.booking.cancellation_reason).toBe('cancelled_by_barber')
    expect(mockStripe.refunds.create).toHaveBeenCalledTimes(1)
  })

  it('changes nothing when the refund fails', async () => {
    mockStripe.refunds.create.mockRejectedValueOnce(apiError())
    const res = await patch(id, { action: 'cancel' }, TOKENS.client)
    expect(res.status).toBe(502)
    expect(mockDb.one('bookings', { id })).toMatchObject({ status: 'confirmed', payment_status: 'succeeded' })
  })

  it('cancelling an unpaid hold cancels its PaymentIntent', async () => {
    Object.assign(mockDb.one('bookings', { id })!, {
      status: 'pending',
      payment_status: 'pending',
      hold_expires_at: '2026-03-01T12:05:00.000Z',
    })
    const res = await patch(id, { action: 'cancel' }, TOKENS.client)
    expect(res.status).toBe(200)
    expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_test_1')
    expect(mockStripe.refunds.create).not.toHaveBeenCalled()
    expect(res.body.booking).toMatchObject({ status: 'cancelled', hold_expires_at: null })
  })

  it('treats a hold paid while cancelling as paid (cancel races the payment webhook)', async () => {
    Object.assign(mockDb.one('bookings', { id })!, {
      status: 'pending',
      payment_status: 'pending',
      hold_expires_at: '2026-03-01T12:05:00.000Z',
    })
    // The webhook confirms the booking while the cancel is in flight, so Stripe refuses to cancel the intent.
    mockStripe.paymentIntents.cancel.mockImplementation(async () => {
      Object.assign(mockDb.one('bookings', { id })!, { status: 'confirmed', payment_status: 'succeeded', hold_expires_at: null })
      mockDb.table('payments').push({
        booking_id: id, type: 'charge', stripe_object_id: 'pi_test_1', payment_intent_id: 'pi_test_1',
        amount_cents: 340, application_fee_cents: 220, status: 'succeeded',
      })
      throw invalidRequestError('payment_intent_unexpected_state', 'already succeeded')
    })
    mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_test_1', status: 'succeeded' })

    const res = await patch(id, { action: 'cancel' }, TOKENS.client)

    expect(res.status).toBe(200)
    expect(mockStripe.refunds.create).toHaveBeenCalledTimes(1)
    expect(res.body.booking).toMatchObject({ status: 'cancelled', payment_status: 'refunded' })
    expect(res.body.refund).toMatchObject({ id: 're_1', amountCents: 340 })
  })

  it('refunds in full when a still-pending hold turns out to be paid, even within 24 hours', async () => {
    jest.setSystemTime(new Date('2026-03-02T00:00:00Z')) // 15h before: the 24h rule would keep the fee
    Object.assign(mockDb.one('bookings', { id })!, {
      status: 'pending',
      payment_status: 'pending',
      hold_expires_at: '2026-03-02T00:05:00.000Z',
    })
    mockStripe.paymentIntents.cancel.mockRejectedValue(invalidRequestError('payment_intent_unexpected_state'))
    mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_test_1', status: 'succeeded' })

    const res = await patch(id, { action: 'cancel' }, TOKENS.client)
    expect(res.status).toBe(200)
    // The client cancelled before seeing a confirmation, so the fee comes back whatever the timing.
    expect(mockStripe.refunds.create).toHaveBeenCalledTimes(1)
    expect(res.body.booking).toMatchObject({ status: 'cancelled', payment_status: 'refunded' })
    expect(res.body.refund).toMatchObject({ id: 're_1', amountCents: 340 })
  })

  it('still refunds in full within 24 hours when the webhook confirms the hold during the cancel', async () => {
    jest.setSystemTime(new Date('2026-03-02T00:00:00Z'))
    Object.assign(mockDb.one('bookings', { id })!, {
      status: 'pending',
      payment_status: 'pending',
      hold_expires_at: '2026-03-02T00:05:00.000Z',
    })
    mockStripe.paymentIntents.cancel.mockImplementation(async () => {
      Object.assign(mockDb.one('bookings', { id })!, { status: 'confirmed', payment_status: 'succeeded', hold_expires_at: null })
      mockDb.table('payments').push({
        booking_id: id, type: 'charge', stripe_object_id: 'pi_test_1', payment_intent_id: 'pi_test_1',
        amount_cents: 340, application_fee_cents: 220, status: 'succeeded',
      })
      throw invalidRequestError('payment_intent_unexpected_state', 'already succeeded')
    })
    mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_test_1', status: 'succeeded' })

    const res = await patch(id, { action: 'cancel' }, TOKENS.client)
    expect(res.status).toBe(200)
    expect(mockStripe.refunds.create).toHaveBeenCalledTimes(1)
    expect(res.body.booking).toMatchObject({ status: 'cancelled', payment_status: 'refunded' })
  })

  it('keeps the 24h rule for a booking the client saw confirmed', async () => {
    jest.setSystemTime(new Date('2026-03-02T00:00:00Z'))
    const res = await patch(id, { action: 'cancel' }, TOKENS.client)
    expect(res.status).toBe(200)
    expect(mockStripe.refunds.create).not.toHaveBeenCalled()
    expect(res.body.booking).toMatchObject({ status: 'cancelled', payment_status: 'succeeded' })
  })

  it('does not refund twice when payments already show a full refund', async () => {
    mockDb.table('payments').push(
      { booking_id: id, type: 'charge', stripe_object_id: 'pi_test_1', payment_intent_id: 'pi_test_1', amount_cents: 340, application_fee_cents: 220, status: 'succeeded' },
      { booking_id: id, type: 'refund', stripe_object_id: 're_old', payment_intent_id: 'pi_test_1', amount_cents: 340, application_fee_cents: 0, status: 'succeeded' }
    )
    const res = await patch(id, { action: 'cancel' }, TOKENS.client)
    expect(res.status).toBe(200)
    expect(mockStripe.refunds.create).not.toHaveBeenCalled()
    expect(res.body.booking.payment_status).toBe('refunded')
  })

  it("treats Stripe's charge_already_refunded as done", async () => {
    mockStripe.refunds.create.mockRejectedValue(invalidRequestError('charge_already_refunded'))
    const res = await patch(id, { action: 'cancel' }, TOKENS.barber)
    expect(res.status).toBe(200)
    expect(res.body.booking).toMatchObject({ status: 'cancelled', payment_status: 'refunded' })
    expect(res.body.refund).toBeNull()
  })

  it('refuses to cancel once the appointment has started, for both roles', async () => {
    jest.setSystemTime(new Date('2026-03-02T15:00:00Z'))
    for (const token of [TOKENS.client, TOKENS.barber]) {
      const res = await patch(id, { action: 'cancel' }, token)
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('TOO_LATE_TO_CANCEL')
    }
    expect(mockDb.one('bookings', { id })!.status).toBe('confirmed')
  })

  it('hides bookings from strangers', async () => {
    const res = await patch(id, { action: 'cancel' }, TOKENS.stranger)
    expect(res.status).toBe(404)
  })

  it('cannot cancel a completed booking', async () => {
    mockDb.one('bookings', { id })!.status = 'completed'
    const res = await patch(id, { action: 'cancel' }, TOKENS.client)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('BOOKING_NOT_CANCELLABLE')
  })

  it('only the barber completes, and only after the start time', async () => {
    expect((await patch(id, { action: 'complete' }, TOKENS.client)).status).toBe(403)

    const early = await patch(id, { action: 'complete' }, TOKENS.barber)
    expect(early.status).toBe(409)
    expect(early.body.error.code).toBe('TOO_EARLY')

    jest.setSystemTime(new Date('2026-03-02T15:40:00Z'))
    const done = await patch(id, { action: 'complete' }, TOKENS.barber)
    expect(done.status).toBe(200)
    expect(done.body.booking.status).toBe('completed')
  })

  it('marks a no-show only on a confirmed booking', async () => {
    jest.setSystemTime(new Date('2026-03-02T15:40:00Z'))
    const res = await patch(id, { action: 'no_show' }, TOKENS.barber)
    expect(res.body.booking.status).toBe('no_show')

    const again = await patch(id, { action: 'no_show' }, TOKENS.barber)
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('INVALID_STATUS')
  })

  it('rejects unknown actions', async () => {
    const res = await patch(id, { action: 'refund' }, TOKENS.client)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/bookings/manual', () => {
  async function manual(body: unknown, token: string = TOKENS.barber) {
    const res = await createManual(request('/api/bookings/manual', { method: 'POST', token, body }))
    return { status: res.status, body: await res.json() }
  }

  it('adds a walk-in to the barber calendar', async () => {
    const res = await manual({ serviceId: IDS.service, startsAt: MONDAY_10AM, customerName: ' Sam ' })
    expect(res.status).toBe(201)
    expect(res.body.booking).toMatchObject({
      barber_id: IDS.barber,
      client_id: null,
      customer_name: 'Sam',
      source: 'manual',
      status: 'confirmed',
      payment_status: 'none',
      ends_at: '2026-03-02T15:30:00.000Z',
    })
  })

  it('respects the overlap constraint', async () => {
    mockDb.table('bookings').push(bookingRow())
    const res = await manual({ serviceId: IDS.service, startsAt: '2026-03-02T15:15:00Z', customerName: 'Sam' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SLOT_TAKEN')
  })

  it('is for barbers only', async () => {
    const res = await manual({ serviceId: IDS.service, startsAt: MONDAY_10AM, customerName: 'Sam' }, TOKENS.client)
    expect(res.status).toBe(403)
  })
})
