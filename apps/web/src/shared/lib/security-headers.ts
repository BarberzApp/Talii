import { NextResponse } from 'next/server'

function originOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** Sentry's ingest origin from the DSN (https://<key>@<host>/<project>), or null. */
function sentryOrigin(dsn: string | undefined): string | null {
  if (!dsn) return null
  try {
    const url = new URL(dsn)
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

// Stripe's CSP guidance for Stripe.js and the Payment Element (incl. 3-D Secure frames).
const STRIPE_SCRIPT = ['https://js.stripe.com', 'https://*.js.stripe.com']
const STRIPE_FRAME = ['https://js.stripe.com', 'https://*.js.stripe.com', 'https://hooks.stripe.com', 'https://m.stripe.network']
const STRIPE_CONNECT = ['https://api.stripe.com', 'https://m.stripe.network']

/**
 * Content-Security-Policy for the pages. Allows this app, the configured
 * Supabase project (auth, storage and its websocket), Stripe.js / the Payment
 * Element, and the Sentry ingest host of the configured DSN (Replay runs in a
 * blob: worker).
 */
export function contentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV === 'development'
  const supabase = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseWs = supabase ? supabase.replace(/^http/, 'ws') : null
  const sentry = sentryOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN)

  const connect = ["'self'", supabase, supabaseWs, ...STRIPE_CONNECT, sentry].filter(Boolean)

  return [
    "default-src 'self'",
    // Next.js dev (React refresh, eval source maps) needs 'unsafe-eval'; production does not.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} ${STRIPE_SCRIPT.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:" + (supabase && supabase.startsWith('http:') ? ` ${supabase}` : ''),
    `connect-src ${[...new Set(connect)].join(' ')}`,
    `frame-src 'self' ${STRIPE_FRAME.join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

/** Security headers for every page response. */
export function securityHeaders(): NextResponse {
  const response = NextResponse.next()

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // Geolocation is used by "near me" on /browse; the Payment Element may use payment.
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com")')
  response.headers.set('Content-Security-Policy', contentSecurityPolicy())

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  return response
}
