import { supabase } from './supabase'
import { withTimeout } from './errorRecovery'
import type { AuthAdapter, AuthProfile, AuthProfileRole, AuthUser } from '@barber-app/shared'

function toAuthUser(user: any | null): AuthUser | null {
  if (!user) return null
  return { id: user.id, email: user.email }
}

export function createMobileAuthAdapter(): AuthAdapter {
  return {
    getSession: async () => {
      const sessionPromise = supabase.auth.getSession()
      const { data, error } = await withTimeout(sessionPromise, {
        timeout: 10000,
        timeoutMessage: 'Session check timed out',
      })
      return { user: toAuthUser(data.session?.user ?? null), errorMessage: error?.message }
    },
    onAuthStateChange: (cb) => {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        cb(toAuthUser(session?.user ?? null))
      })
      return { unsubscribe: () => data.subscription.unsubscribe() }
    },
    signInWithPassword: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      return { user: toAuthUser(data.user ?? null), errorMessage: error?.message }
    },
    signUp: async ({ name, email, password, role, businessName }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            business_name: businessName,
          },
        },
      })

      if (error) {
        const alreadyExists = error.message?.includes('User already registered') || error.status === 400
        return {
          user: null,
          needsConfirmation: false,
          alreadyExists,
          errorMessage: error.message,
        }
      }

      const needsConfirmation = !data.session
      const alreadyExists = !!data.user && (data.user.identities?.length ?? 0) === 0

      return {
        user: toAuthUser(data.user ?? null),
        needsConfirmation,
        alreadyExists,
      }
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      return { errorMessage: error?.message }
    },
    getProfile: async (userId) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      return {
        profile: (data as AuthProfile) || null,
        errorCode: (error as any)?.code,
        errorMessage: error?.message,
      }
    },
    updateProfile: async (userId, patch) => {
      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', userId)
      return { errorMessage: error?.message }
    },
    getBarberRow: async (userId) => {
      const { data, error } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      return { exists: !!data, errorMessage: error?.message }
    },
    createBarberRow: async (userId, businessName) => {
      const { error } = await supabase.from('barbers').insert({
        user_id: userId,
        business_name: businessName,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      return { errorMessage: error?.message }
    },
    createProfile: async ({ id, name, email, role, username, businessName }) => {
      const { error } = await supabase.from('profiles').insert({
        id,
        name,
        email,
        role: role as AuthProfileRole,
        username,
        business_name: businessName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      return { errorMessage: error?.message }
    },
  }
}

