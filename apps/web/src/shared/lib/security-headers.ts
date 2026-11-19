import { NextResponse } from 'next/server'

function originOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * Content-Security-Policy for the pages. Allows this app, the Supabase project
 * (auth, storage, and its websocket), and Stripe.js / the Payment Element.
 */
export function contentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV === 'development'
  const supabase = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseWs = supabase ? supabase.replace(/^http/, 'ws') : null

  const connect = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    supabase,
    supabaseWs,
    'https://api.stripe.com',
    'https://m.stripe.network',
    'https://*.ingest.sentry.io',
    'https://*.ingest.us.sentry.io',
  ].filter(Boolean)

  return [
    "default-src 'self'",
    // Next.js dev (React refresh, eval source maps) needs 'unsafe-eval'; production does not.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:" + (supabase && supabase.startsWith('http:') ? ` ${supabase}` : ''),
    `connect-src ${[...new Set(connect)].join(' ')}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
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
