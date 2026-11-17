import 'server-only'
import { z } from 'zod'

/**
 * Server environment, validated once on first use.
 *
 * Read lazily (not at import time) so `next build` and unit tests can import
 * route modules without secrets. A missing or malformed variable throws an
 * error that names the variable but never prints its value.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_/, 'must be a Stripe secret or restricted key'),
  STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_/, 'must be a Stripe webhook signing secret'),
  /**
   * Optional second signing secret. Stripe signs each webhook endpoint with its
   * own secret; set this when connected-account events (account.updated) come
   * from a separate Connect endpoint pointing at the same URL.
   */
  STRIPE_CONNECT_WEBHOOK_SECRET: z
    .string()
    .regex(/^whsec_/, 'must be a Stripe webhook signing secret')
    .optional(),
  /** Public base URL of the web app, used for Stripe return/refresh links. */
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

export type ServerEnv = z.infer<typeof schema>

let cached: ServerEnv | undefined

export function getServerEnv(): ServerEnv {
  if (cached) return cached

  const raw: Record<string, string | undefined> = {}
  for (const key of Object.keys(schema.shape)) {
    const value = process.env[key]?.trim()
    raw[key] = value ? value : undefined
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => {
      const name = String(issue.path[0])
      return raw[name] === undefined ? `${name} is missing` : `${name} is invalid (${issue.message})`
    })
    throw new Error(`Server environment is not configured: ${problems.join('; ')}`)
  }

  cached = { ...parsed.data, NEXT_PUBLIC_APP_URL: parsed.data.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '') }
  return cached
}

/** Test hook: forget the cached environment. */
export function resetServerEnvForTests(): void {
  cached = undefined
}
