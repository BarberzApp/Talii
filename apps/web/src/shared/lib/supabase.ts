import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Check for required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const missingInfo = {
    url: supabaseUrl ? 'present' : 'missing',
    anonKey: supabaseAnonKey ? 'present' : 'missing'
  }
  logger.error('Missing Supabase environment variables', undefined, missingInfo)
  
  if (process.env.NODE_ENV === 'development') {
    throw new Error(`Missing Supabase environment variables: ${JSON.stringify(missingInfo)}`)
  }
}

if (process.env.NODE_ENV === 'development' && supabaseUrl) {
  logger.log(`🔗 Web Supabase URL: ${supabaseUrl}`)
}

// Create a single Supabase client instance for the entire app
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'barber-app-auth'
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'barber-app'
    }
  }
})

// Server-only Supabase client with the service-role key (bypasses RLS).
//
// Created lazily on first use so that importing this module from browser code
// does not fail. It never falls back to the anon key: an anon client used
// server-side has no rights, so writes silently did nothing. Missing config now
// fails loudly at the first call instead.
function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin is server-only and cannot be used in the browser')
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'supabaseAdmin requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set on the server'
    )
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

type AdminClient = ReturnType<typeof createAdminClient>
let adminClient: AdminClient | null = null

export function getSupabaseAdmin(): AdminClient {
  if (!adminClient) {
    adminClient = createAdminClient()
  }
  return adminClient
}

export const supabaseAdmin: AdminClient = new Proxy({} as AdminClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin()
    const value = Reflect.get(client, prop, client)
    return typeof value === 'function' ? value.bind(client) : value
  }
})
