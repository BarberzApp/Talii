#!/usr/bin/env node
// End-to-end test of the booking and payment API against a running `next dev`,
// the LOCAL Supabase stack and Stripe TEST mode. See README.md.
//
//   node apps/web/tests/e2e-api/run.mjs            setup + all scenarios
//   node apps/web/tests/e2e-api/run.mjs cleanup    delete harness Stripe accounts, restore seed billing
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import {
  API_BASE,
  NOTE,
  Recorder,
  STRIPE_API_VERSION,
  USERS,
  addDays,
  api,
  localDate,
  localTime,
  makeClients,
  scrub,
  signIn,
  sleep,
  waitFor,
} from './lib.mjs'
import { cleanup, ensureBarberThree, ensureConnectedAccount, loadSeed, purgeE2eRows } from './setup.mjs'

const MODE = process.argv[2] ?? 'run'
for (const evt of ['uncaughtException', 'unhandledRejection']) {
  process.on(evt, (error) => {
    console.error(`FATAL: ${scrub(error?.type ? `${error.type} ${error.code ?? ''} ${error.param ?? ''}: ${error.message}` : error?.stack ?? String(error))}`)
    process.exit(2)
  })
}
const ctx = makeClients()
const { db, stripe, sb } = ctx
const R = new Recorder()
let cachedWhsec // stripe listen signing secret, memory only
const RETURN_URL = 'https://example.com/booking/return'

if (MODE === 'cleanup') {
  await cleanup(db, stripe)
  process.exit(0)
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function bookingRow(id) {
  const { data, error } = await db.from('bookings').select('*').eq('id', id).single()
  if (error) throw error
  return data
}
async function paymentRows(bookingId) {
  const { data, error } = await db.from('payments').select('*').eq('booking_id', bookingId).order('created_at')
  if (error) throw error
  return data
}
async function eventsForObject(objectId) {
  const { data, error } = await db
    .from('stripe_events')
    .select('id, type, processed_at, error, received_at')
    .filter('payload->data->object->>id', 'eq', objectId)
    .order('received_at')
  if (error) throw error
  return data
}
async function waitEvent(objectId, type) {
  return waitFor(async () => {
    const evs = await eventsForObject(objectId)
    return evs.find((e) => e.type === type && e.processed_at) ?? null
  }, `${type} for ${objectId}`)
}
async function waitBooking(id, pred, what) {
  return waitFor(async () => {
    const b = await bookingRow(id)
    return pred(b) ? b : null
  }, what)
}

const seed = await (async () => {
  console.log(`API ${API_BASE}; Supabase ${sb.url}; Stripe API ${STRIPE_API_VERSION}`)
  return loadSeed(db)
})()

/** First available slot for a barber/service from `fromDate` forward, optionally bounded. */
async function findFreeSlot(barber, serviceId, { fromDate, days = 30, minStart = 0, maxStart = Infinity, avoidDates = new Set() }) {
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i)
    if (avoidDates.has(date)) continue
    const r = await api('GET', `/api/barbers/${barber.id}/availability?date=${date}&serviceId=${serviceId}`)
    if (r.status !== 200) throw new Error(`availability ${date}: ${r.status} ${JSON.stringify(r.json)}`)
    const slot = r.json.slots.find((s) => s.available && Date.parse(s.startsAt) >= minStart && Date.parse(s.startsAt) <= maxStart)
    if (slot) return { date, ...slot }
  }
  return null
}

/** A slot starting between 20 minutes and 23 hours from now (special hours added if none). */
async function slotWithin24h(barber, serviceId) {
  const now = Date.now()
  const bounds = { minStart: now + 20 * 60_000, maxStart: now + 23 * 3_600_000 }
  const today = localDate(now, barber.timezone)
  let slot = await findFreeSlot(barber, serviceId, { fromDate: today, days: 2, ...bounds })
  if (slot) return slot
  const date = localDate(now + 3 * 3_600_000, barber.timezone)
  const { error } = await db
    .from('special_hours')
    .insert({ barber_id: barber.id, date, is_closed: false, start_time: '00:00', end_time: '23:59', reason: 'e2e-api open (inside 24h test)' })
  if (error) throw error
  slot = await findFreeSlot(barber, serviceId, { fromDate: date, days: 1, ...bounds })
  if (!slot) throw new Error('could not find a slot within 24 hours')
  return slot
}

/**
 * Confirms a PaymentIntent the way the mobile Payment Sheet does: with the
 * publishable key and the client secret the API returned. Falls back to the
 * secret key when no publishable test key is configured.
 */
async function confirmPayment(piId, clientSecret, paymentMethod) {
  if (ctx.pk) {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}/confirm`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ctx.pk}`, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': STRIPE_API_VERSION },
      body: new URLSearchParams({ payment_method: paymentMethod, client_secret: clientSecret, return_url: RETURN_URL }),
    })
    const json = await res.json()
    if (res.ok) return { ok: true, status: json.status, via: 'publishable key + client secret' }
    if (json.error?.type === 'card_error') return { ok: false, code: json.error.code, declineCode: json.error.decline_code, via: 'publishable key + client secret' }
    if (json.error?.code !== 'resource_missing') throw new Error(`confirm failed: ${json.error?.message}`)
  }
  try {
    const pi = await stripe.paymentIntents.confirm(piId, { payment_method: paymentMethod, return_url: RETURN_URL })
    return { ok: true, status: pi.status, via: 'secret key' }
  } catch (e) {
    if (e.type === 'StripeCardError') return { ok: false, code: e.code, declineCode: e.decline_code, via: 'secret key' }
    throw e
  }
}

async function bookAs(user, barber, serviceId, startsAt, extra = {}) {
  return api('POST', '/api/bookings', {
    token: user.token,
    body: { barberId: barber.id, serviceId, startsAt, notes: NOTE, ...extra },
  })
}

/** Books and pays with pm_card_visa; returns the confirmed booking. */
async function bookAndPay(user, barber, serviceId, slot, label) {
  const r = await bookAs(user, barber, serviceId, slot.startsAt)
  if (r.status !== 201) throw new Error(`${label}: POST /api/bookings ${r.status} ${JSON.stringify(r.json)}`)
  const b = r.json.booking
  const c = await confirmPayment(b.payment_intent_id, r.json.clientSecret, 'pm_card_visa')
  if (!c.ok) throw new Error(`${label}: confirm failed ${c.code}`)
  const confirmed = await waitBooking(b.id, (x) => x.status === 'confirmed' && x.payment_status === 'succeeded', `${label} confirmed`)
  return { booking: confirmed, piId: b.payment_intent_id, clientSecret: r.json.clientSecret }
}

/** Stripe side of a destination charge: fee, transfer and the barber's net. */
async function stripeChargeFacts(piId) {
  // The transfer and application fee are attached to the charge a moment after it succeeds.
  const pi = await waitFor(async () => {
    const p = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge.transfer', 'latest_charge.application_fee'] })
    return p.latest_charge?.transfer && p.latest_charge?.application_fee ? p : null
  }, `transfer and application fee on ${piId}`, { timeoutMs: 30_000, intervalMs: 1500 })
  const ch = pi.latest_charge
  const transfer = ch.transfer
  let destNet = null
  if (transfer?.destination_payment) {
    const py = await stripe.charges.retrieve(transfer.destination_payment, { expand: ['balance_transaction'] }, { stripeAccount: transfer.destination })
    destNet = py.balance_transaction?.net ?? null
  }
  return {
    pi,
    charge: ch,
    facts: {
      pi: pi.id,
      piStatus: pi.status,
      amount: pi.amount,
      application_fee_amount: pi.application_fee_amount,
      destination: pi.transfer_data?.destination,
      charge: ch.id,
      chargeAppFee: ch.application_fee_amount,
      applicationFee: ch.application_fee?.id,
      applicationFeeAmount: ch.application_fee?.amount,
      applicationFeeRefunded: ch.application_fee?.amount_refunded,
      transfer: transfer?.id,
      transferAmount: transfer?.amount,
      transferReversed: transfer?.amount_reversed,
      destinationPayment: transfer?.destination_payment,
      barberNetOnConnectedAccount: destNet,
      refunded: ch.refunded,
      amountRefunded: ch.amount_refunded,
    },
  }
}

async function refundFacts(refundId) {
  const re = await stripe.refunds.retrieve(refundId, { expand: ['transfer_reversal', 'charge.application_fee'] })
  return {
    refund: re.id,
    status: re.status,
    amount: re.amount,
    transferReversal: re.transfer_reversal?.id ?? null,
    transferReversalAmount: re.transfer_reversal?.amount ?? null,
    applicationFeeRefunded: re.charge?.application_fee?.amount_refunded ?? null,
  }
}

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

const runStartedAt = new Date().toISOString()
const purged = await purgeE2eRows(db)
console.log(`purged ${purged} bookings from earlier harness runs`)
const account = await ensureConnectedAccount(db, stripe, seed)
seed.b3 = await ensureBarberThree(db, seed)
const { b1, b2, b3, skinFade, cutLineup, beardTrim } = seed

const c1 = await signIn(sb, USERS.clientOne.email)
const c2 = await signIn(sb, USERS.clientTwo.email)
const bo1 = await signIn(sb, USERS.barberOne.email)
const bo2 = await signIn(sb, USERS.barberTwo.email)
const bo3 = await signIn(sb, USERS.barberThree.email)

// Far-future dates (in barber one's time zone) keep these bookings out of the seed's dates.
const today1 = localDate(Date.now(), b1.timezone)
const FAR_FROM = addDays(today1, 21)
const LATE_FROM = addDays(today1, 42) // scenario 5 closes its own date
const EARNINGS_FROM = addDays(today1, 20)
const EARNINGS_TO = addDays(today1, 70)
const S = {} // shared state between scenarios

// ---------------------------------------------------------------------------
// Connect onboarding and status
// ---------------------------------------------------------------------------

await R.scenario('C. Stripe Connect onboarding/status', async () => {
  R.note('barber one connected account', account.id)
  R.check('barber one test account can take destination charges', account.charges_enabled && account.capabilities?.transfers === 'active', {
    charges_enabled: account.charges_enabled,
    transfers: account.capabilities?.transfers,
  })

  const st1 = await api('GET', '/api/stripe/connect/status', { token: bo1.token })
  R.check('barber one status 200, hasAccount, chargesEnabled', st1.status === 200 && st1.json.hasAccount && st1.json.chargesEnabled, st1)
  const ob1 = await api('POST', '/api/stripe/connect/onboarding', { token: bo1.token })
  R.check('barber one onboarding 200 with a Stripe link', ob1.status === 200 && /^https:\/\/connect\.stripe\.com\//.test(ob1.json?.url ?? ''), { status: ob1.status, type: ob1.json?.type, host: ob1.json?.url && new URL(ob1.json.url).host })
  const { data: bill1 } = await db.from('barber_billing').select('stripe_account_id, charges_enabled').eq('barber_id', b1.id).single()
  R.check('barber one stripe_account_id not overwritten', bill1.stripe_account_id === account.id, bill1)

  const st3a = await api('GET', '/api/stripe/connect/status', { token: bo3.token })
  R.check('barber three (no account) status: hasAccount false', st3a.status === 200 && st3a.json.hasAccount === false, st3a)

  const ob3a = await api('POST', '/api/stripe/connect/onboarding', { token: bo3.token })
  R.check('barber three onboarding 200 with a real onboarding link', ob3a.status === 200 && ob3a.json?.type === 'onboarding' && /^https:\/\/connect\.stripe\.com\/setup\//.test(ob3a.json?.url ?? ''), { status: ob3a.status, type: ob3a.json?.type, urlPrefix: ob3a.json?.url?.slice(0, 34) })
  const { data: bill3 } = await db.from('barber_billing').select('stripe_account_id, charges_enabled, details_submitted').eq('barber_id', b3.id).single()
  R.note('barber three new Express account', bill3.stripe_account_id)
  S.b3Account = bill3.stripe_account_id
  const acct3 = await stripe.accounts.retrieve(bill3.stripe_account_id)
  R.check('new account is Express with metadata barber_id/user_id of barber three', acct3.type === 'express' && acct3.metadata.barber_id === b3.id && acct3.metadata.user_id === USERS.barberThree.id, { type: acct3.type, metadata: acct3.metadata })

  const ob3c = await api('POST', '/api/stripe/connect/onboarding', { token: bo3.token })
  const { data: bill3b } = await db.from('barber_billing').select('stripe_account_id').eq('barber_id', b3.id).single()
  R.check('second onboarding call reuses the same account (nothing overwritten)', ob3c.status === 200 && bill3b.stripe_account_id === bill3.stripe_account_id, { status: ob3c.status, before: bill3.stripe_account_id, after: bill3b.stripe_account_id })

  const st3b = await api('GET', '/api/stripe/connect/status', { token: bo3.token })
  R.check('barber three status: hasAccount true, charges/details false', st3b.status === 200 && st3b.json.hasAccount === true && st3b.json.chargesEnabled === false && st3b.json.detailsSubmitted === false, st3b)

  const dash3 = await api('POST', '/api/stripe/connect/dashboard', { token: bo3.token })
  R.check('dashboard route returns onboarding link while details are missing', dash3.status === 200 && dash3.json?.type === 'onboarding', { status: dash3.status, type: dash3.json?.type })

  // Metadata mismatch: the stored account claims another barber -> 403, nothing written or created.
  await stripe.accounts.update(bill3.stripe_account_id, { metadata: { barber_id: b1.id } })
  const mis = await api('POST', '/api/stripe/connect/onboarding', { token: bo3.token })
  const misStatus = await api('GET', '/api/stripe/connect/status', { token: bo3.token })
  const { data: bill3c } = await db.from('barber_billing').select('stripe_account_id').eq('barber_id', b3.id).single()
  await stripe.accounts.update(bill3.stripe_account_id, { metadata: { barber_id: b3.id } })
  R.check('ACCOUNT_MISMATCH 403 on onboarding and status; row unchanged', mis.status === 403 && mis.json?.error?.code === 'ACCOUNT_MISMATCH' && misStatus.status === 403 && bill3c.stripe_account_id === bill3.stripe_account_id, { onboarding: mis, status: misStatus.status })

  const clientTry = await api('POST', '/api/stripe/connect/onboarding', { token: c1.token })
  R.check('client cannot start onboarding (403 NOT_A_BARBER)', clientTry.status === 403 && clientTry.json?.error?.code === 'NOT_A_BARBER', clientTry)
})

// ---------------------------------------------------------------------------
// 1 + 2. Availability and the happy path
// ---------------------------------------------------------------------------

await R.scenario('1. Availability in the barber time zone', async () => {
  const slot = await findFreeSlot(b1, skinFade.id, { fromDate: FAR_FROM })
  S.happyDate = slot.date
  const r = await api('GET', `/api/barbers/${b1.id}/availability?date=${slot.date}&serviceId=${skinFade.id}`)
  const slots = r.json.slots
  R.check('200, timezone America/New_York, 45-minute service', r.status === 200 && r.json.timezone === 'America/New_York' && r.json.durationMinutes === 45, { status: r.status, tz: r.json.timezone })
  R.check('first slot 09:00 local, last ends by 17:00, 15-minute grid', slots[0].time === '09:00' && localTime(slots[0].startsAt, 'America/New_York') === '09:00' && localTime(slots.at(-1).endsAt, 'America/New_York') === '17:00' && Date.parse(slots[1].startsAt) - Date.parse(slots[0].startsAt) === 15 * 60_000, { first: slots[0], last: slots.at(-1), count: slots.length })
  R.check('every slot time matches its instant in New York', slots.every((s) => localTime(s.startsAt, 'America/New_York') === s.time))

  const r2 = await api('GET', `/api/barbers/${b2.id}/availability?date=${slot.date}&serviceId=${cutLineup.id}`)
  R.note('barber two (Chicago) same date', { status: r2.status, first: r2.json.slots?.[0] })
  if (r2.json.slots?.length) {
    R.check('barber two first slot 10:00 Chicago time', r2.json.timezone === 'America/Chicago' && r2.json.slots[0].time === '10:00' && localTime(r2.json.slots[0].startsAt, 'America/Chicago') === '10:00')
  }
  let sunday = FAR_FROM
  while (new Date(`${sunday}T12:00:00Z`).getUTCDay() !== 0) sunday = addDays(sunday, 1)
  const rs = await api('GET', `/api/barbers/${b1.id}/availability?date=${sunday}&serviceId=${skinFade.id}`)
  R.check('closed day (Sunday) has no slots', rs.status === 200 && rs.json.slots.length === 0, { date: sunday, slots: rs.json.slots?.length })
  const wrong = await api('GET', `/api/barbers/${b1.id}/availability?date=${slot.date}&serviceId=${cutLineup.id}`)
  R.check("another barber's service is 404 SERVICE_NOT_FOUND", wrong.status === 404 && wrong.json.error.code === 'SERVICE_NOT_FOUND', wrong)
  S.availabilitySlot = slot
})

await R.scenario('2. Happy path: book, pay with pm_card_visa, webhook confirms', async () => {
  const slot = S.availabilitySlot
  const r = await bookAs(c1, b1, skinFade.id, slot.startsAt, { addonIds: [beardTrim.id] })
  const b = r.json.booking
  R.check('POST /api/bookings 201 with clientSecret', r.status === 201 && /^pi_[A-Za-z0-9]+_secret_/.test(r.json.clientSecret ?? ''), { status: r.status, error: r.json.error })
  R.check('pending hold with fee snapshot 340/220/120 and add-on', b.status === 'pending' && b.payment_status === 'pending' && b.booking_fee_cents === 340 && b.application_fee_cents === 220 && b.barber_fee_share_cents === 120 && b.addon_total_cents === beardTrim.price_cents && !!b.hold_expires_at, { id: b.id, status: b.status, pay: b.payment_status, hold: b.hold_expires_at })
  R.check('clientSecret belongs to the stored PaymentIntent', r.json.clientSecret.startsWith(`${b.payment_intent_id}_secret_`))
  S.happy = { id: b.id, piId: b.payment_intent_id, startsAt: b.starts_at, endsAt: b.ends_at }
  R.note('booking', b.id)
  R.note('payment intent', b.payment_intent_id)

  const avHeld = await api('GET', `/api/barbers/${b1.id}/availability?date=${slot.date}&serviceId=${skinFade.id}`)
  const heldSlot = avHeld.json.slots.find((s) => s.startsAt === slot.startsAt)
  R.check('[1] held slot shows unavailable (booked)', heldSlot && heldSlot.available === false && heldSlot.reason === 'booked', heldSlot)

  const pi0 = await stripe.paymentIntents.retrieve(b.payment_intent_id)
  R.check('Stripe PI: 340 usd, application_fee_amount 220, destination = barber account, metadata.bookingId', pi0.amount === 340 && pi0.currency === 'usd' && pi0.application_fee_amount === 220 && pi0.transfer_data?.destination === account.id && pi0.metadata.bookingId === b.id, { amount: pi0.amount, fee: pi0.application_fee_amount, dest: pi0.transfer_data?.destination, status: pi0.status })

  const c = await confirmPayment(b.payment_intent_id, r.json.clientSecret, 'pm_card_visa')
  R.check('confirm with pm_card_visa succeeded', c.ok && c.status === 'succeeded', c)
  const confirmed = await waitBooking(b.id, (x) => x.status === 'confirmed', 'booking confirmed')
  R.check('booking confirmed, payment succeeded, hold cleared', confirmed.payment_status === 'succeeded' && confirmed.hold_expires_at === null, { status: confirmed.status, pay: confirmed.payment_status, hold: confirmed.hold_expires_at })

  const ev = await waitEvent(b.payment_intent_id, 'payment_intent.succeeded')
  R.check('stripe_events payment_intent.succeeded processed without error', !!ev.processed_at && ev.error === null, ev)
  S.happy.succeededEvent = ev.id
  const pays = await paymentRows(b.id)
  R.check('exactly one payments charge row 340/220', pays.length === 1 && pays[0].type === 'charge' && pays[0].amount_cents === 340 && pays[0].application_fee_cents === 220 && pays[0].stripe_object_id === b.payment_intent_id, pays.map((p) => ({ type: p.type, id: p.stripe_object_id, amt: p.amount_cents, fee: p.application_fee_cents, status: p.status })))

  const { facts } = await stripeChargeFacts(b.payment_intent_id)
  R.note('stripe', facts)
  R.check('Stripe: application fee 220 collected', facts.chargeAppFee === 220 && facts.applicationFeeAmount === 220)
  R.check('Stripe: transfer to the connected account; barber nets 120', facts.transferAmount - facts.applicationFeeAmount === 120 && facts.barberNetOnConnectedAccount === 120, { transferAmount: facts.transferAmount, net: facts.barberNetOnConnectedAccount })

  const av2 = await api('GET', `/api/barbers/${b1.id}/availability?date=${slot.date}&serviceId=${skinFade.id}`)
  const s2 = av2.json.slots.find((s) => s.startsAt === slot.startsAt)
  const overlapping = av2.json.slots.find((s) => Date.parse(s.startsAt) === Date.parse(slot.startsAt) + 30 * 60_000)
  R.check('[1] confirmed slot and an overlapping slot show unavailable', s2.available === false && s2.reason === 'booked' && overlapping?.available === false, { s2, overlapping })
})

// ---------------------------------------------------------------------------
// 3. Holds and races
// ---------------------------------------------------------------------------

await R.scenario('3. Held slot and simultaneous requests', async () => {
  const slot = await findFreeSlot(b1, skinFade.id, { fromDate: FAR_FROM })
  const first = await bookAs(c1, b1, skinFade.id, slot.startsAt)
  R.check('client one holds the slot (201)', first.status === 201, { status: first.status, error: first.json.error })
  const second = await bookAs(c2, b1, skinFade.id, slot.startsAt)
  R.check('client two on the held slot: 409 SLOT_TAKEN', second.status === 409 && second.json.error?.code === 'SLOT_TAKEN', second)
  const cancel = await api('PATCH', `/api/bookings/${first.json.booking.id}`, { token: c1.token, body: { action: 'cancel' } })
  R.check('client one cancels the unpaid hold (200, no refund)', cancel.status === 200 && cancel.json.booking.status === 'cancelled' && cancel.json.refund === null, { status: cancel.status, b: cancel.json.booking?.status })
  const piHold = await stripe.paymentIntents.retrieve(first.json.booking.payment_intent_id)
  R.check("hold's PaymentIntent canceled at Stripe", piHold.status === 'canceled', { pi: piHold.id, status: piHold.status })
  const afterCancel = await waitBooking(first.json.booking.id, (x) => x.payment_status === 'failed', 'payment_intent.canceled applied')
  R.check('payment_intent.canceled webhook marks payment failed', afterCancel.payment_status === 'failed', afterCancel.payment_status)

  const race = await findFreeSlot(b1, skinFade.id, { fromDate: FAR_FROM })
  const [x, y] = await Promise.all([bookAs(c1, b1, skinFade.id, race.startsAt), bookAs(c2, b1, skinFade.id, race.startsAt)])
  const statuses = [x.status, y.status].sort()
  R.check('two simultaneous POSTs: exactly one 201, the other 409 SLOT_TAKEN', statuses[0] === 201 && statuses[1] === 409 && [x, y].find((q) => q.status === 409).json.error.code === 'SLOT_TAKEN', { a: x.status, b: y.status, codes: [x.json.error?.code, y.json.error?.code] })
  const { data: active } = await db.from('bookings').select('id, client_id, status').eq('barber_id', b1.id).eq('starts_at', race.startsAt).in('status', ['pending', 'confirmed'])
  R.check('database holds exactly one active booking for that slot', active.length === 1, active)
  const winner = [x, y].find((q) => q.status === 201)
  if (winner) {
    const who = winner === x ? c1 : c2
    await api('PATCH', `/api/bookings/${winner.json.booking.id}`, { token: who.token, body: { action: 'cancel' } })
  }
})

// ---------------------------------------------------------------------------
// 4. Decline then succeed
// ---------------------------------------------------------------------------

await R.scenario('4. Declined card, then success on the same PaymentIntent', async () => {
  const slot = await findFreeSlot(b1, skinFade.id, { fromDate: FAR_FROM })
  const r = await bookAs(c2, b1, skinFade.id, slot.startsAt)
  const b = r.json.booking
  R.check('201', r.status === 201, r.status)
  const d = await confirmPayment(b.payment_intent_id, r.json.clientSecret, 'pm_card_chargeDeclined')
  R.check('pm_card_chargeDeclined is declined', !d.ok && d.code === 'card_declined', d)
  const failEv = await waitEvent(b.payment_intent_id, 'payment_intent.payment_failed')
  R.check('payment_failed webhook processed', !!failEv.processed_at && failEv.error === null, failEv)
  const mid = await bookingRow(b.id)
  R.check('booking still pending, payment pending, hold kept', mid.status === 'pending' && mid.payment_status === 'pending' && !!mid.hold_expires_at, { status: mid.status, pay: mid.payment_status })
  const ok = await confirmPayment(b.payment_intent_id, r.json.clientSecret, 'pm_card_visa')
  R.check('retry with pm_card_visa succeeds', ok.ok && ok.status === 'succeeded', ok)
  const fin = await waitBooking(b.id, (x) => x.status === 'confirmed', 'confirmed after retry')
  R.check('confirmed / succeeded after retry', fin.payment_status === 'succeeded' && fin.hold_expires_at === null)
  await waitEvent(b.payment_intent_id, 'payment_intent.succeeded')
  const pays = await paymentRows(b.id)
  R.check('one charge row', pays.length === 1 && pays[0].type === 'charge', pays.length)
  S.declineRetry = { id: b.id, piId: b.payment_intent_id }
  R.note('booking / PI', `${b.id} / ${b.payment_intent_id}`)
})

// ---------------------------------------------------------------------------
// 5. Late payment
// ---------------------------------------------------------------------------

await R.scenario('5. Late payment after the hold expired and the slot became invalid', async () => {
  const slot = await findFreeSlot(b1, skinFade.id, { fromDate: LATE_FROM })
  const r = await bookAs(c2, b1, skinFade.id, slot.startsAt)
  const b = r.json.booking
  R.check('201 hold', r.status === 201, r.status)
  const past = new Date(Date.now() - 5 * 60_000).toISOString()
  const { error: e1 } = await db.from('bookings').update({ hold_expires_at: past }).eq('id', b.id)
  const { error: e2 } = await db.from('special_hours').insert({ barber_id: b1.id, date: slot.date, is_closed: true, reason: 'e2e-api closed (late payment test)' })
  if (e1 || e2) throw e1 || e2
  R.note('setup', `hold_expires_at=${past}; ${slot.date} closed via special_hours`)

  const c = await confirmPayment(b.payment_intent_id, r.json.clientSecret, 'pm_card_visa')
  R.check('late confirm accepted by Stripe', c.ok && c.status === 'succeeded', c)
  const fin = await waitBooking(b.id, (x) => x.status !== 'pending' && x.payment_status === 'refunded', 'late payment refunded')
  R.check('booking cancelled (late_payment), payment refunded, not confirmed', fin.status === 'cancelled' && fin.cancellation_reason === 'late_payment', { status: fin.status, reason: fin.cancellation_reason, pay: fin.payment_status })
  const ev = await waitEvent(b.payment_intent_id, 'payment_intent.succeeded')
  R.check('stripe_events.error records the late refund', /arrived late/.test(ev.error ?? '') && /refunded re_/.test(ev.error ?? ''), ev.error)
  const pays = await paymentRows(b.id)
  const refundRow = pays.find((p) => p.type === 'refund')
  R.check('payments: one charge row and one 340 refund row', pays.filter((p) => p.type === 'charge').length === 1 && pays.filter((p) => p.type === 'refund').length === 1 && refundRow.amount_cents === 340, pays.map((p) => `${p.type}:${p.stripe_object_id}:${p.amount_cents}:${p.status}`))
  const rf = await refundFacts(refundRow.stripe_object_id)
  R.note('stripe refund', rf)
  R.check('Stripe: full refund with transfer reversal and application fee refunded', rf.amount === 340 && !!rf.transferReversal && rf.applicationFeeRefunded === 220, rf)
  await db.from('special_hours').delete().eq('barber_id', b1.id).eq('date', slot.date).like('reason', 'e2e-api%')
  S.late = { id: b.id, piId: b.payment_intent_id }
})

// ---------------------------------------------------------------------------
// 6. Cancellation and refunds
// ---------------------------------------------------------------------------

await R.scenario('6a. Client cancels more than 24h ahead: full refund', async () => {
  const slot = await findFreeSlot(b1, skinFade.id, { fromDate: FAR_FROM })
  const { booking, piId } = await bookAndPay(c1, b1, skinFade.id, slot, '6a')
  await waitEvent(piId, 'payment_intent.succeeded')
  const r = await api('PATCH', `/api/bookings/${booking.id}`, { token: c1.token, body: { action: 'cancel', reason: 'e2e' } })
  R.check('200 with a 340 refund', r.status === 200 && r.json.refund?.amountCents === 340, { status: r.status, refund: r.json.refund, error: r.json.error })
  R.check('booking cancelled / refunded', r.json.booking?.status === 'cancelled' && r.json.booking?.payment_status === 'refunded', { status: r.json.booking?.status, pay: r.json.booking?.payment_status })
  const { charge } = await stripeChargeFacts(piId)
  await waitEvent(charge.id, 'charge.refunded')
  await waitEvent(r.json.refund.id, 'refund.created').catch(() => null)
  await sleep(3000) // let refund.updated / charge.refund.updated land too
  const pays = await paymentRows(booking.id)
  R.check('charge.refunded did not duplicate: exactly one refund row', pays.filter((p) => p.type === 'refund').length === 1, pays.map((p) => `${p.type}:${p.stripe_object_id}:${p.amount_cents}:${p.status}`))
  const after = await bookingRow(booking.id)
  R.check('still cancelled / refunded after webhooks', after.status === 'cancelled' && after.payment_status === 'refunded')
  const rf = await refundFacts(r.json.refund.id)
  R.note('stripe refund', rf)
  R.check('Stripe: reverse transfer and application fee refund', rf.amount === 340 && !!rf.transferReversal && rf.applicationFeeRefunded === 220, rf)
  const evs = await eventsForObject(charge.id)
  R.check('refund events processed without error', evs.every((e) => e.processed_at && !e.error), evs)
  S.cancelFar = { id: booking.id, piId }
})

await R.scenario('6b. Client cancels inside 24h: no refund', async () => {
  const slot = await slotWithin24h(b1, skinFade.id)
  R.note('slot', `${slot.startsAt} (${Math.round((Date.parse(slot.startsAt) - Date.now()) / 60_000)} min from now)`)
  const { booking, piId } = await bookAndPay(c1, b1, skinFade.id, slot, '6b')
  const r = await api('PATCH', `/api/bookings/${booking.id}`, { token: c1.token, body: { action: 'cancel' } })
  R.check('200, refund null', r.status === 200 && r.json.refund === null, { status: r.status, refund: r.json.refund, error: r.json.error })
  R.check('booking cancelled, payment still succeeded', r.json.booking?.status === 'cancelled' && r.json.booking?.payment_status === 'succeeded')
  await sleep(4000)
  const pays = await paymentRows(booking.id)
  const ch = (await stripeChargeFacts(piId)).facts
  R.check('no refund row and nothing refunded at Stripe', pays.every((p) => p.type === 'charge') && ch.amountRefunded === 0, { rows: pays.length, amountRefunded: ch.amountRefunded })
  S.inside24 = { id: booking.id, piId }
})

await R.scenario('6c. Barber cancels (inside 24h): full refund', async () => {
  const slot = await slotWithin24h(b1, skinFade.id)
  const { booking, piId } = await bookAndPay(c2, b1, skinFade.id, slot, '6c')
  const r = await api('PATCH', `/api/bookings/${booking.id}`, { token: bo1.token, body: { action: 'cancel', reason: 'barber sick' } })
  R.check('200 with a 340 refund', r.status === 200 && r.json.refund?.amountCents === 340, { status: r.status, refund: r.json.refund, error: r.json.error })
  R.check('cancelled_by_barber, refunded', r.json.booking?.cancellation_reason?.startsWith('cancelled_by_barber') && r.json.booking?.payment_status === 'refunded')
  const { charge } = await stripeChargeFacts(piId)
  await waitEvent(charge.id, 'charge.refunded')
  await sleep(2000)
  const pays = await paymentRows(booking.id)
  R.check('one refund row', pays.filter((p) => p.type === 'refund').length === 1, pays.map((p) => `${p.type}:${p.amount_cents}:${p.status}`))
  const rf = await refundFacts(r.json.refund.id)
  R.note('stripe refund', rf)
  R.check('Stripe: reverse transfer and application fee refund', !!rf.transferReversal && rf.applicationFeeRefunded === 220, rf)
  S.barberCancel = { id: booking.id, piId }
})

await R.scenario('6d. Client cancels right after paying (racing the webhook): one refund', async () => {
  const slot = await findFreeSlot(b1, skinFade.id, { fromDate: FAR_FROM })
  const r = await bookAs(c2, b1, skinFade.id, slot.startsAt)
  const b = r.json.booking
  const c = await confirmPayment(b.payment_intent_id, r.json.clientSecret, 'pm_card_visa')
  const cancel = await api('PATCH', `/api/bookings/${b.id}`, { token: c2.token, body: { action: 'cancel' } })
  R.note('state seen by cancel', { confirm: c.status, cancelStatus: cancel.status, refund: cancel.json.refund, error: cancel.json.error })
  R.check('cancel 200 and booking ends cancelled / refunded', cancel.status === 200 && cancel.json.booking.status === 'cancelled' && cancel.json.booking.payment_status === 'refunded', { status: cancel.status, b: cancel.json.booking && [cancel.json.booking.status, cancel.json.booking.payment_status] })
  const ev = await waitEvent(b.payment_intent_id, 'payment_intent.succeeded')
  const { charge } = await stripeChargeFacts(b.payment_intent_id)
  await waitEvent(charge.id, 'charge.refunded')
  await sleep(2500)
  const fin = await bookingRow(b.id)
  const pays = await paymentRows(b.id)
  R.check('after webhooks: still cancelled / refunded, one charge and one refund row', fin.status === 'cancelled' && fin.payment_status === 'refunded' && pays.filter((p) => p.type === 'charge').length === 1 && pays.filter((p) => p.type === 'refund').length === 1, pays.map((p) => `${p.type}:${p.stripe_object_id}:${p.amount_cents}:${p.status}`))
  const refunds = await stripe.refunds.list({ payment_intent: b.payment_intent_id })
  R.check('Stripe: exactly one refund on the PaymentIntent', refunds.data.length === 1 && refunds.data[0].amount === 340, refunds.data.map((x) => x.id))
  R.check('succeeded webhook did not refund again (no error recorded)', ev.error === null, ev)
  S.race = { id: b.id, piId: b.payment_intent_id }
})

// ---------------------------------------------------------------------------
// 7. Duplicate delivery
// ---------------------------------------------------------------------------

await R.scenario('7. Duplicate webhook delivery', async () => {
  const evtId = S.happy.succeededEvent
  const before = { events: (await db.from('stripe_events').select('id', { count: 'exact', head: true })).count, pays: (await paymentRows(S.happy.id)).length, ev: (await db.from('stripe_events').select('processed_at, error').eq('id', evtId).single()).data }
  const logPath = process.env.E2E_LISTEN_LOG
  const countDeliveries = () => (logPath ? (readFileSync(logPath, 'utf8').match(new RegExp(`<--\\s+\\[(\\d+)\\][^\\n]*${evtId}`, 'g')) ?? []) : [])
  const deliveriesBefore = countDeliveries().length
  let resendOk = false
  try {
    execFileSync('stripe', ['events', 'resend', evtId], { stdio: ['ignore', 'ignore', 'pipe'], env: stripeCliEnv() })
    resendOk = true
  } catch (e) {
    R.note('stripe events resend failed', scrub(e.stderr?.toString() ?? e.message).slice(0, 300))
  }
  if (resendOk && logPath) {
    const lines = await waitFor(async () => {
      const l = countDeliveries()
      return l.length > deliveriesBefore ? l : null
    }, `redelivery of ${evtId}`, { timeoutMs: 30_000 }).catch(() => null)
    R.check('`stripe events resend` redelivered through stripe listen and got 200', !!lines && /\[200\]/.test(lines.at(-1)), lines?.at(-1))
  } else if (resendOk) {
    R.note('resend', 'sent; set E2E_LISTEN_LOG to verify the delivery status from the listener log')
  }
  // A direct signed replay shows the response body.
  const secret = webhookSecretFromCli()
  const { data: stored } = await db.from('stripe_events').select('payload').eq('id', evtId).single()
  const payload = JSON.stringify(stored.payload)
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret })
  const replay = await api('POST', '/api/webhooks/stripe', { body: payload, headers: { 'stripe-signature': header, 'content-type': 'application/json' } })
  R.check('signed replay of the processed event: 200 duplicate', replay.status === 200 && replay.json.duplicate === true, replay)
  const bad = await api('POST', '/api/webhooks/stripe', { body: payload, headers: { 'stripe-signature': 't=1,v1=deadbeef', 'content-type': 'application/json' } })
  R.check('bad signature: 400 INVALID_SIGNATURE', bad.status === 400 && bad.json.error?.code === 'INVALID_SIGNATURE', bad)
  await sleep(1500)
  const after = { pays: (await paymentRows(S.happy.id)).length, ev: (await db.from('stripe_events').select('processed_at, error').eq('id', evtId).single()).data, b: await bookingRow(S.happy.id) }
  R.check('no duplicate rows; event row and booking unchanged', after.pays === before.pays && after.ev.processed_at === before.ev.processed_at && after.b.status === 'confirmed' && after.b.payment_status === 'succeeded', { before, after: { pays: after.pays, ev: after.ev } })
  R.note('event', evtId)
})

/** The Stripe CLI reads STRIPE_API_KEY from its environment, so the key never appears in a process listing. */
function stripeCliEnv() {
  return { ...process.env, STRIPE_API_KEY: ctx.secretKey }
}
function webhookSecretFromCli() {
  if (!cachedWhsec) {
    cachedWhsec = execFileSync('stripe', ['listen', '--print-secret'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: stripeCliEnv() }).trim()
    if (!cachedWhsec.startsWith('whsec_')) throw new Error('could not read the stripe listen signing secret')
  }
  return cachedWhsec
}

// ---------------------------------------------------------------------------
// 8. Fee-exempt barber
// ---------------------------------------------------------------------------

await R.scenario('8. Fee-exempt barber: confirmed at once, no PaymentIntent', async () => {
  const slot = await findFreeSlot(b2, cutLineup.id, { fromDate: FAR_FROM })
  const r = await bookAs(c1, b2, cutLineup.id, slot.startsAt)
  const b = r.json.booking
  R.check('201, clientSecret null', r.status === 201 && r.json.clientSecret === null, { status: r.status, error: r.json.error })
  R.check('confirmed, payment none, no PI, fee 0', b.status === 'confirmed' && b.payment_status === 'none' && b.payment_intent_id === null && b.booking_fee_cents === 0 && b.hold_expires_at === null, { status: b.status, pay: b.payment_status, pi: b.payment_intent_id })
  R.check('no payments rows', (await paymentRows(b.id)).length === 0)
  S.exempt = { id: b.id }
  R.note('booking', b.id)
})

// ---------------------------------------------------------------------------
// 9. Walk-ins
// ---------------------------------------------------------------------------

await R.scenario('9. Barber walk-in (manual booking)', async () => {
  const overlapStart = new Date(Date.parse(S.happy.startsAt) + 30 * 60_000).toISOString()
  const o = await api('POST', '/api/bookings/manual', { token: bo1.token, body: { serviceId: skinFade.id, startsAt: overlapStart, customerName: 'Walk In', notes: NOTE } })
  R.check('overlapping walk-in rejected 409 SLOT_TAKEN', o.status === 409 && o.json.error?.code === 'SLOT_TAKEN', o)
  const exact = await api('POST', '/api/bookings/manual', { token: bo1.token, body: { serviceId: skinFade.id, startsAt: S.happy.startsAt, customerName: 'Walk In', notes: NOTE } })
  R.check('same start rejected 409', exact.status === 409, exact.status)
  const free = new Date(Date.parse(S.happy.endsAt)).toISOString() // back-to-back is allowed
  const slotFree = (await api('GET', `/api/barbers/${b1.id}/availability?date=${S.happyDate}&serviceId=${skinFade.id}`)).json.slots.find((s) => s.startsAt === free)
  const n = await api('POST', '/api/bookings/manual', { token: bo1.token, body: { serviceId: skinFade.id, startsAt: slotFree?.available ? free : new Date(Date.parse(S.happy.startsAt) - 2 * 3_600_000).toISOString(), customerName: 'Walk In', notes: NOTE } })
  R.check('non-overlapping walk-in 201: confirmed, manual, no client, no payment', n.status === 201 && n.json.booking.status === 'confirmed' && n.json.booking.source === 'manual' && n.json.booking.client_id === null && n.json.booking.payment_status === 'none', { status: n.status, booking: n.json.booking && { id: n.json.booking.id, starts: n.json.booking.starts_at }, error: n.json.error })
  const other = await api('POST', '/api/bookings/manual', { token: bo2.token, body: { serviceId: skinFade.id, startsAt: free, customerName: 'X', notes: NOTE } })
  R.check("barber two cannot use barber one's service (400 INVALID_SERVICE)", other.status === 400 && other.json.error?.code === 'INVALID_SERVICE', other)
  const asClient = await api('POST', '/api/bookings/manual', { token: c1.token, body: { serviceId: skinFade.id, startsAt: free, customerName: 'X' } })
  R.check('client cannot create walk-ins (403)', asClient.status === 403, asClient)
  S.walkIn = n.json.booking?.id
})

// ---------------------------------------------------------------------------
// 10. Authorization and earnings
// ---------------------------------------------------------------------------

await R.scenario('10. Authorization and earnings', async () => {
  const id = S.happy.id
  const list2 = await api('GET', '/api/bookings?as=barber&limit=100', { token: bo2.token })
  R.check("barber two's list excludes barber one's bookings", list2.status === 200 && !list2.json.bookings.some((b) => b.id === id || b.barber_id === b1.id), { status: list2.status, n: list2.json.bookings?.length })
  const { data: rlsRead } = await bo2.client.from('bookings').select('id').eq('id', id)
  R.check("barber two's own Supabase session cannot read it (RLS)", Array.isArray(rlsRead) && rlsRead.length === 0, rlsRead)
  const { data: rlsPays } = await bo2.client.from('payments').select('id').eq('booking_id', id)
  R.check("barber two cannot read its payments (RLS)", Array.isArray(rlsPays) && rlsPays.length === 0)
  const xCancel = await api('PATCH', `/api/bookings/${id}`, { token: bo2.token, body: { action: 'cancel' } })
  const xComplete = await api('PATCH', `/api/bookings/${id}`, { token: bo2.token, body: { action: 'complete' } })
  R.check('barber two cancel / complete: 404 BOOKING_NOT_FOUND', xCancel.status === 404 && xComplete.status === 404 && xCancel.json.error.code === 'BOOKING_NOT_FOUND', { cancel: xCancel.status, complete: xComplete.status })
  const c2Cancel = await api('PATCH', `/api/bookings/${id}`, { token: c2.token, body: { action: 'cancel' } })
  R.check("client two cannot cancel client one's booking (404)", c2Cancel.status === 404, c2Cancel.status)
  const cComplete = await api('PATCH', `/api/bookings/${id}`, { token: c1.token, body: { action: 'complete' } })
  R.check('client cannot complete (403 FORBIDDEN)', cComplete.status === 403 && cComplete.json.error.code === 'FORBIDDEN', cComplete)
  const early = await api('PATCH', `/api/bookings/${id}`, { token: bo1.token, body: { action: 'complete' } })
  R.check('owning barber is authorised but too early (409 TOO_EARLY)', early.status === 409 && early.json.error.code === 'TOO_EARLY', early)
  const still = await bookingRow(id)
  R.check('booking unchanged (confirmed / succeeded)', still.status === 'confirmed' && still.payment_status === 'succeeded')
  const own = await api('GET', '/api/bookings?as=client&limit=100', { token: c1.token })
  R.check("client one's list includes it", own.status === 200 && own.json.bookings.some((b) => b.id === id))
  const c2list = await api('GET', '/api/bookings?as=client&limit=100', { token: c2.token })
  R.check("client two's list excludes it", c2list.status === 200 && !c2list.json.bookings.some((b) => b.id === id))

  const noTok = await Promise.all([
    api('GET', '/api/bookings'),
    api('POST', '/api/bookings', { body: { barberId: b1.id, serviceId: skinFade.id, startsAt: S.happy.startsAt } }),
    api('PATCH', `/api/bookings/${id}`, { body: { action: 'cancel' } }),
    api('POST', '/api/bookings/manual', { body: {} }),
    api('GET', '/api/earnings'),
    api('POST', '/api/stripe/connect/onboarding'),
    api('GET', '/api/stripe/connect/status'),
    api('GET', '/api/bookings', { token: 'not-a-real-token' }),
  ])
  R.check('no token / bad token: 401 everywhere', noTok.every((r) => r.status === 401), noTok.map((r) => r.status))
  const clientEarn = await api('GET', '/api/earnings', { token: c1.token })
  R.check('client calling earnings: 403 NOT_A_BARBER', clientEarn.status === 403, clientEarn.status)

  // Earnings over the far-future range used by scenarios 2-6a and 8.
  const q = `/api/earnings?from=${EARNINGS_FROM}&to=${EARNINGS_TO}&limit=500`
  const e1 = await api('GET', q, { token: bo1.token })
  const e2 = await api('GET', q, { token: bo2.token })
  const per = Object.fromEntries((e1.json.bookings ?? []).map((b) => [b.id, b]))
  R.note('barber one totals', e1.json.totals)
  R.note('barber two totals', e2.json.totals)
  R.check('barber one: 120 per paid booking (happy, decline-retry)', per[S.happy.id]?.feeShareCents === 120 && per[S.declineRetry.id]?.feeShareCents === 120, { happy: per[S.happy.id]?.feeShareCents, retry: per[S.declineRetry.id]?.feeShareCents })
  R.check('barber one: refunded bookings net 0 (late payment, client cancel >24h)', per[S.late.id]?.feeShareCents === 0 && per[S.cancelFar.id]?.feeShareCents === 0, { late: per[S.late.id]?.feeShareCents, cancelFar: per[S.cancelFar.id]?.feeShareCents })
  // Paid in range: happy, declineRetry (kept); late, cancelFar, race (refunded).
  R.check('barber one totals: earned 600, reversed 360, net 240, refunded to clients 1020', e1.json.totals.feeShareEarnedCents === 600 && e1.json.totals.feeShareReversedCents === 360 && e1.json.totals.netFeeShareCents === 240 && e1.json.totals.refundedToClientsCents === 1020, e1.json.totals)
  R.check("barber two sees none of barber one's bookings and earns no fee share", e2.status === 200 && !(e2.json.bookings ?? []).some((b) => per[b.id]) && e2.json.totals.netFeeShareCents === 0 && (e2.json.bookings ?? []).some((b) => b.id === S.exempt.id), { n: e2.json.bookings?.length, net: e2.json.totals?.netFeeShareCents })

  // Inside-24h bookings (6b kept, 6c refunded), queried by a narrow range around them.
  const near = await api('GET', `/api/earnings?from=${new Date(Date.now() - 3_600_000).toISOString()}&to=${new Date(Date.now() + 25 * 3_600_000).toISOString()}&limit=500`, { token: bo1.token })
  const nper = Object.fromEntries((near.json.bookings ?? []).map((b) => [b.id, b]))
  R.check('client cancel inside 24h keeps 120; barber cancel reverses to 0', nper[S.inside24.id]?.feeShareCents === 120 && nper[S.barberCancel.id]?.feeShareCents === 0, { inside24: nper[S.inside24.id]?.feeShareCents, barberCancel: nper[S.barberCancel.id]?.feeShareCents })
})

// ---------------------------------------------------------------------------
// Webhook overview for this run
// ---------------------------------------------------------------------------

await R.scenario('W. Every webhook received during the run was processed', async () => {
  await sleep(3000)
  const { data } = await db.from('stripe_events').select('id, type, processed_at, error, payload->account').gte('received_at', runStartedAt)
  const byType = {}
  for (const e of data) byType[e.type] = (byType[e.type] ?? 0) + 1
  R.note('events by type', byType)
  const unprocessed = data.filter((e) => !e.processed_at)
  R.check('no unprocessed events', unprocessed.length === 0, unprocessed)
  const errors = data.filter((e) => e.error)
  R.note('events with error', errors.map((e) => `${e.id} ${e.type}: ${e.error}`))
  // Expected: the late payment (scenario 5) and, from scenario C's deliberate metadata
  // mismatch, account.updated refusing to update barber three's row.
  const unexpected = errors.filter((e) => !/arrived late/.test(e.error) && !(e.type === 'account.updated' && e.error.includes(S.b3Account) && /not updated/.test(e.error)))
  R.check('only expected events carry an error (late payment; mismatch test)', unexpected.length === 0 && errors.some((e) => /arrived late/.test(e.error)), unexpected)
})

const ok = R.summary()
if (process.env.E2E_RESULTS) writeFileSync(process.env.E2E_RESULTS, scrub(JSON.stringify(R.scenarios, null, 2)))
process.exit(ok ? 0 : 1)
