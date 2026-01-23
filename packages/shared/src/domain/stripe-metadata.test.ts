import assert from 'node:assert/strict'
import {
  buildStripeBookingMetadata,
  normalizeAddonIdsToCsv,
  parseStripeBookingMetadata,
  STRIPE_BOOKING_METADATA_KEYS,
} from './stripe-metadata'

{
  const csv = normalizeAddonIdsToCsv(['a', 'b', 'b', '  c  '])
  assert.equal(csv, 'a,b,c')
}

{
  const metadata = buildStripeBookingMetadata({
    barberId: 'barber-1',
    serviceId: 'service-1',
    date: '2026-01-01T10:00:00.000Z',
    clientId: 'client-1',
    addonIds: ['addon-1', 'addon-2'],
    platformFeeCents: 340,
    bocmShareCents: 180,
    barberShareCents: 120,
    isDeveloper: false,
  })

  STRIPE_BOOKING_METADATA_KEYS.required.forEach(key => {
    assert.ok(metadata[key], `Missing key: ${key}`)
  })

  const parsed = parseStripeBookingMetadata(metadata)
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.value.barberId, 'barber-1')
    assert.equal(parsed.value.serviceId, 'service-1')
    assert.equal(parsed.value.clientId, 'client-1')
    assert.equal(parsed.value.addonIdsCsv, 'addon-1,addon-2')
    assert.equal(parsed.value.platformFeeCents, '340')
  }
}

{
  const parsed = parseStripeBookingMetadata({ barberId: 'only-barber' })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.ok(parsed.missing.includes('serviceId'))
    assert.ok(parsed.missing.includes('date'))
    assert.ok(parsed.missing.includes('clientId'))
  }
}

console.log('stripe-metadata.test.ts: OK')
