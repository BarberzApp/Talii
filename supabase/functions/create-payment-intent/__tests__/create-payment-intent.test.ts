import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { handleCreatePaymentIntentRequest } from "../index.ts"

type SupabaseHandlerMap = Record<string, any>

const createMockSupabase = (handlers: SupabaseHandlerMap) => ({
  from: (table: string) => {
    const handler = handlers[table]
    if (!handler) {
      throw new Error(`No mock handler registered for table: ${table}`)
    }
    return handler
  },
})

const createEnv = (values: Record<string, string>) => ({
  get: (key: string) => values[key],
})

Deno.test("returns 400 when required fields are missing", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ barberId: "barber-1" }),
  })

  const response = await handleCreatePaymentIntentRequest(request, {
    env: createEnv({
      SUPABASE_URL: "http://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      STRIPE_SECRET_KEY: "sk_test",
    }),
    createSupabaseClient: () => createMockSupabase({}),
    createStripeClient: () => ({ paymentIntents: { create: async () => ({}) } } as any),
  })

  assertEquals(response.status, 400)
})

Deno.test("rejects developer barbers", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      barberId: "barber-1",
      serviceId: "service-1",
      date: new Date().toISOString(),
    }),
  })

  const supabase = createMockSupabase({
    barbers: {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              stripe_account_id: "acct_dev",
              stripe_account_status: "active",
              is_developer: true,
            },
            error: null,
          }),
        }),
      }),
    },
  })

  const response = await handleCreatePaymentIntentRequest(request, {
    env: createEnv({
      SUPABASE_URL: "http://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      STRIPE_SECRET_KEY: "sk_test",
    }),
    createSupabaseClient: () => supabase as any,
    createStripeClient: () => ({ paymentIntents: { create: async () => ({}) } } as any),
  })

  assertEquals(response.status, 400)
})

Deno.test("creates payment intent with fee-only amount", async () => {
  let stripePayload: Record<string, unknown> | null = null

  const request = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({
      barberId: "barber-1",
      serviceId: "service-1",
      date: new Date().toISOString(),
    }),
  })

  const supabase = createMockSupabase({
    barbers: {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              stripe_account_id: "acct_live",
              stripe_account_status: "active",
              is_developer: false,
            },
            error: null,
          }),
        }),
      }),
    },
    services: {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              name: "Test Service",
              price: 25,
              duration: 30,
            },
            error: null,
          }),
        }),
      }),
    },
  })

  const response = await handleCreatePaymentIntentRequest(request, {
    env: createEnv({
      SUPABASE_URL: "http://supabase.test",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      STRIPE_SECRET_KEY: "sk_test",
    }),
    createSupabaseClient: () => supabase as any,
    createStripeClient: () =>
      ({
        paymentIntents: {
          create: async (payload: Record<string, unknown>) => {
            stripePayload = payload
            return {
              id: "pi_123",
              client_secret: "secret_123",
              amount: payload.amount,
            }
          },
        },
      }) as any,
  })

  const json = await response.json()

  assertEquals(response.status, 200)
  assertEquals(json.amount, 340)
  assertEquals(stripePayload?.amount, 340)
  assertEquals(stripePayload?.application_fee_amount, 180)
})
