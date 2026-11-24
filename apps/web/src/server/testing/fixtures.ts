/**
 * Seed data for API unit tests: one client, one barber (New York, open
 * Mon-Fri 09:00-17:00, Stripe-ready), one other user and one admin.
 * Not imported by production code.
 */
import { createBookingDb, type FakeDb, type Row } from './fake-supabase'

export const IDS = {
  clientUser: '10000000-0000-4000-8000-000000000001',
  barberUser: '10000000-0000-4000-8000-000000000002',
  strangerUser: '10000000-0000-4000-8000-000000000003',
  adminUser: '10000000-0000-4000-8000-000000000004',
  barber: '20000000-0000-4000-8000-000000000001',
  service: '30000000-0000-4000-8000-000000000001',
  inactiveService: '30000000-0000-4000-8000-000000000002',
  addon: '40000000-0000-4000-8000-000000000001',
  stripeAccount: 'acct_test_barber',
} as const

export const TOKENS = {
  client: 'client-token',
  barber: 'barber-token',
  stranger: 'stranger-token',
  admin: 'admin-token',
} as const

export const TEST_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  STRIPE_SECRET_KEY: 'sk_test_unit',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret_for_unit_tests',
  NEXT_PUBLIC_APP_URL: 'https://app.example.test',
}

function profile(id: string, role: string, username: string): Row {
  return { id, role, name: username, username, email: `${username}@example.test`, is_disabled: false }
}

export function seedMarketplace(): FakeDb {
  const weekdays = [1, 2, 3, 4, 5].map((day) => ({
    id: `50000000-0000-4000-8000-00000000000${day}`,
    barber_id: IDS.barber,
    day_of_week: day,
    start_time: '09:00:00',
    end_time: '17:00:00',
  }))

  const db = createBookingDb({
    profiles: [
      profile(IDS.clientUser, 'client', 'client_one'),
      profile(IDS.barberUser, 'barber', 'barber_one'),
      profile(IDS.strangerUser, 'client', 'stranger'),
      profile(IDS.adminUser, 'client', 'admin'),
    ],
    barbers: [
      {
        id: IDS.barber,
        user_id: IDS.barberUser,
        business_name: 'Fade Factory',
        timezone: 'America/New_York',
        is_public: true,
        onboarding_complete: true,
      },
    ],
    barber_billing: [
      {
        barber_id: IDS.barber,
        stripe_account_id: IDS.stripeAccount,
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        fee_exempt: false,
      },
    ],
    services: [
      { id: IDS.service, barber_id: IDS.barber, name: 'Fade', duration_minutes: 30, price_cents: 3500, is_active: true },
      {
        id: IDS.inactiveService,
        barber_id: IDS.barber,
        name: 'Old',
        duration_minutes: 30,
        price_cents: 1000,
        is_active: false,
      },
    ],
    service_addons: [{ id: IDS.addon, barber_id: IDS.barber, name: 'Beard', price_cents: 1000, is_active: true }],
    availability: weekdays,
    special_hours: [],
    bookings: [],
    booking_addons: [],
    payments: [],
    stripe_events: [],
  })

  db.users.set(TOKENS.client, { id: IDS.clientUser, email: 'client_one@example.test' })
  db.users.set(TOKENS.barber, { id: IDS.barberUser, email: 'barber_one@example.test' })
  db.users.set(TOKENS.stranger, { id: IDS.strangerUser, email: 'stranger@example.test' })
  db.users.set(TOKENS.admin, { id: IDS.adminUser, email: 'admin@example.test', app_metadata: { role: 'admin' } })
  return db
}

/** A booking row with sensible defaults (confirmed and paid). */
export function bookingRow(overrides: Row = {}): Row {
  return {
    id: '60000000-0000-4000-8000-000000000001',
    barber_id: IDS.barber,
    client_id: IDS.clientUser,
    customer_name: null,
    service_id: IDS.service,
    starts_at: '2026-03-02T15:00:00.000Z',
    ends_at: '2026-03-02T15:30:00.000Z',
    source: 'app',
    status: 'confirmed',
    payment_status: 'succeeded',
    hold_expires_at: null,
    service_price_cents: 3500,
    addon_total_cents: 0,
    booking_fee_cents: 340,
    application_fee_cents: 220,
    barber_fee_share_cents: 120,
    payment_intent_id: 'pi_test_1',
    notes: null,
    cancelled_at: null,
    cancellation_reason: null,
    ...overrides,
  }
}

export function request(
  url: string,
  init: { method?: string; token?: string; body?: unknown; rawBody?: string } = {}
): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init.token) headers.authorization = `Bearer ${init.token}`
  return new Request(`http://localhost${url}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.rawBody ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
  })
}

export function routeParams(params: Record<string, string>) {
  return { params: Promise.resolve(params) }
}
