import { securityHeaders } from '@/shared/lib/security-headers'

/**
 * Pages only: adds security headers. There is no server-side session here.
 * Auth lives in the browser (supabase-js, PKCE; /auth/callback exchanges the
 * code client-side) and every API route checks the Bearer token itself.
 *
 * No CSRF check: the API authenticates with an `Authorization: Bearer` header
 * that a browser never attaches on its own to a cross-site request, and it
 * uses no cookies, so a forged cross-site request carries no credentials.
 */
export function middleware() {
  return securityHeaders()
}

export const config = {
  matcher: [
    /*
     * All paths except Next.js assets, the favicon, public files and the API
     * (API responses are JSON and set their own headers).
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|api/).*)',
  ],
}
