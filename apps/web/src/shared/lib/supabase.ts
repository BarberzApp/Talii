import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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

// Server code uses getSupabaseAdmin() from '@/server/clients' (service role); there is no
// service-role client in this browser-safe module.
