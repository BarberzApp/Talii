import 'server-only'
import { ApiError } from './errors'

/**
 * Fixed-window, in-memory rate limiter keyed by client IP.
 *
 * Per server instance only: on serverless hosting each instance counts on its
 * own, so this is a brake on casual abuse, not a guarantee. Use the hosting
 * provider's firewall or a shared store for hard limits.
 */
export interface RateLimiter {
  /** Counts one hit for `key`; returns false when the key is over the limit. */
  hit(key: string, now?: number): boolean
  reset(): void
}

const MAX_KEYS = 10_000

export function createRateLimiter(options: { windowMs: number; max: number }): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>()

  return {
    hit(key, now = Date.now()) {
      const current = windows.get(key)
      if (!current || now >= current.resetAt) {
        if (windows.size >= MAX_KEYS) {
          for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k)
          if (windows.size >= MAX_KEYS) windows.clear()
        }
        windows.set(key, { count: 1, resetAt: now + options.windowMs })
        return true
      }
      if (current.count >= options.max) return false
      current.count += 1
      return true
    },
    reset() {
      windows.clear()
    },
  }
}

/** The caller's IP as reported by the proxy (first x-forwarded-for entry), else "unknown". */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Throws 429 RATE_LIMITED when this request's IP is over `limiter`'s limit. */
export function enforceRateLimit(limiter: RateLimiter, req: Request): void {
  if (!limiter.hit(clientIp(req))) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.')
  }
}

/** The public routes' limiters (tests call `.reset()`). */
export const limiters = {
  /** GET /api/geocode: 30 per minute per signed-in user. */
  geocode: createRateLimiter({ windowMs: 60_000, max: 30 }),
  /** POST /api/support: 5 per 15 minutes. */
  support: createRateLimiter({ windowMs: 15 * 60_000, max: 5 }),
}
