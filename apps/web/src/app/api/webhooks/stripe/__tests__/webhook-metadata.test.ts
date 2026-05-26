import { buildStripeBookingMetadata, parseStripeBookingMetadata } from '@/shared/lib/stripe-booking-metadata'

describe('Stripe booking metadata contract', () => {
  test('parseStripeBookingMetadata fails when required fields are missing', () => {
    const parsed = parseStripeBookingMetadata({
      barberId: 'b',
      serviceId: '',
      date: '2026-01-01T10:00:00.000Z',
      clientId: '',
    })

    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.missing).toEqual(expect.arrayContaining(['serviceId', 'clientId']))
    }
  })

  test('buildStripeBookingMetadata produces parseable required fields', () => {
    const meta = buildStripeBookingMetadata({
      barberId: '11111111-1111-1111-1111-111111111111',
      serviceId: '22222222-2222-2222-2222-222222222222',
      date: '2026-01-01T10:00:00.000Z',
      clientId: '33333333-3333-3333-3333-333333333333',
      notes: 'hi',
      addonIds: ['a', 'a', 'b'],
      addonTotalCents: 500,
      platformFeeCents: 340,
      bocmShareCents: 180,
      barberShareCents: 120,
      isDeveloper: false,
      addonsPaidSeparately: true,
    })

    const parsed = parseStripeBookingMetadata(meta)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.barberId).toBe('11111111-1111-1111-1111-111111111111')
      expect(parsed.value.serviceId).toBe('22222222-2222-2222-2222-222222222222')
      expect(parsed.value.clientId).toBe('33333333-3333-3333-3333-333333333333')
      expect(parsed.value.addonIdsCsv).toBe('a,b')
      expect(parsed.value.platformFeeCents).toBe('340')
      expect(parsed.value.bocmShareCents).toBe('180')
      expect(parsed.value.barberShareCents).toBe('120')
      expect(parsed.value.addonsPaidSeparately).toBe('true')
    }
  })
})

