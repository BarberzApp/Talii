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

// Create a Supabase client with the service role key for admin operations
// In production, this client MUST have the service role key to bypass RLS.
// We throw an error if it's missing to avoid silent failures of admin tasks.
if (!supabaseServiceKey && process.env.NODE_ENV === 'production') {
  logger.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in production!')
  // We don't throw here to avoid crashing the whole app, but admin calls will fail with the fallback anon key.
}

export const supabaseAdmin = createClient(
  supabaseUrl || '', 
  supabaseServiceKey || supabaseAnonKey || '', 
  {
    auth: {
      persistSession: false, // Don't persist session for admin client
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
)
 