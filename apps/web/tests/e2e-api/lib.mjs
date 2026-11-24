// Shared helpers for the end-to-end API harness. See README.md.
// Never prints secrets: keys are read into memory only and errors are scrubbed.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
export const API_BASE = localApiBase(process.env.E2E_API_BASE || 'http://localhost:3010')

/** The harness creates and deletes data with the service role: only ever point it at a local server. */
function localApiBase(raw) {
  const url = new URL(raw)
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error(`E2E_API_BASE must be http(s)://localhost or 127.0.0.1, got host ${url.hostname}`)
  }
  return url.origin
}
export const STRIPE_API_VERSION = '2025-08-27.basil'
export const E2E_TAG = 'talii-e2e-api'
export const NOTE = `e2e-api ${new Date().toISOString()}`
export const PASSWORD = 'local-dev-password'

export const USERS = {
  admin: { id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com' },
  barberOne: { id: '00000000-0000-4000-8000-000000000011', email: 'barber.one@example.com' },
  barberTwo: { id: '00000000-0000-4000-8000-000000000012', email: 'barber.two@example.com' },
  clientOne: { id: '00000000-0000-4000-8000-000000000021', email: 'client.one@example.com' },
  clientTwo: { id: '00000000-0000-4000-8000-000000000022', email: 'client.two@example.com' },
  // Created by the harness: a barber with no Stripe account (Connect onboarding test).
  barberThree: { id: '00000000-0000-4000-8000-0000000000e3', email: 'e2e.barber.three@example.com' },
}

/** Removes anything that looks like a secret from text before it is printed. */
export function scrub(text) {
  return String(text)
    .replace(/(sk|rk)_(test|live)_[A-Za-z0-9]+/g, '$1_$2_[REDACTED]')
    .replace(/whsec_[A-Za-z0-9]+/g, 'whsec_[REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT]')
    .replace(/(pi_[A-Za-z0-9]+)_secret_[A-Za-z0-9]+/g, '$1_secret_[REDACTED]')
}

function readDotenvValue(file, name) {
  try {
    const text = readFileSync(file, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`).exec(line)
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, '')
    }
  } catch {
    // missing file
  }
  return undefined
}

/** Local Supabase URL and keys (from env, else `supabase status -o env`). Refuses anything not local. */
export function localSupabaseConfig() {
  let url = process.env.SUPABASE_URL
  let anon = process.env.SUPABASE_ANON_KEY
  let service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) {
    const out = execFileSync('supabase', ['status', '-o', 'env'], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const get = (k) => (new RegExp(`^${k}="?([^"\\n]*)"?$`, 'm').exec(out) || [])[1]
    url = url || get('API_URL')
    anon = anon || get('ANON_KEY')
    service = service || get('SERVICE_ROLE_KEY')
  }
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url || '')) {
    throw new Error('Refusing to run: Supabase URL is not a local stack')
  }
  if (!anon || !service) throw new Error('Local Supabase keys not found (is `supabase start` running?)')
  return { url, anon, service }
}

/** Stripe secret key from env or supabase/.env. Must be a TEST key. */
export function stripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY || readDotenvValue(path.join(REPO_ROOT, 'supabase/.env'), 'STRIPE_SECRET_KEY')
  const isTest = typeof key === 'string' && key.startsWith('sk_test_')
  console.log(`test key: ${isTest ? 'yes' : 'no'}`)
  if (!isTest) throw new Error('STOP: Stripe key is not a test-mode secret key')
  return key
}

/** Optional publishable test key (for confirming like the Payment Sheet does). */
export function stripePublishableKey() {
  const key =
    process.env.STRIPE_PUBLISHABLE_KEY ||
    readDotenvValue(path.join(REPO_ROOT, 'supabase/.env'), 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY') ||
    readDotenvValue(path.join(REPO_ROOT, '.env'), 'STRIPE_PUBLISHABLE_KEY')
  return typeof key === 'string' && key.startsWith('pk_test_') ? key : undefined
}

export function makeClients() {
  const sb = localSupabaseConfig()
  const db = createClient(sb.url, sb.service, { auth: { persistSession: false, autoRefreshToken: false } })
  const key = stripeSecretKey()
  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2 })
  // `secretKey` stays in memory: only passed to the Stripe CLI as STRIPE_API_KEY in its environment, never printed.
  return { sb, db, stripe, pk: stripePublishableKey(), secretKey: key }
}

const tokenCache = new Map()
/** Signs a user in with the local anon key and returns { token, client } (a real Supabase session). */
export async function signIn(sb, email) {
  if (tokenCache.has(email)) return tokenCache.get(email)
  const client = createClient(sb.url, sb.anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
  const result = { token: data.session.access_token, client }
  tokenCache.set(email, result)
  return result
}

/** HTTP call to the API. Returns { status, json }. */
export async function api(method, urlPath, { token, body, headers } = {}) {
  const res = await fetch(`${API_BASE}${urlPath}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 300) }
  }
  return { status: res.status, json }
}

export async function waitFor(fn, what, { timeoutMs = 45_000, intervalMs = 750 } = {}) {
  const start = Date.now()
  let last
  for (;;) {
    last = await fn()
    if (last) return last
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${what}`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** YYYY-MM-DD of an instant in a time zone. */
export function localDate(instant, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant))
}
export function localTime(instant, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant))
}
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Result recording
// ---------------------------------------------------------------------------

export class Recorder {
  constructor() {
    this.scenarios = []
    this.current = null
  }
  async scenario(name, fn) {
    const s = { name, checks: [], evidence: {}, error: null }
    this.current = s
    this.scenarios.push(s)
    console.log(`\n=== ${name}`)
    try {
      await fn(s)
    } catch (error) {
      s.error = scrub(error?.stack || error?.message || String(error))
      console.log(`  ERROR ${s.error.split('\n').slice(0, 4).join('\n        ')}`)
    }
    const ok = !s.error && s.checks.every((c) => c.ok)
    s.result = ok ? 'PASS' : 'FAIL'
    console.log(`--- ${s.result}: ${name}`)
    return s
  }
  check(label, ok, detail) {
    const c = { label, ok: !!ok, detail: detail === undefined ? undefined : scrub(typeof detail === 'string' ? detail : JSON.stringify(detail)) }
    this.current.checks.push(c)
    console.log(`  [${c.ok ? 'ok' : 'FAIL'}] ${label}${c.detail ? ` :: ${c.detail.slice(0, 400)}` : ''}`)
    return c.ok
  }
  note(key, value) {
    this.current.evidence[key] = value
    console.log(`  · ${key}: ${scrub(typeof value === 'string' ? value : JSON.stringify(value))}`)
  }
  summary() {
    console.log('\n================ SUMMARY ================')
    for (const s of this.scenarios) {
      const failed = s.checks.filter((c) => !c.ok).map((c) => c.label)
      console.log(`${s.result}  ${s.name}${failed.length ? `  (failed: ${failed.join('; ')})` : ''}${s.error ? '  (error)' : ''}`)
    }
    return this.scenarios.every((s) => s.result === 'PASS')
  }
}
