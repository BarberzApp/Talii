/** @jest-environment node */
import { contentSecurityPolicy } from '../security-headers'

function directive(csp: string, name: string): string[] {
  const found = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `))
  return found ? found.split(/\s+/).slice(1) : []
}

describe('contentSecurityPolicy', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('allows only the configured Supabase origin, Stripe and the Sentry DSN host', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcd.supabase.co'
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://key@o123.ingest.us.sentry.io/456'
    const csp = contentSecurityPolicy()

    const connect = directive(csp, 'connect-src')
    expect(connect).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://abcd.supabase.co',
        'wss://abcd.supabase.co',
        'https://api.stripe.com',
        'https://o123.ingest.us.sentry.io',
      ])
    )
    expect(connect.some((s) => s.includes('*.supabase.co'))).toBe(false)
    expect(directive(csp, 'script-src')).toEqual(expect.arrayContaining(['https://js.stripe.com', 'https://*.js.stripe.com']))
    expect(directive(csp, 'frame-src')).toEqual(
      expect.arrayContaining(['https://js.stripe.com', 'https://*.js.stripe.com', 'https://hooks.stripe.com'])
    )
    expect(directive(csp, 'worker-src')).toEqual(["'self'", 'blob:'])
  })

  it('omits Sentry without a DSN and allows a local http Supabase for dev', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    delete process.env.NEXT_PUBLIC_SENTRY_DSN
    const csp = contentSecurityPolicy()
    const connect = directive(csp, 'connect-src')
    expect(connect).toEqual(expect.arrayContaining(['http://127.0.0.1:54321', 'ws://127.0.0.1:54321']))
    expect(connect.some((s) => s.includes('sentry'))).toBe(false)
  })
})
