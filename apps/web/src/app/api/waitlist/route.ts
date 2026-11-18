import { z } from 'zod'
import { getSupabaseAdmin } from '@/server/clients'
import { pgCode, PG } from '@/server/errors'
import { defineRoute } from '@/server/route'
import { enforceRateLimit, limiters } from '@/server/rate-limit'

/**
 * POST /api/waitlist   (public)   10 per hour per IP.
 * Body: { email }
 * 200 { success: true } — the same whether or not the email was already on the list.
 * Errors: 400 VALIDATION_ERROR, 429 RATE_LIMITED
 */
export const POST = defineRoute(
  { auth: 'public', body: z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict() },
  async ({ req, body }) => {
    enforceRateLimit(limiters.waitlist, req)
    const { error } = await getSupabaseAdmin().from('waitlist').insert({ email: body.email })
    if (error && pgCode(error) !== PG.uniqueViolation) throw error
    return { success: true }
  }
)
